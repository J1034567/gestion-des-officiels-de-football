import React, { useState, useMemo } from 'react';
import ChevronDownIcon from './icons/ChevronDownIcon';

interface CalendarProps {
  value: string | null;
  onChange: (date: string) => void;
  onClose: () => void;
}

const Calendar: React.FC<CalendarProps> = ({ value, onChange, onClose }) => {
  const selectedDate = useMemo(() => value ? new Date(`${value}T12:00:00`) : null, [value]);
  const [displayDate, setDisplayDate] = useState(selectedDate || new Date());

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const days = useMemo(() => {
    const d = [];
    const startOffset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    
    for (let i = 0; i < startOffset; i++) {
      d.push(<div key={`empty-start-${i}`} className="p-1"></div>);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      
      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, '0');
      const d_ = String(currentDate.getDate()).padStart(2, '0');
      const dateString = `${y}-${m}-${d_}`;

      const isSelected = selectedDate && currentDate.toDateString() === selectedDate.toDateString();
      const isToday = new Date().toDateString() === currentDate.toDateString();

      d.push(
        <button
          key={day}
          onClick={() => {
            onChange(dateString);
            onClose();
          }}
          className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors ${
            isSelected
              ? 'bg-brand-primary text-white font-bold'
              : isToday
              ? 'bg-gray-600 text-white'
              : 'text-gray-200 hover:bg-gray-700'
          }`}
        >
          {day}
        </button>
      );
    }
    return d;
  }, [year, month, daysInMonth, startingDayOfWeek, selectedDate, onChange, onClose]);

  const changeMonth = (delta: number) => {
    setDisplayDate(new Date(year, month + delta, 1));
  };
  
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const dayNames = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-4 w-72 text-white">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-700">
          <ChevronDownIcon className="h-5 w-5 rotate-90" />
        </button>
        <div className="font-semibold text-lg">{monthNames[month]} {year}</div>
        <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-700">
          <ChevronDownIcon className="h-5 w-5 -rotate-90" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
        {dayNames.map(day => <div key={day}>{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 justify-items-center">
        {days}
      </div>
    </div>
  );
};

export default Calendar;
