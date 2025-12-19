import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import {
  addEdge,
  ReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// --- 1. CONFIGURATION ---
const VEDA_WIDTH = 8500; 
const VEDA_ESTIMATED_HEIGHT = 15200; 
const VEDA_TOP_MARGIN = 300; 
const GAP_BETWEEN_VEDA_AND_NODE = 500; 
const TREE_START_Y = VEDA_ESTIMATED_HEIGHT + GAP_BETWEEN_VEDA_AND_NODE;

// --- 2. IMPROVED TRANSLITERATION ENGINE ---
const transliterate = (text) => {
  if (!text) return "";
  
  // 1. Handle full word overrides first
  const lower = text.toLowerCase().trim();
  if (lower === 'jengu' || lower === 'jingu') return 'झींगू';
  if (lower === 'smar' || lower === 'samar') return 'समर';
  if (lower === 'patel') return 'पटेल';

  // 2. Define Mapping (Greedy Order: 3 chars -> 2 chars -> 1 char)
  // We use specific keys to distinguish between 'th' (ठ) and 'Th' (थ) as requested
  const mapping = {
    // 3-Character Sequences
    'chh': 'छ', 'Chh': 'छ', 'CHH': 'छ',

    // 2-Character Sequences (Vowels)
    'ai': 'ै', 'Ai': 'ै',
    'au': 'ौ', 'Au': 'ौ',

    // 2-Character Sequences (Consonants)
    'kh': 'ख', 'Kh': 'ख',
    'gh': 'घ', 'Gh': 'घ',
    'ch': 'च', 'Ch': 'च',
    'jh': 'झ', 'Jh': 'झ',
    'ph': 'फ', 'Ph': 'फ',
    'bh': 'भ', 'Bh': 'भ',
    
    // Specific Case Logic requested by user
    'th': 'ठ',  // Lowercase = Retroflex
    'Th': 'थ',  // Uppercase = Dental
    'dh': 'ढ', 
    'Dh': 'ध',
    'sh': 'श',
    'Sh': 'ष',

    // 1-Character (Vowels/Matras)
    'a': 'ा', 'A': 'ा',
    'i': 'ि', 'I': 'ी',
    'u': 'ु', 'U': 'ू',
    'e': 'े', 'E': 'े',
    'o': 'ो', 'O': 'ो',

    // 1-Character (Consonants)
    'k': 'क', 'K': 'क',
    'g': 'ग', 'G': 'ग',
    'j': 'ज', 'J': 'ज',
    't': 'ट', 'T': 'त', // Assuming default T=Ta
    'd': 'ड', 'D': 'द',
    'n': 'न', 'N': 'न',
    'p': 'प', 'P': 'प',
    'f': 'फ', 'F': 'फ',
    'b': 'ब', 'B': 'ब',
    'm': 'म', 'M': 'म',
    'y': 'य', 'Y': 'य',
    'r': 'र', 'R': 'र',
    'l': 'ल', 'L': 'ल',
    'v': 'व', 'V': 'व',
    'w': 'व', 'W': 'व',
    's': 'स', 'S': 'स',
    'h': 'ह', 'H': 'ह',
    ' ': ' '
  };

  let result = "";
  let i = 0;

  while (i < text.length) {
    // Look ahead 3, 2, and 1 characters
    const c3 = text.substring(i, i + 3);
    const c2 = text.substring(i, i + 2);
    const c1 = text.substring(i, i + 1);

    // CHECK 3 CHARACTERS FIRST (Greedy)
    if (c3.length === 3 && mapping[c3]) {
      result += mapping[c3];
      i += 3;
    }
    // CHECK 2 CHARACTERS NEXT
    else if (c2.length === 2 && mapping[c2]) {
      result += mapping[c2];
      i += 2;
    }
    // CHECK 1 CHARACTER LAST
    else if (mapping[c1]) {
      // Special Logic: If 'a' is the very first letter, it's usually 'अ', not 'ा'
      if (i === 0 && (c1 === 'a' || c1 === 'A')) {
         result += 'अ';
      } else {
         result += mapping[c1];
      }
      i += 1;
    }
    // NO MATCH (Keep original)
    else {
      result += c1;
      i += 1;
    }
  }
  return result;
};

// --- 3. CSS STYLES ---
const styles = `
  .modern-node {
    padding: 60px 100px;
    border-radius: 50px;
    min-width: 900px;
    min-height: 350px;   
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 220px;    
    font-weight: 200;
    color: #2c1a0b;
    background: linear-gradient(135deg, #e2b97c 0%, #f3dca6 100%);
    border: 8px solid rgba(139, 69, 19, 0.3);
    box-shadow: 0 10px 20px -2px rgba(0, 0, 0, 0.2);
    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    transform-origin: center center;
    z-index: 10;
  }
  .modern-node:hover {
    transform: scale(1.8) !important;
    box-shadow: 0 80px 100px -10px rgba(0, 0, 0, 0.6);
    z-index: 999999 !important;
    border-color: #000;
    cursor: pointer;
    background: linear-gradient(135deg, #fff0d1 0%, #ffdea8 100%);
  }
  .modern-node.is-selected {
    background: linear-gradient(135deg, #ff9900 0%, #ffc266 100%);
    border: 12px solid #cc5200;
    color: #331400;
    transform: scale(1.1);
    box-shadow: 0 0 50px rgba(255, 136, 0, 0.8);
    z-index: 101;
  }
  .modern-node.is-child { background: linear-gradient(135deg, #ffdb4d 0%, #ffe680 100%); border: 10px solid #ffaa00; }
  .modern-node.is-ancestor { background: linear-gradient(135deg, #4dd2ff 0%, #99e6ff 100%); border: 10px solid #0077b3; color: #00334d; }

  .veda-node {
    width: ${VEDA_WIDTH}px; height: ${VEDA_ESTIMATED_HEIGHT}px;
    display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
    pointer-events: none; overflow: visible; 
  }
  .veda-node img {
    width: 100%; height: 100%; object-fit: contain; object-position: bottom center;
    filter: drop-shadow(0 20px 30px rgba(0,0,0,0.4));
    pointer-events: auto;
    transition: all 1.2s cubic-bezier(0.25, 0.8, 0.25, 1);
    transform-origin: bottom center; 
  }

  .details-card {
    background: rgba(255, 255, 255, 0.95); 
    padding: 20px 30px; 
    border-radius: 20px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2); 
    border: 2px solid #ff9900;
    max-width: 400px; 
    margin-top: 20px; /* Gap between search bar and details */
    animation: slideIn 0.5s ease;
    backdrop-filter: blur(10px);
  }
  @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .details-title { font-size: 32px; font-weight: bold; color: #8B4513; margin-bottom: 10px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
  .details-info { font-size: 18px; color: #555; line-height: 1.6; }
  ::placeholder { color: #8B4513; opacity: 0.6; }
`;

// --- 4. CUSTOM NODE COMPONENTS ---
const ModernNode = React.memo(({ data }) => {
  let className = 'modern-node';
  if (data.isClicked) className += ' is-selected';
  else if (data.isAncestor) className += ' is-ancestor';
  else if (data.isChild) className += ' is-child';

  return (
    <div className={className}>
      <Handle type="target" position={Position.Top} style={{ background: 'transparent', border: 'none' }} />
      <div style={{ textAlign: 'center', lineHeight: '1.1' }}>{data.label}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: 'transparent', border: 'none' }} />
    </div>
  );
});

