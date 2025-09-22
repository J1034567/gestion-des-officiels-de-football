
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Match } from '../types';
import ChevronDownIcon from './icons/ChevronDownIcon';
import CloseIcon from './icons/CloseIcon';

interface CalendarViewProps {
  matches: Match[];
  onEditMatch: (match: Match) => void;
  onManageDay?: (date: Date) => void;
}

const getAssignmentStatus = (match: Match): 'complete' | 'partial' | 'empty' => {
  const assignedCount = match.assignments.filter(a => a.officialId).length;
  const totalSlots = match.assignments.length;
  if (totalSlots === 0) return 'empty';
  if (assignedCount === totalSlots) return 'complete';
  if (assignedCount > 0) return 'partial';
  return 'empty';
};

const statusStyles = {
  complete: { dot: 'bg-green-500' },
  partial: { dot: 'bg-yellow-500' },
  empty: { dot: 'bg-red-500' },
};

const CalendarView: React.FC<CalendarViewProps> = ({ matches, onEditMatch, onManageDay }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [popover, setPopover] = useState<{
    day: Date;
    matches: Match[];
    anchorEl: HTMLElement;
  } | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
            setPopover(null);
        }
    };

    if (popover) {
        document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popover]);


  const matchesByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    matches.forEach(match => {
        if (match.matchDate) {
            const dateKey = match.matchDate; // YYYY-MM-DD
            if (!map.has(dateKey)) {
                map.set(dateKey, []);
            }
            map.get(dateKey)!.push(match);
        }
    });
    return map;
  }, [matches]);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const calendarGrid = useMemo(() => {
    const grid: (Date | null)[] = [];
    const startOffset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    
    for (let i = 0; i < startOffset; i++) {
      grid.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      grid.push(new Date(year, month, day));
    }
    return grid;
  }, [year, month, daysInMonth, startingDayOfWeek]);

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(year, month + delta, 1));
  };
  
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  const formatDateKey = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
  };
  
  const handleDayClick = (event: React.MouseEvent<HTMLDivElement>, date: Date | null) => {
    if (!date) return;
    const matchesForDay = matchesByDate.get(formatDateKey(date)) || [];
    if (matchesForDay.length === 0) return;

    if (matchesForDay.length === 1) {
      onEditMatch(matchesForDay[0]);
    } else {
      if(popover?.anchorEl === event.currentTarget) {
          setPopover(null);
      } else {
          setPopover({ day: date, matches: matchesForDay, anchorEl: event.currentTarget });
      }
    }
  };

  const calculatePopoverStyle = (anchorEl: HTMLElement | null): React.CSSProperties => {
    if (!anchorEl) return { display: 'none' };
    const rect = anchorEl.getBoundingClientRect();
    const popoverWidth = 320; 
    const popoverMargin = 10;

    // Calculate position relative to the document by adding scroll offsets
    let top = rect.top + window.scrollY;
    let left = rect.right + window.scrollX + popoverMargin;

    // Adjust horizontal position if it overflows the viewport's right edge
    if (rect.right + popoverMargin + popoverWidth > window.innerWidth) {
      left = rect.left + window.scrollX - popoverWidth - popoverMargin;
    }

    // Adjust vertical position to prevent overflow
    // Using a ref to the popover itself to get its height is ideal,
    // but can be tricky with render cycles. An estimate is often sufficient.
    const popoverHeight = popoverRef.current?.offsetHeight || 300;
    if (rect.top + popoverHeight > window.innerHeight) {
        top = rect.bottom + window.scrollY - popoverHeight;
    }
    
    // Ensure it's not positioned above the visible screen area
    if (top < window.scrollY) {
        top = window.scrollY + popoverMargin;
    }

    return {
        position: 'absolute', // Changed from 'fixed' to 'absolute'
        top: `${top}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`,
        zIndex: 50,
    };
  };


  return (
    <>
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
            <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
            <ChevronDownIcon className="h-6 w-6 text-gray-400 rotate-90" />
            </button>
            <h2 className="text-2xl font-bold text-white">{monthNames[month]} {year}</h2>
            <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
            <ChevronDownIcon className="h-6 w-6 text-gray-400 -rotate-90" />
            </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-700 border border-gray-700 rounded-lg overflow-hidden">
            {dayNames.map(day => (
                <div key={day} className="text-center py-2 bg-gray-900 text-xs font-semibold text-gray-400 uppercase tracking-wider">{day}</div>
            ))}

            {calendarGrid.map((date, index) => {
                const isToday = date && date.toDateString() === new Date().toDateString();
                const matchesForDay = date ? matchesByDate.get(formatDateKey(date)) || [] : [];
                const MAX_EVENTS_VISIBLE = 2;
                const visibleMatches = matchesForDay.slice(0, MAX_EVENTS_VISIBLE);
                const hiddenMatchesCount = matchesForDay.length - visibleMatches.length;

                return (
                    <div 
                      key={index} 
                      className={`relative flex flex-col p-2 bg-gray-800 min-h-[140px] ${date && matchesForDay.length > 0 ? 'cursor-pointer hover:bg-gray-700/50 transition-colors' : ''} ${!date ? 'opacity-50' : ''}`}
                      onClick={(e) => handleDayClick(e, date)}
                    >
                        {date && (
                            <span className={`font-semibold text-sm self-start ${isToday ? 'bg-brand-primary text-white rounded-full h-7 w-7 flex items-center justify-center' : 'text-gray-300'}`}>
                                {date.getDate()}
                            </span>
                        )}
                        <div className="mt-2 flex-grow space-y-1 overflow-hidden">
                            {visibleMatches.map(match => {
                                const status = getAssignmentStatus(match);
                                const styles = statusStyles[status];
                                return (
                                    <div 
                                        key={match.id}
                                        className="w-full text-left p-1.5 rounded-md bg-gray-900/70"
                                    >
                                        <div className="flex items-start">
                                            <span className={`h-2 w-2 rounded-full mr-2 mt-1 flex-shrink-0 ${styles.dot}`}></span>
                                            <p className="text-xs text-white font-medium leading-tight truncate">{match.homeTeam.name} vs {match.awayTeam.name}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            {hiddenMatchesCount > 0 && (
                                <div className="text-xs text-brand-primary font-semibold p-1.5 bg-gray-900/70 rounded-md mt-1">
                                    + {hiddenMatchesCount} autre(s) match(s)
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
    
    {popover && (
        <div
          ref={popoverRef}
          style={calculatePopoverStyle(popover.anchorEl)}
          className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-80 text-white flex flex-col animate-fade-in-up"
        >
          <div className="p-3 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
            <h4 className="font-semibold">{popover.day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h4>
            <button onClick={() => setPopover(null)} className="p-1 rounded-full hover:bg-gray-700"><CloseIcon className="h-5 w-5"/></button>
          </div>
          <ul className="p-2 space-y-1 overflow-y-auto max-h-80">
            {popover.matches.map(match => {
              const status = getAssignmentStatus(match);
              const styles = statusStyles[status];
              return (
                <li key={match.id}>
                  <button 
                    onClick={() => {
                      onEditMatch(match);
                      setPopover(null);
                    }}
                    className="w-full text-left p-2 rounded-md bg-gray-900/70 hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-start">
                      <span className={`h-2 w-2 rounded-full mr-2 mt-1 flex-shrink-0 ${styles.dot}`}></span>
                      <div>
                        <p className="text-sm text-white font-medium leading-tight">{match.homeTeam.name} vs {match.awayTeam.name}</p>
                        {match.matchTime && <p className="text-xs text-gray-400 mt-0.5">{match.matchTime}</p>}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {popover.matches.length > 1 && onManageDay && (
            <div className="p-2 border-t border-gray-700">
                <button
                    onClick={() => {
                        onManageDay(popover.day);
                        setPopover(null);
                    }}
                    className="w-full text-center bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-2 px-2 rounded-md text-sm transition-colors"
                >
                    Gérer la Journée
                </button>
            </div>
          )}
        </div>
    )}
    </>
  );
};

export default CalendarView;
