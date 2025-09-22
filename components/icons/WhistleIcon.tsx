import React from 'react';

const WhistleIcon: React.FC<React.SVGProps<SVGSVGElement> & { title?: string }> = ({ title, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" {...props}>
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V9.75a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 9.75v8.25A2.25 2.25 0 006 20.25z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75v3M15 3.75v3" />
    </svg>
);

export default WhistleIcon;