const VedaNode = React.memo(({ data }) => {
  return (
    <div className='veda-node'>
      <img src="https://hamarepurvaj.mountreachfarmer.com/veda.png" alt="Veda" />
      <Handle type="source" position={Position.Bottom} style={{ background: 'transparent', border: 'none' }} />
    </div>
  );
});

// --- 5. DATA PROCESSING ---
const processNodes = (nodes) => {
  const GRAPH_CENTER_X = 0; const X_MULTIPLIER = 12.0; const Y_MULTIPLIER = 5.0;  
  const rootNode = nodes.find(n => n.id === '1');
  const rootRawX = rootNode ? rootNode.position.x : 500;
  const rootRawY = rootNode ? rootNode.position.y : 0;

  return nodes.map(node => {
    if (node.id === 'veda') return node;
    let rawX = node.position.x; let rawY = node.position.y;
    const distanceFromRootX = rawX - rootRawX; const distanceFromRootY = rawY - rootRawY;
    const newX = GRAPH_CENTER_X + (distanceFromRootX * X_MULTIPLIER);
    const newY = TREE_START_Y + (distanceFromRootY * Y_MULTIPLIER);
    return { ...node, position: { x: newX, y: newY }, type: 'modern' };
  });
};

// --- 6. RAW DATA ---
const rawNodesData = [
    {id: '1',position: { x: 200, y: 0 },data: {label: 'झींगू पटेल',}},
    {id: '2',position: { x: -200, y: 200 },data: {label: 'इसना',}},
    {id: '3',position: { x: 500, y: 200 },data: {label: 'कडू',}},
    {id: '4',position: { x: -100, y: 200 },data: {label: 'तानू',}},
    {id: '5',position: { x: 700, y: 200 },data: {label: 'बुधा',}},
    {id: '179',position: { x: 1200, y: 400 },data: {label: 'नकटू',}},
    {id: '6',position: { x: -200, y: 400 },data: {label: 'जयराम',}},
    {id: '7',position: { x: 100, y: 600 },data: {label: 'लोढू',}},
    {id: '8',position: { x: -200, y: 600 },data: {label: 'बक्सी',}},
    {id: '9',position: { x: 200, y: 400 },data: {label: 'शिवराम',}},
    {id: '10',position: { x: 400, y: 400 },data: {label: 'केउ',}},
    {id: '11',position: { x: 600, y: 600 },data: {label: 'नंदराम',}},
    {id: '12',position: { x: 800, y: 600 },data: {label: 'काशीराम',}},
    {id: '13',position: { x: 1000, y: 1000 },data: {label: 'गणेश',}},
    {id: '14',position: { x: 300, y: 600 },data: {label: 'गोविंदराम',}},
    {id: '15',position: { x: 1800, y: 800 },data: {label: 'सेगो',}},
    {id: '16',position: { x: 1200, y: 600 },data: {label: 'गणपत',}},
    {id: '17',position: { x: 1000, y: 600 },data: {label: 'नस्तो',}},
    {id: '18',position: { x: 1800, y: 600 },data: {label: 'उमराव',}},
    {id: '19',position: { x: -500, y: 800 },data: {label: 'दुर्गा',}},
    {id: '20',position: { x: -300, y: 800 },data: {label: 'मंगल',}},
    {id: '21',position: { x: -100, y: 800 },data: {label: 'परसराम',}},
    {id: '22',position: { x: -200, y: 1000 },data: {label: 'महादू',}},
    {id: '23',position: { x: 0, y: 1000 },data: {label: 'दादू',}},
    {id: '24',position: { x: -100, y: 1200 },data: {label: 'मानकलाल',}},
    {id: '25',position: { x: -200, y: 1400 },data: {label: 'बैजनाथ',}},
    {id: '26',position: { x: -400, y: 1400 },data: {label: 'गजानन्द',}},
    {id: '27',position: { x: -400, y: 1200 },data: {label: 'मंन्साराम',}},
    {id: '28',position: { x: -600, y: 1200 },data: {label: 'भोला',}},
    {id: '29',position: { x: -800, y: 1200 },data: {label: 'दरसन',}},
    {id: '30',position: { x: -600, y: 1400 },data: {label: 'शिवसिंग',}},
    {id: '31',position: { x: -800, y: 1400 },data: {label: 'मानसिंग',}},
    {id: '32',position: { x: -400, y: 1000 },data: {label: 'रंगलाल',}},
    {id: '33',position: { x: -700, y: 1000 },data: {label: 'किशन',}},
    {id: '34',position: { x: -1000, y: 1000 },data: {label: 'भदूदू',}},
    {id: '35',position: { x: -1000, y: 1200 },data: {label: 'रामसिंग',}},
    {id: '36',position: { x: -1300, y: 1400 },data: {label: 'कोमल',}},
    {id: '37',position: { x: -1300, y: 1600 },data: {label: 'नारायण',}},
    {id: '38',position: { x: -1000, y: 1400 },data: {label: 'जगदिश',}},
    {id: '39',position: { x: -1800, y: 1200 },data: {label: 'चैनसिंग',}},
    {id: '40',position: { x: -1600, y: 1200 },data: {label: 'तेजराम',}},
    {id: '41',position: { x: -1400, y: 1200 },data: {label: 'धनसिंग',}},
    {id: '42',position: { x: -1200, y: 1200 },data: {label: 'माधवसिंग',}},
    {id: '43',position: { x: -1500, y: 1400 },data: {label: 'प्रहलाद',}},
    {id: '44',position: { x: -1700, y: 1400 },data: {label: 'शिवकुमार',}},
    {id: '45',position: { x: -2100, y: 1400 },data: {label: 'दिलीप',}},
    {id: '46',position: { x: -2100, y: 1600 },data: {label: 'विजय',}},
    {id: '47',position: { x: -1900, y: 1600 },data: {label: 'अजय',}},
    {id: '48',position: { x: 1200, y: 800 },data: {label: 'सत्तू',}},
    {id: '49',position: { x: 1000, y: 800 },data: {label: 'दौलत',}},
    {id: '50',position: { x: 1400, y: 800 },data: {label: 'रामजी',}},
    {id: '51',position: { x: 1600, y: 800 },data: {label: 'कारू',}},
    {id: '52',position: { x: 1400, y: 1000 },data: {label: 'रामबगस',}},
    {id: '53',position: { x: 1600, y: 1000 },data: {label: 'फोगल',}},
    {id: '54',position: { x: 1800, y: 1000 },data: {label: 'रामकिशन',}},
    {id: '55',position: { x: 2000, y: 1000 },data: {label: 'शिवचरण',}},
    {id: '56',position: { x: 2200, y: 1000 },data: {label: 'रामचंन',}},
    {id: '57',position: { x: 2000, y: 800 },data: {label: 'अडकन',}},
    {id: '58',position: { x: 2200, y: 800 },data: {label: 'दिलबगश',}},
    {id: '59',position: { x: 2400, y: 800 },data: {label: 'लडकन',}},
    {id: '60',position: { x: 2400, y: 1000 },data: {label: 'भैयालाल',}},
    {id: '61',position: { x: 1800, y: 1200 },data: {label: 'ईश्वरी',}},
    {id: '62',position: { x: 1400, y: 1200 },data: {label: 'नारायण',}},
    {id: '63',position: { x: 1700, y: 1400 },data: {label: 'मोहनलाल',}},
    {id: '64',position: { x: 1500, y: 1400 },data: {label: 'द्वारका',}},
    {id: '65',position: { x: 1900, y: 1400 },data: {label: 'उमाशंकर',}},
    {id: '66',position: { x: 2100, y: 1200 },data: {label: 'कामता प्रसाद',}},
    {id: '67',position: { x: 2300, y: 1200 },data: {label: 'दरयाव',}},
    {id: '68',position: { x: 2500, y: 1200 },data: {label: 'taमसिंग',}},
    {id: '69',position: { x: 2100, y: 1400 },data: {label: 'मेखसिंह भारत',}},
    {id: '70',position: { x: 2300, y: 1400 },data: {label: 'सुखलाल',}},
    {id: '71',position: { x: 2500, y: 1400 },data: {label: 'तोपसिंग',}},
    {id: '72',position: { x: 2000, y: 1600 },data: {label: 'फूलचंद',}},
    {id: '73',position: { x: 2200, y: 1600 },data: {label: 'दुलीचंद',}},
    {id: '74',position: { x: 2400, y: 1600 },data: {label: 'चंदूलाल',}},
    {id: '75',position: { x: 2600, y: 1600 },data: {label: 'देवेंन्द्रसिंग',}},
    {id: '76',position: { x: 1800, y: 1600 },data: {label: 'झामसिंग',}},
    {id: '77',position: { x: 1600, y: 1600 },data: {label: 'दिगम्बर',}},
    {id: '78',position: { x: 2500, y: 1800 },data: {label: 'हेमन्त कुमार',}},
    {id: '180',position: { x: 1300, y: 1400 },data: {label: 'ईश्वरदयाल',}},
    {id: '79',position: { x: 1400, y: 1600 },data: {label: 'बैजनाथ',}},
    {id: '80',position: { x: 880, y: 1200 },data: {label: 'तेजराम',}},
    {id: '81',position: { x: 900, y: 1400 },data: {label: 'विश्वेश्वर',}},
    {id: '82',position: { x: 1100, y: 1400 },data: {label: 'जागेश्वर',}},
    {id: '83',position: { x: 1600, y: 1800 },data: {label: 'ख्यालसिंह',}},
    {id: '84',position: { x: 1800, y: 1800 },data: {label: 'ढालसिंह',}},
    {id: '85',position: { x: 2000, y: 1800 },data: {label: 'खड़गसिंह',}},
    {id: '86',position: { x: 2200, y: 1800 },data: {label: 'मदन',}},
    {id: '87',position: { x: 2300, y: 2000 },data: {label: 'आनंदसिंह',}},
    {id: '88',position: { x: 2500, y: 2000 },data: {label: 'दीलिपसिंह',}},
    {id: '89',position: { x: 2700, y: 2000 },data: {label: 'देवकीनंदन',}},
    {id: '90',position: { x: 2900, y: 2000 },data: {label: 'गजानंद',}},
    {id: '91',position: { x: 1900, y: 2000 },data: {label: 'दौलतसिंह',}},
    {id: '92',position: { x: 2100, y: 2000 },data: {label: 'शिवसिंग',}},
    {id: '93',position: { x: 2100, y: 2200 },data: {label: 'भूपेन्द्र',}},
    {id: '94',position: { x: 2300, y: 2200 },data: {label: 'मनोहर',}},
    {id: '95',position: { x: 2500, y: 2200 },data: {label: 'कन्हैया',}},
    {id: '96',position: { x: 2700, y: 2200 },data: {label: 'गौरव',}},
    {id: '97',position: { x: 2900, y: 2200 },data: {label: 'पारस',}},
    {id: '98',position: { x: 3100, y: 2200 },data: {label: 'एकांत',}},
    {id: '99',position: { x: 3300, y: 2200 },data: {label: 'डुलेन्द्र',}},
    {id: '100',position: { x: 1200, y: 1600 },data: {label: 'महेश्वर',}},
    {id: '101',position: { x: 1400, y: 1800 },data: {label: 'गौरव',}},
    {id: '102',position: { x: -300, y: 1600 },data: {label: 'मुंडाजी',}},
    {id: '103',position: { x: -100, y: 1600 },data: {label: 'उदाजी',}},
    {id: '104',position: { x: 100, y: 1600 },data: {label: 'उमेदसिंह',}},
    {id: '105',position: { x: 300, y: 1600 },data: {label: 'अमरुत',}},
    {id: '106',position: { x: 500, y: 1600 },data: {label: 'बालाराम',}},
    {id: '107',position: { x: 700, y: 1800 },data: {label: 'रामजी',}},
    {id: '108',position: { x: 800, y: 1600 },data: {label: 'साबाजी',}},
    {id: '109',position: { x: 1200, y: 1800 },data: {label: 'हृदयराम',}},
    {id: '110',position: { x: 1800, y: 2200 },data: {label: 'फागुराम',}},
    {id: '181',position: { x: 1350, y: 2200 },data: {label: 'एका',}},
    {id: '182',position: { x: 1550, y: 2200 },data: {label: 'प्रेमलाल',}},
    {id: '183',position: { x: 1550, y: 2400 },data: {label: 'काशीराम',}},
    {id: '184',position: { x: 1750, y: 2400 },data: {label: 'रामदयाल',}},
    {id: '185',position: { x: 1950, y: 2400 },data: {label: 'रामगुलाम',}},
    {id: '186',position: { x: 2150, y: 2400 },data: {label: 'रघु',}},
    {id: '187',position: { x: 2350, y: 2400 },data: {label: 'सेवकराम',}},
    {id: '188',position: { x: 1550, y: 2600 },data: {label: 'परसाराम',}},
    {id: '189',position: { x: 1750, y: 2600 },data: {label: 'कुण्डल',}},
    {id: '190',position: { x: 2050, y: 2600 },data: {label: 'अशोक',}},
    {id: '191',position: { x: 2250, y: 2600 },data: {label: 'कमल',}},
    {id: '192',position: { x: 2450, y: 2600 },data: {label: 'ढालसिंह',}},
    {id: '193',position: { x: 1750, y: 2800 },data: {label: 'पंकज',}},
    {id: '194',position: { x: 1950, y: 2800 },data: {label: 'बंटी',}},
    {id: '195',position: { x: 2150, y: 2800 },data: {label: 'ओमप्रकाश',}},
    {id: '196',position: { x: 2350, y: 2800 },data: {label: 'पवन',}},
    {id: '197',position: { x: 2550, y: 2800 },data: {label: 'तिलोक',}},
    {id: '198',position: { x: 2750, y: 2800 },data: {label: 'लोकेश',}},
    {id: '111',position: { x: 500, y: 1800 },data: {label: 'आत्माराम',}},
    {id: '112',position: { x: 950, y: 2200 },data: {label: 'दादूराम',}},
    {id: '113',position: { x: 850, y: 2400 },data: {label: 'भैयालाल',}},
    {id: '114',position: { x: 950, y: 2600 },data: {label: 'कुंजीलाल',}},
    {id: '115',position: { x: 1350, y: 2400 },data: {label: 'टुंडीलाल',}},
    {id: '116',position: { x: 1350, y: 2600 },data: {label: 'पीतम',}},
    {id: '117',position: { x: 1150, y: 2600 },data: {label: 'लक्ष्मीराम',}},
    {id: '118',position: { x: 600, y: 2200 },data: {label: 'जगतराय',}},
    {id: '119',position: { x: 450, y: 2400 },data: {label: 'रामजीवन',}},
    {id: '120',position: { x: 650, y: 2400 },data: {label: 'लक्ष्मनशा',}},
    {id: '121',position: { x: 700, y: 2600 },data: {label: 'लक्ष्मीराम',}},
    {id: '122',position: { x: 140, y: 2200 },data: {label: 'रूपचंद',}},
    {id: '123',position: { x: 300, y: 2000 },data: {label: 'रामचंद्र',}},
    {id: '124',position: { x: 250, y: 2400 },data: {label: 'दीपचंद',}},
    {id: '125',position: { x: 30, y: 2000 },data: {label: 'हरिचन्द्र',}},
    {id: '126',position: { x: 400, y: 2200 },data: {label: 'कुंजबिहारी',}},
    {id: '127',position: { x: -60, y: 2200 },data: {label: 'टीकाराम',}},
    {id: '128',position: { x: 50, y: 2400 },data: {label: 'बिहारी',}},
    {id: '129',position: { x: 300, y: 2600 },data: {label: 'यामलाल',}},
    {id: '130',position: { x: 500, y: 2600 },data: {label: 'राधेलाल',}},
    {id: '131',position: { x: 500, y: 2800 },data: {label: 'नरेंद्र',}},
    {id: '132',position: { x: -200, y: 2000 },data: {label: 'गुजोबा',}},
    {id: '133',position: { x: -50, y: 1800 },data: {label: 'बुधेधु',}},
    {id: '134',position: { x: -500, y: 2000 },data: {label: 'गोपाल',}},
    {id: '135',position: { x: -900, y: 2000 },data: {label: 'गोरेलाल',}},
    {id: '136',position: { x: -1300, y: 2000 },data: {label: 'मोहनलाल',}},
    {id: '137',position: { x: -1900, y: 2000 },data: {label: 'जीवनलाल',}},
    {id: '138',position: { x: -300, y: 2200 },data: {label: 'ईश्वर',}},
    {id: '139',position: { x: -600, y: 2200 },data: {label: 'हरिकिशन',}},
    {id: '140',position: { x: -900, y: 2200 },data: {label: 'देवीसिंह',}},
    {id: '141',position: { x: -1200, y: 2200 },data: {label: 'भरत',}},
    {id: '142',position: { x: -1400, y: 2200 },data: {label: 'निरपत',}},
    {id: '143',position: { x: -1600, y: 2200 },data: {label: 'बाबूलाल',}},
    {id: '144',position: { x: -1800, y: 2200 },data: {label: 'यादोराव',}},
    {id: '145',position: { x: -2000, y: 2200 },data: {label: 'धनसिंह',}},
    {id: '146',position: { x: -2300, y: 2200 },data: {label: 'सातलकराम',}},
    {id: '147',position: { x: -2600, y: 2200 },data: {label: 'रेवाराम',}},
    {id: '148',position: { x: 100, y: 2600 },data: {label: 'जितेंद्र',}},
    {id: '149',position: { x: -100, y: 2600 },data: {label: 'तेजसिंह',}},
    {id: '150',position: { x: -300, y: 2600 },data: {label: 'जगननाथ',}},
    {id: '151',position: { x: -500, y: 2600 },data: {label: 'चतुर्भुज',}},
    {id: '152',position: { x: -700, y: 2600 },data: {label: 'रामेश्वर',}},
    {id: '153',position: { x: -800, y: 2400 },data: {label: 'सावनलाल',}},
    {id: '154',position: { x: -1000, y: 2400 },data: {label: 'महेश',}},
    {id: '155',position: { x: -1200, y: 2400 },data: {label: 'प्रभुदयाल',}},
    {id: '156',position: { x: -1400, y: 2600 },data: {label: 'गेंदसिंह',}},
    {id: '157',position: { x: -1600, y: 2600 },data: {label: 'कमलसिंग',}},
    {id: '158',position: { x: -1700, y: 2400 },data: {label: 'देवेन्द्र',}},
    {id: '159',position: { x: -2000, y: 2600 },data: {label: 'भीखलाल',}},
    {id: '160',position: { x: -2200, y: 2600 },data: {label: 'तानसिंग',}},
    {id: '161',position: { x: -2400, y: 2600 },data: {label: 'जगेश्वर',}},
    {id: '162',position: { x: -2600, y: 2600 },data: {label: 'जयचंद',}},
    {id: '163',position: { x: -2800, y: 2600 },data: {label: 'तिलकचंद',}},
    {id: '164',position: { x: -3000, y: 2600 },data: {label: 'महेताप',}},
    {id: '165',position: { x: -200, y: 2800 },data: {label: 'मनोज',}},
    {id: '166',position: { x: -1000, y: 2800 },data: {label: 'अभिजीत',}},
    {id: '167',position: { x: -1200, y: 2800 },data: {label: 'राहुल',}},
    {id: '168',position: { x: -1400, y: 2800 },data: {label: 'कोशल',}},
    {id: '169',position: { x: -1600, y: 2800 },data: {label: 'खेवेन्द्र',}},
    {id: '170',position: { x: -1800, y: 2800 },data: {label: 'कैलाश',}},
    {id: '171',position: { x: -2000, y: 2800 },data: {label: 'हेमसिंह',}},
    {id: '172',position: { x: -2200, y: 2800 },data: {label: 'भुवनेश्‍वर',}},
    {id: '173',position: { x: -2400, y: 2800 },data: {label: 'सतेन्द्र',}},
    {id: '174',position: { x: -2600, y: 2800 },data: {label: 'अखिलेश',}},
    {id: '175',position: { x: -2800, y: 2800 },data: {label: 'राजकुमार',}},
    {id: '176',position: { x: -3000, y: 2800 },data: {label: 'गेंदसिंह',}},
    {id: '177',position: { x: -2600, y: 3000 },data: {label: 'समर',}},
    {id: '178',position: { x: -1600, y: 3000 },data: {label: 'मुकुंद',}},
];

