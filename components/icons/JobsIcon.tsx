import React from "react";

interface JobsIconProps {
  size?: number;
  className?: string;
}

export const JobsIcon: React.FC<JobsIconProps> = ({ size = 20, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="4" width="18" height="14" rx="2" ry="2" />
    <path d="M8 2h8v4H8z" />
    <path d="M12 11h6" />
    <path d="M12 15h6" />
    <path d="M6 11h.01" />
    <path d="M6 15h.01" />
  </svg>
);

export default JobsIcon;
