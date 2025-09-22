import React from 'react';

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange, label }) => {
  return (
    <label className="flex items-center cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={enabled}
          onChange={() => onChange(!enabled)}
        />
        <div className={`block w-14 h-8 rounded-full transition-colors ${enabled ? 'bg-brand-primary' : 'bg-gray-600'}`}></div>
        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${enabled ? 'translate-x-6' : ''}`}></div>
      </div>
      {label && <span className="ml-3 text-sm font-medium text-gray-300">{label}</span>}
    </label>
  );
};

export default ToggleSwitch;