// --- 7. ENSURE THIS IS DEFINED BEFORE HierarchyContent ---
const initialNodesWithVeda = [
  ...processNodes(rawNodesData),
  { 
    id: 'veda', 
    type: 'veda', 
    position: { x: -(VEDA_WIDTH / 2), y: VEDA_TOP_MARGIN }, 
    data: { label: 'Veda', isFocused: false }, 
    zIndex: 9999999
  }
];

const initialEdgesList = [
    { id: 'e-veda-1', source: 'veda', target: '1', style: { stroke: 'orange', strokeWidth: 5 } }, 
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e1-3', source: '1', target: '3' },
    { id: 'e1-4', source: '1', target: '4' },
    { id: 'e1-5', source: '1', target: '5' },
    { id: 'e4-6', source: '4', target: '6' },
    { id: 'e4-7', source: '4', target: '7' },
    { id: 'e4-8', source: '4', target: '8' },     
    { id: 'e4-9', source: '4', target: '9' },
    { id: 'e4-10', source: '4', target: '10' },
    { id: 'e3-6', source: '3', target: '11' },
    { id: 'e3-7', source: '3', target: '12' },
    { id: 'e3-8', source: '3', target: '13' },     
    { id: 'e3-9', source: '3', target: '14' },
    { id: 'e179', source: '5', target: '179' },
    { id: 'e5-15', source: '179', target: '15' },
    { id: 'e5-16', source: '179', target: '16' },
    { id: 'e5-17', source: '179', target: '17' },     
    { id: 'e5-18', source: '179', target: '18' },
    { id: 'e8-19', source: '8', target: '19' },
    { id: 'e8-20', source: '8', target: '20' }, 
    { id: 'e7-21', source: '7', target: '21' },
    { id: 'e21-22', source: '21', target: '22' },
    { id: 'e21-23', source: '21', target: '23' },
    { id: 'e23-24', source: '23', target: '24' },
    { id: 'e24-25', source: '24', target: '25' },
    { id: 'e24-26', source: '24', target: '26' },
    { id: 'e22-27', source: '22', target: '27' },
    { id: 'e22-28', source: '22', target: '28' },
    { id: 'e22-29', source: '22', target: '29' },
    { id: 'e29-30', source: '28', target: '30' },
    { id: 'e29-31', source: '28', target: '31' },
    { id: 'e32', source: '20', target: '32' },
    { id: 'e33', source: '19', target: '33' },
    { id: 'e34', source: '19', target: '34' },
    { id: 'e35', source: '33', target: '35' },
    { id: 'e36', source: '35', target: '36' },
    { id: 'e37', source: '35', target: '37' },
    { id: 'e38', source: '35', target: '38' },
    { id: 'e39', source: '34', target: '39' },
    { id: 'e40', source: '34', target: '40' },
    { id: 'e41', source: '34', target: '41' },
    { id: 'e42', source: '34', target: '42' },
    { id: 'e43', source: '41', target: '43' },
    { id: 'e44', source: '40', target: '44' },
    { id: 'e45', source: '39', target: '45' },
    { id: 'e46', source: '39', target: '46' },
    { id: 'e47', source: '39', target: '47' },
    { id: 'e48', source: '17', target: '48' },
    { id: 'e49', source: '17', target: '49' },
    { id: 'e50', source: '16', target: '50' },
    { id: 'e51', source: '16', target: '51' },
    { id: 'e52', source: '15', target: '52' },
    { id: 'e53', source: '15', target: '53' },
    { id: 'e54', source: '15', target: '54' },
    { id: 'e55', source: '15', target: '55' },
    { id: 'e56', source: '15', target: '56' },
    { id: 'e57', source: '18', target: '57' },
    { id: 'e58', source: '18', target: '58' },
    { id: 'e59', source: '18', target: '59' },
    { id: 'e60', source: '58', target: '60' },
    { id: 'e61', source: '53', target: '61' },
    { id: 'e62', source: '53', target: '62' },
    { id: 'e63', source: '53', target: '63' },
    { id: 'e64', source: '53', target: '64' },
    { id: 'e65', source: '55', target: '65' },
    { id: 'e66', source: '56', target: '66' },
    { id: 'e67', source: '56', target: '67' },
    { id: 'e68', source: '56', target: '68' },
    { id: 'e69', source: '66', target: '69' },
    { id: 'e70', source: '67', target: '70' },
    { id: 'e71', source: '67', target: '71' },
    { id: 'e72', source: '65', target: '72' },
    { id: 'e73', source: '65', target: '73' },
    { id: 'e74', source: '65', target: '74' },
    { id: 'e75', source: '65', target: '75' },
    { id: 'e76', source: '63', target: '76' },
    { id: 'e77', source: '63', target: '77' },
    { id: 'e78', source: '73', target: '78' },
    { id: 'e79', source: '180', target: '79' },
    { id: 'e80', source: '12', target: '80' },
    { id: 'e81', source: '80', target: '81' },
    { id: 'e82', source: '80', target: '82' },
    { id: 'e83', source: '79', target: '83' },
    { id: 'e84', source: '79', target: '84' },
    { id: 'e85', source: '79', target: '85' },
    { id: 'e86', source: '79', target: '86' },
    { id: 'e87', source: '86', target: '87' },
    { id: 'e88', source: '86', target: '88' },
    { id: 'e89', source: '86', target: '89' },
    { id: 'e90', source: '86', target: '90' },
    { id: 'e91', source: '84', target: '91' },
    { id: 'e92', source: '84', target: '92' },
    { id: 'e93', source: '91', target: '93' },
    { id: 'e94', source: '92', target: '94' },
    { id: 'e95', source: '87', target: '95' },
    { id: 'e96', source: '87', target: '96' },
    { id: 'e97', source: '88', target: '97' },
    { id: 'e98', source: '89', target: '98' },
    { id: 'e99', source: '90', target: '99' },
    { id: 'e100', source: '82', target: '100' },
    { id: 'e101', source: '100', target: '101' },
    { id: 'e102', source: '14', target: '102' },
    { id: 'e103', source: '14', target: '103' },
    { id: 'e104', source: '14', target: '104' },
    { id: 'e105', source: '14', target: '105' },
    { id: 'e106', source: '14', target: '106' },
    { id: 'e107', source: '11', target: '107' },
    { id: 'e108', source: '11', target: '108' },
    { id: 'e109', source: '108', target: '109' },
    { id: 'e110', source: '108', target: '110' },
    { id: 'e111', source: '106', target: '111' },
    { id: 'e112', source: '111', target: '112' },
    { id: 'e113', source: '112', target: '113' },
    { id: 'e114', source: '112', target: '114' },
    { id: 'e115', source: '112', target: '115' },
    { id: 'e116', source: '112', target: '116' },
    { id: 'e117', source: '112', target: '117' },
    { id: 'e118', source: '105', target: '118' },
    { id: 'e119', source: '118', target: '119' },
    { id: 'e120', source: '118', target: '120' },
    { id: 'e121', source: '120', target: '121' },
    { id: 'e122', source: '104', target: '122' },
    { id: 'e123', source: '104', target: '123' },
    { id: 'e124', source: '104', target: '124' },
    { id: 'e125', source: '104', target: '125' },
    { id: 'e126', source: '123', target: '126' },
    { id: 'e127', source: '125', target: '127' },
    { id: 'e128', source: '122', target: '128' },
    { id: 'e129', source: '124', target: '129' },
    { id: 'e130', source: '124', target: '130' },
    { id: 'e131', source: '130', target: '131' },
    { id: 'e132', source: '103', target: '132' },
    { id: 'e133', source: '103', target: '133' },
    { id: 'e134', source: '102', target: '134' },
    { id: 'e135', source: '102', target: '135' },
    { id: 'e136', source: '102', target: '136' },
    { id: 'e137', source: '102', target: '137' },
    { id: 'e138', source: '134', target: '138' },
    { id: 'e139', source: '134', target: '139' },
    { id: 'e140', source: '134', target: '140' },
    { id: 'e141', source: '136', target: '141' },
    { id: 'e142', source: '136', target: '142' },
    { id: 'e143', source: '136', target: '143' },
    { id: 'e144', source: '136', target: '144' },
    { id: 'e145', source: '137', target: '145' },
    { id: 'e146', source: '137', target: '146' },
    { id: 'e147', source: '137', target: '147' },
    { id: 'e148', source: '138', target: '148' },
    { id: 'e149', source: '138', target: '149' },
    { id: 'e150', source: '139', target: '150' },
    { id: 'e151', source: '139', target: '151' },
    { id: 'e152', source: '139', target: '152' },
    { id: 'e153', source: '140', target: '153' },
    { id: 'e154', source: '141', target: '154' },
    { id: 'e155', source: '141', target: '155' },
    { id: 'e156', source: '142', target: '156' },
    { id: 'e157', source: '142', target: '157' },
    { id: 'e158', source: '142', target: '158' },
    { id: 'e159', source: '144', target: '159' },
    { id: 'e160', source: '145', target: '160' },
    { id: 'e161', source: '145', target: '161' },
    { id: 'e162', source: '146', target: '162' },
    { id: 'e163', source: '146', target: '163' },
    { id: 'e164', source: '147', target: '164' },
    { id: 'e165', source: '149', target: '165' },
    { id: 'e166', source: '156', target: '166' },
    { id: 'e167', source: '156', target: '167' },
    { id: 'e168', source: '157', target: '168' },
    { id: 'e169', source: '157', target: '169' },
    { id: 'e170', source: '159', target: '170' },
    { id: 'e171', source: '159', target: '171' },
    { id: 'e172', source: '160', target: '172' },
    { id: 'e173', source: '161', target: '173' },
    { id: 'e174', source: '162', target: '174' },
    { id: 'e175', source: '163', target: '175' },
    { id: 'e176', source: '164', target: '176' },
    { id: 'e177', source: '174', target: '177' },
    { id: 'e178', source: '169', target: '178' },
    { id: 'e180', source: '13', target: '180' },
    { id: 'e181', source: '107', target: '181' },
    { id: 'e182', source: '107', target: '182' },
    { id: 'e183', source: '181', target: '183' },
    { id: 'e184', source: '182', target: '184' },
    { id: 'e185', source: '182', target: '185' },
    { id: 'e186', source: '110', target: '186' },
    { id: 'e187', source: '110', target: '187' },
    { id: 'e188', source: '183', target: '188' },
    { id: 'e189', source: '183', target: '189' },
    { id: 'e190', source: '186', target: '190' },
    { id: 'e191', source: '187', target: '191' },
    { id: 'e192', source: '187', target: '192' },
    { id: 'e193', source: '190', target: '193' },
    { id: 'e194', source: '190', target: '194' },
    { id: 'e195', source: '191', target: '195' },
    { id: 'e196', source: '191', target: '196' },
    { id: 'e197', source: '191', target: '197' },
    { id: 'e198', source: '192', target: '198' },
];

