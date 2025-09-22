import React from 'react';

const UsersGroupIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        strokeWidth={1.5} 
        stroke="currentColor" 
        {...props}
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.962c.57-1.023 1.535-1.85 2.7-2.343m-3.235 5.263c5.283 0 9.57-3.69 9.57-8.25 0-2.864-1.637-5.4-4-6.832m-11.17 0a9.049 9.049 0 0111.17 0c-2.363 1.432-4 3.968-4 6.832 0 4.56 4.287 8.25 9.57 8.25" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75a.75.75 0 100-1.5.75.75 0 000 1.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.75a.75.75 0 100-1.5.75.75 0 000 1.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 9.75a.75.75 0 100-1.5.75.75 0 000 1.5z" />
    </svg>
);

export default UsersGroupIcon;