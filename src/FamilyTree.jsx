import React, { useState, useEffect } from "react";

// Make sure these names match your actual files!
import Hierarchy from "./Hierarchy"; 
import MobileHierarchy from "./MobileHierarchy"; 

export default function FamilyTree() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {isMobile ? <MobileHierarchy /> : <Hierarchy />}
    </>
  );
}