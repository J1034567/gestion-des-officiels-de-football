import React, { useState, useRef, useEffect, useMemo } from 'react';
import Calendar from './Calendar';
import CalendarIcon from './icons/CalendarIcon';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, id, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const formattedDate = useMemo(() => {
      if (!value) return '';
      try {
          const date = new Date(`${value}T12:00:00`);
          return date.toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
          });
      } catch (e) {
          return '';
      }
  }, [value]);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);


  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          id={id}
          value={formattedDate}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          readOnly
          disabled={disabled}
          placeholder="JJ/MM/AAAA"
          className="block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm disabled:opacity-50 disabled:bg-gray-700 cursor-pointer"
        />
      </div>
      {isOpen && !disabled && (
        <div className="absolute z-10 mt-2">
          <Calendar 
            value={value} 
            onChange={onChange}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
};

export default DatePicker;