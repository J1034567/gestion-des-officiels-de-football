
import React, { useState, useMemo, useRef, useEffect } from 'react';
import SearchIcon from './icons/SearchIcon';
import CloseIcon from './icons/CloseIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Sélectionner...',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => options.find(option => option.value === value), [options, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lowercasedFilter = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return options.filter(option =>
      option.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lowercasedFilter)
    );
  }, [options, searchTerm]);

  const handleSelect = (option: Option) => {
    onChange(option.value);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setSearchTerm('');
      inputRef.current?.focus();
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : selectedOption?.label || ''}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedOption?.label || placeholder}
          disabled={disabled}
          className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary disabled:opacity-50"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {value && !disabled && (
                <button type="button" onClick={handleClear} className="p-1 text-gray-500 hover:text-white">
                    <CloseIcon className="h-4 w-4" />
                </button>
            )}
            <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {filteredOptions.length > 0 ? (
            filteredOptions.map(option => (
              <button
                type="button"
                key={option.value}
                onClick={() => handleSelect(option)}
                className="text-left w-full px-4 py-2 text-sm text-white hover:bg-brand-primary/20"
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-4 py-2 text-sm text-gray-400">Aucun résultat.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;