import React from 'react';

const ImportIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor" 
    {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3.75 18A2.25 2.25 0 006 20.25h12A2.25 2.25 0 0020.25 18v-2.25a2.25 2.25 0 00-2.25-2.25H15M3.75 18H6m12 0h2.25" />
  </svg>
);

export default ImportIcon;
