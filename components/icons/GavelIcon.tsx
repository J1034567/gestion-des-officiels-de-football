import React from 'react';

const GavelIcon: React.FC<React.SVGProps<SVGSVGElement> & { title?: string }> = ({ title, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M10.25,2.5 L13.75,2.5 L13.75,6.5 L20.75,6.5 L20.75,9.5 L13.75,9.5 L13.75,18.5 L10.25,18.5 L10.25,9.5 L3.25,9.5 L3.25,6.5 L10.25,6.5 L10.25,2.5 Z" />
    <path d="M3,20 H21 V22 H3 Z" />
  </svg>
);

export default GavelIcon;
