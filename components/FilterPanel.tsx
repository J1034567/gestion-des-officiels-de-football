import React, { useState, useEffect, useMemo } from 'react';
import { League, LeagueGroup, Stadium, MatchStatus, Team } from '../types';
import CloseIcon from './icons/CloseIcon';
import DatePicker from './DatePicker';

export interface Filters {
  searchTerm: string;
  assignmentStatus: 'all' | 'complete' | 'partial' | 'empty';
  commStatus: 'all' | 'sent' | 'unsent' | 'not_sent';
  matchStatus: MatchStatus | 'all';
  teamId: string;
  stadiumId: string;
  dateRange: {
    start: string;
    end: string;
  };
}

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  stadiums: Stadium[];
  teams: Team[];
  appliedFilters: Filters;
  onApplyFilters: (filters: Filters) => void;
  onClearFilters: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ isOpen, onClose, stadiums, teams, appliedFilters, onApplyFilters, onClearFilters }) => {
  const [filters, setFilters] = useState<Filters>(appliedFilters);

  useEffect(() => {
    setFilters(appliedFilters);
  }, [appliedFilters]);

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };
  
  const handleClear = () => {
    onClearFilters();
    onClose();
  }

  const handleFilterChange = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => {
      const newState = { ...prev, [key]: value };
      return newState;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-60 transition-opacity" aria-hidden="true" onClick={onClose}></div>

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-gray-800 shadow-xl flex flex-col transition-transform transform translate-x-0 animate-fade-in-right">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Filtres avancés</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-grow">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="filter-start-date" className="block text-sm font-medium text-gray-300 mb-1">Du</label>
              <DatePicker id="filter-start-date" value={filters.dateRange.start} onChange={d => handleFilterChange('dateRange', { ...filters.dateRange, start: d })} />
            </div>
            <div>
              <label htmlFor="filter-end-date" className="block text-sm font-medium text-gray-300 mb-1">Au</label>
              <DatePicker id="filter-end-date" value={filters.dateRange.end} onChange={d => handleFilterChange('dateRange', { ...filters.dateRange, end: d })} />
            </div>
          </div>

          {/* Match Status */}
          <div>
            <label htmlFor="filter-match-status" className="block text-sm font-medium text-gray-300 mb-1">Statut du match</label>
            <select id="filter-match-status" value={filters.matchStatus} onChange={e => handleFilterChange('matchStatus', e.target.value as (MatchStatus | 'all'))} className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white">
                <option value="all">Tous les statuts</option>
                {Object.values(MatchStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          {/* Team */}
          <div>
            <label htmlFor="filter-team" className="block text-sm font-medium text-gray-300 mb-1">Équipe</label>
            <select id="filter-team" value={filters.teamId} onChange={e => handleFilterChange('teamId', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white">
                <option value="all">Toutes les équipes</option>
                {teams.filter(t => !t.isArchived).sort((a,b) => a.name.localeCompare(b.name)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Stadium */}
          <div>
            <label htmlFor="filter-stadium" className="block text-sm font-medium text-gray-300 mb-1">Stade</label>
            <select id="filter-stadium" value={filters.stadiumId} onChange={e => handleFilterChange('stadiumId', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white">
                <option value="all">Tous les stades</option>
                {stadiums.filter(s => !s.isArchived).sort((a, b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          
          {/* Assignment Status */}
          <div>
            <label htmlFor="filter-assignment-status" className="block text-sm font-medium text-gray-300 mb-1">Statut de désignation</label>
            <select id="filter-assignment-status" value={filters.assignmentStatus} onChange={e => handleFilterChange('assignmentStatus', e.target.value as any)} className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white">
                <option value="all">Tout</option>
                <option value="complete">Complètes</option>
                <option value="partial">Partielles</option>
                <option value="empty">Vides</option>
            </select>
          </div>

          {/* Communication Status */}
          <div>
            <label htmlFor="filter-comm-status" className="block text-sm font-medium text-gray-300 mb-1">Statut de communication</label>
            <select id="filter-comm-status" value={filters.commStatus} onChange={e => handleFilterChange('commStatus', e.target.value as any)} className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white">
                <option value="all">Tout</option>
                <option value="sent">Envoyée</option>
                <option value="unsent">Changements non-envoyés</option>
                <option value="not_sent">Jamais envoyée</option>
            </select>
          </div>
        </div>

        <div className="p-6 bg-gray-900/50 border-t border-gray-700 flex justify-between">
          <button onClick={handleClear} className="text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
            Effacer les filtres
          </button>
          <button onClick={handleApply} className="text-sm bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors">
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;