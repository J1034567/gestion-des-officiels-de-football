import React from 'react';

const SitemapIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor" 
    {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21v-4.5a3.75 3.75 0 013.75-3.75h3.75m0-3.75h-3.75a3.75 3.75 0 00-3.75 3.75v4.5m0-9V3.75A3.75 3.75 0 017.5 0h3.75M12 9V3.75m0 5.25v3.75m0 0h3.75m-3.75 0h-3.75m3.75 0v3.75m0-3.75h3.75a3.75 3.75 0 013.75 3.75v4.5m-15-9h15" />
  </svg>
);

export default SitemapIcon;
