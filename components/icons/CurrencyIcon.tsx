import React from 'react';

const CurrencyIcon: React.FC<React.SVGProps<SVGSVGElement> & { title?: string }> = ({ title, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      {title && <title>{title}</title>}
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.75A.75.75 0 013 4.5h.75m0 0H21m-12 6.75v.75A.75.75 0 019 12h-.75m0 0v-.75A.75.75 0 019 10.5h.75m0 0h.75m-1.5 6h.75A.75.75 0 019 18v-.75m0 0v.75A.75.75 0 019 18h-.75m0 0h.75" />
    </svg>
);

export default CurrencyIcon;