const defaultEdges = initialEdgesList.map(edge => ({
    ...edge,
    style: edge.style || { stroke: 'hsl(0, 84%, 44%)', strokeWidth: 4, opacity: 1 },
    animated: false
}));

// --- 7. MAIN LOGIC ---
function HierarchyContent() {
  const nodeTypes = useMemo(() => ({ modern: ModernNode, veda: VedaNode }), []);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodesWithVeda);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const { fitView, getViewport } = useReactFlow();

  const [searchText, setSearchText] = useState("");
  const [selectedInfo, setSelectedInfo] = useState(null); 

  // --- NEW: UI VISIBILITY STATE ---
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [isVedaOnScreen, setIsVedaOnScreen] = useState(true);
  const idleTimerRef = useRef(null);

  // --- NEW: HANDLERS FOR HIDING/SHOWING UI ---
  const handleInteractionStart = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setIsUiVisible(false);
  }, []);

  const handleInteractionEnd = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsUiVisible(true);
    }, 1000); 
  }, []);

  // --- NEW: ON MOVE HANDLER (Checks Visibility) ---
  const onMove = useCallback(() => {
    // 1. Interaction Logic
    handleInteractionStart();
    
    // 2. Veda Visibility Logic
    const { x, y, zoom } = getViewport();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    // Veda Node World Coordinates (Known Constants)
    const vX = -(VEDA_WIDTH / 2);
    const vY = VEDA_TOP_MARGIN;
    const vW = VEDA_WIDTH;
    const vH = VEDA_ESTIMATED_HEIGHT;
    
    // Convert to Screen Coordinates
    const screenX = x + vX * zoom;
    const screenY = y + vY * zoom;
    const screenW = vW * zoom;
    const screenH = vH * zoom;
    
    // Check Intersection
    const isVisible = (
        screenX < vw &&
        screenX + screenW > 0 &&
        screenY < vh &&
        screenY + screenH > 0
    );
    
    setIsVedaOnScreen(isVisible);
  }, [getViewport, handleInteractionStart]);

  const onConnect = useCallback(
    (params) => setEdges((els) => addEdge(params, els)),
    [setEdges]
  );

  const handleNodeSelection = useCallback((targetNodeId) => {
    if (targetNodeId === 'veda') return;

    handleInteractionStart();

    const targetNodeData = rawNodesData.find(n => n.id === targetNodeId);
    if(targetNodeData) {
        setSelectedInfo(targetNodeData.data);
    }

    const getAllAncestors = (nodeId) => {
        const ancestors = [];
        let currentId = nodeId;
        while (true) {
            const parentEdge = initialEdgesList.find(e => e.target === currentId);
            if (!parentEdge) break;
            ancestors.push(parentEdge.source);
            currentId = parentEdge.source; 
        }
        return ancestors.reverse();
    };

    const childIds = initialEdgesList
      .filter(edge => edge.source === targetNodeId)
      .map(edge => edge.target);
    
    const childrenNodes = rawNodesData.filter(n => childIds.includes(n.id));
    const sortedChildren = childrenNodes.sort((a, b) => a.position.x - b.position.x);

    const ancestorIds = getAllAncestors(targetNodeId);
    const lineageIds = ['veda', ...ancestorIds, targetNodeId, ...childIds];
    const lineagePath = [...ancestorIds, targetNodeId];

    const centerX = 0; 
    const verticalGap = 800; 
    const horizontalStep = 600; 
    const childHorizontalGap = 1400; 
    const startY = 200; 

    const newPositions = {};
    let lastX = centerX;
    let lastY = startY;

    lineagePath.forEach((nodeId, index) => {
        if (index === 0) {
            newPositions[nodeId] = { x: centerX, y: startY };
            lastX = centerX;
            lastY = startY;
        } else {
            const currentNodeOriginal = rawNodesData.find(n => n.id === nodeId);
            const parentNodeOriginal = rawNodesData.find(n => n.id === lineagePath[index - 1]);
            let xOffset = 0;
            if (currentNodeOriginal && parentNodeOriginal) {
                if (currentNodeOriginal.position.x < parentNodeOriginal.position.x - 10) xOffset = -horizontalStep;
                else if (currentNodeOriginal.position.x > parentNodeOriginal.position.x + 10) xOffset = horizontalStep;
            }
            const newX = lastX + xOffset;
            const newY = lastY + verticalGap;
            newPositions[nodeId] = { x: newX, y: newY };
            lastX = newX;
            lastY = newY;
        }
    });

    const selectedNodeNewPos = newPositions[targetNodeId];
    const childrenY = selectedNodeNewPos.y + verticalGap;
    const totalChildrenWidth = sortedChildren.length * childHorizontalGap;
    const startChildrenX = selectedNodeNewPos.x - (totalChildrenWidth / 2) + (childHorizontalGap / 2);

    sortedChildren.forEach((child, index) => {
        newPositions[child.id] = { 
            x: startChildrenX + (index * childHorizontalGap),
            y: childrenY 
        };
    });

    setNodes((nds) => nds.map((node) => {
        if (node.id === 'veda') {
             return { ...node, hidden: true };
        }

        const isLineage = lineageIds.includes(node.id);
        if (!isLineage) {
            return {
                ...node,
                hidden: true,
                data: { ...node.data, isClicked: false, isAncestor: false, isChild: false }
            };
        }

        let newData = { ...node.data };
        newData.isClicked = (node.id === targetNodeId);
        newData.isAncestor = ancestorIds.includes(node.id);
        newData.isChild = childIds.includes(node.id);

        return {
            ...node,
            hidden: false,
            position: newPositions[node.id] || node.position, 
            data: newData
        };
    }));

    setEdges((eds) => eds.map((edge) => {
        const sourceIsLineage = lineageIds.includes(edge.source);
        const targetIsLineage = lineageIds.includes(edge.target);
        
        if (edge.source === 'veda') {
             return { ...edge, hidden: true };
        }

        const isVisible = sourceIsLineage && targetIsLineage;
        return {
            ...edge,
            hidden: !isVisible,
            animated: isVisible,
            style: {
                stroke: isVisible ? '#000' : 'hsl(0, 84%, 44%)',
                strokeWidth: isVisible ? 12 : 6, 
                opacity: isVisible ? 1 : 0
            }
        };
    }));
    
    setTimeout(() => {
        fitView({ duration: 800, padding: 0.1 });
        handleInteractionEnd(); 
    }, 100);

  }, [setNodes, setEdges, fitView, handleInteractionStart, handleInteractionEnd]);

  const onNodeClick = useCallback((event, clickedNode) => {
      handleNodeSelection(clickedNode.id);
  }, [handleNodeSelection]);

  const onPaneClick = useCallback(() => {
    handleInteractionStart();

    setSelectedInfo(null);

    const resetNodes = processNodes(rawNodesData);
    setNodes([
        ...resetNodes,
        { 
            id: 'veda', type: 'veda', 
            position: { x: -(VEDA_WIDTH / 2), y: VEDA_TOP_MARGIN }, 
            data: { label: 'Veda', isFocused: false }, 
            hidden: false, zIndex: 9999999
        }
    ].map(n => ({...n, hidden:false, data:{...n.data, isClicked:false, isAncestor:false, isChild:false}})));

    setEdges((eds) => eds.map(e => ({
        ...e, hidden: false, animated: false, 
        style: e.source === 'veda' ? { stroke: 'orange', strokeWidth: 5 } : { stroke: 'hsl(0, 84%, 44%)', strokeWidth: 4, opacity: 1 }
    })));
    setTimeout(() => {
        fitView({ duration: 800, padding: 0.1 });
        handleInteractionEnd();
    }, 100);
  }, [setNodes, setEdges, fitView, handleInteractionStart, handleInteractionEnd]);

  const handleSearchChange = (e) => {
      const input = e.target.value;
      const hindiText = transliterate(input);
      setSearchText(hindiText);
  };

  const executeSearch = (e) => {
      e.preventDefault();
      const found = rawNodesData.find(n => n.data.label.includes(searchText.trim()));
      
      if (found) {
          handleNodeSelection(found.id);
      } else {
          alert(`Name "${searchText}" not found in family tree.`);
      }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#fffcf5', position: 'relative' }}>
      <style>{styles}</style>
      
      {/* --- HEADER, SEARCH BAR & DETAILS OVERLAY --- */}
      <div style={{
          position: 'absolute',
          top: '40px',
          right: selectedInfo ? 'auto' : '60px',
          left: selectedInfo ? '40px' : 'auto',
          alignItems: selectedInfo ? 'flex-start' : 'flex-end',
          
          zIndex: 100, 
          display: 'flex',
          flexDirection: 'column',
          
          // --- VISIBILITY LOGIC (Both conditions must be true) ---
          opacity: (isUiVisible && isVedaOnScreen) ? 1 : 0, 
          pointerEvents: (isUiVisible && isVedaOnScreen) ? 'auto' : 'none', 
          transition: 'opacity 0.3s ease-in-out'
      }}>
          <h1 style={{
              fontFamily: "'Playfair Display', serif", 
              fontSize: '60px',
              fontWeight: 'bold',
              background: 'linear-gradient(to bottom, #8B4513 0%, #D2691E 100%)', 
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              filter: 'drop-shadow(2px 2px 3px rgba(0,0,0,0.1))',
              letterSpacing: '1px'
          }}>
              वंशावली
          </h1>

          <div style={{
              width: '220px', 
              height: '3px',
              background: 'linear-gradient(90deg, transparent, #8B4513, transparent)',
              marginTop: '10px',
              marginBottom: '20px',
              borderRadius: '2px',
              opacity: 0.7
          }} />
          
          <form onSubmit={executeSearch} style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="नाम खोजें..." 
              value={searchText}
              onChange={handleSearchChange}
              style={{
                  background: 'rgba(255, 252, 245, 0.7)',
                  border: '2px solid #8B4513',
                  borderRadius: '25px',
                  padding: '10px 20px',
                  fontSize: '16px',
                  color: '#5c3a21',
                  outline: 'none',
                  width: '220px', 
                  backdropFilter: 'blur(5px)',
                  boxShadow: '0 4px 10px rgba(139, 69, 19, 0.1)',
                  transition: 'all 0.3s ease'
              }}
              onFocus={(e) => e.target.style.boxShadow = '0 6px 15px rgba(139, 69, 19, 0.2)'}
              onBlur={(e) => e.target.style.boxShadow = '0 4px 10px rgba(139, 69, 19, 0.1)'}
            />
          </form>

          {selectedInfo && (
                <div className="details-card">
                    <div className="details-title">{selectedInfo.label}</div>
                    <div className="details-info">
                        This is the selected member of the family tree.<br/>
                        (Additional details can be added here)
                    </div>
                </div>
          )}
      </div>
        

      {/* TOP LEFT ANIMATION (Only when nothing selected) */}
      {!selectedInfo && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: '-12%',    
          width: '70%',    
          height: '55%',    
          zIndex: 4,      
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          
          // --- VISIBILITY LOGIC ---
          opacity: (isUiVisible && isVedaOnScreen) ? 1 : 0, 
          pointerEvents: 'none', 
          transition: 'opacity 0.3s ease-in-out'
        }}>
          <DotLottieReact
            src="/1st.lottie"  
            loop
            autoplay
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      )}

      {/* BOTTOM RIGHT ANIMATION (Only when selected) */}
      {selectedInfo && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '500px',
          height: '500px',
          zIndex: 5,
          pointerEvents: 'none',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
          
          // --- VISIBILITY LOGIC ---
          opacity: (isUiVisible && isVedaOnScreen) ? 1 : 0, 
          transition: 'opacity 0.3s ease-in-out'
        }}>
          <DotLottieReact
            src="/tree.lottie" 
            loop
            autoplay
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      )}

      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        nodeTypes={nodeTypes} 
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick} 
        onPaneClick={onPaneClick}
        minZoom={.05}
        maxZoom={12} 
        onConnect={onConnect}
        fitView
        
        // --- HANDLERS ---
        onMove={onMove}          // Checks Visibility continuously
        onMoveEnd={handleInteractionEnd} // Resets Idle state
      >
        <Background color="#ccc" gap={33} size={1} />
      </ReactFlow>
    </div>
  )
}

export default function Hierarchy() {
  return (
    <ReactFlowProvider>
      <HierarchyContent />
    </ReactFlowProvider>
  ); 
}