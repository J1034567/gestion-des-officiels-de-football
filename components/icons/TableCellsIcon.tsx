
import React from 'react';

const TableCellsIcon: React.FC<React.SVGProps<SVGSVGElement> & { title?: string }> = ({ title, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125H20.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h17.25m-17.25 0H3.375m0 0v-1.5m17.25 1.5v-1.5m0 0H20.625m-17.25 0h17.25M12 15.75v3.75m-3.75-3.75v3.75m7.5-3.75v3.75M3.375 12h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125V9.375c0-.621.504-1.125 1.125-1.125h17.25c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h17.25M12 8.25v3.75m-3.75-3.75v3.75m7.5-3.75v3.75m-7.5-3.75h3.75m-3.75 0H3.375m0 0V4.5A1.125 1.125 0 014.5 3.375h15A1.125 1.125 0 0120.625 4.5v3.75m-17.25 0h17.25" />
    </svg>
);

export default TableCellsIcon;
