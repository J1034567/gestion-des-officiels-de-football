
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Official, Unavailability, User, Location, Match } from '../types';
import OfficialCard from './OfficialCard';
import OfficialModal from './OfficialModal';
import AvailabilityModal from './AvailabilityModal';
import PlusIcon from './icons/PlusIcon';
import SearchIcon from './icons/SearchIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import { Permissions } from '../hooks/usePermissions';
import BulkLocationModal from './BulkLocationModal';
import PencilIcon from './icons/PencilIcon';
import CloseIcon from './icons/CloseIcon';
import LayoutDashboardIcon from './icons/LayoutDashboardIcon';
import ListBulletIcon from './icons/ListBulletIcon';
import CalendarDaysIcon from './icons/CalendarDaysIcon';
import TrashIcon from './icons/TrashIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import ConfirmationModal from './ConfirmationModal';
import BulkMessageModal from './BulkMessageModal';
import EnvelopeIcon from './icons/EnvelopeIcon';
import LocationPinIcon from './icons/LocationPinIcon';
import UsersIcon from './icons/UsersIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import OfficialDetailView from './OfficialDetailView';

type GroupByKey = 'location' | 'category' | 'profileStatus';
type SortKey = 'fullName' | 'category' | 'location' | 'availability' | 'profileStatus' | 'createdAt';

interface OfficialsViewProps {
  officials: Official[];
  matches: Match[];
  officialCategories: string[];
  localisations: Location[];
  onUpdateUnavailabilities: (officialId: string, unavailabilities: Unavailability[]) => void;
  onSaveOfficial: (official: Official) => Promise<void>;
  onArchiveOfficial: (officialId: string) => void;
  onBulkUpdateOfficialLocations: (officialIds: string[], newLocationId: string) => void;
  onBulkArchiveOfficials: (officialIds: string[]) => void;
  onBulkUpdateOfficialCategory: (officialIds: string[], newCategory: string) => void;
  onSendBulkMessage: (officialIds: string[], subject: string, message: string) => void;
  currentUser: User;
  permissions: Permissions;
  logAction: (action: string, details?: {tableName?: string, recordId?: string | null}) => Promise<void>;
}

const isUnavailableOnDate = (official: Official, date: Date | null): boolean => {
    if (!date) return false;
    const checkDate = new Date(date);
    checkDate.setHours(12, 0, 0, 0);
    return official.unavailabilities.some(unavailability => {
        const startDate = new Date(unavailability.startDate);
        const endDate = new Date(unavailability.endDate);
        startDate.setHours(12, 0, 0, 0);
        endDate.setHours(12, 0, 0, 0);
        return checkDate >= startDate && checkDate <= endDate;
    });
};

const getIncompleteProfileFields = (official: Official): string[] => {
    const missingFields: string[] = [];
    const hasValue = (field: string | null | undefined): boolean => {
        if (!field) return false;
        const trimmed = field.trim();
        return trimmed !== '' && trimmed.toLowerCase() !== 'null' && trimmed.toLowerCase() !== 'undefined';
    };
    
    if (!official.locationId) missingFields.push('Localisation complète');
    if (!hasValue(official.email)) missingFields.push('Email');
    if (!hasValue(official.phone)) missingFields.push('Téléphone');
    if (!hasValue(official.bankAccountNumber)) missingFields.push('N° de compte');
    
    return missingFields;
};

type SmartFilter = 'all' | 'incomplete' | 'available' | 'missingEmail' | 'topUnavailableNextWeekend' | 'assignedWithIncompleteProfile';

const smartFilterLabels: Record<SmartFilter, string> = {
    all: 'Tous les officiels',
    incomplete: 'Profils Incomplets',
    available: 'Officiels Disponibles',
    missingEmail: 'Officiels sans email',
    topUnavailableNextWeekend: 'Top officiels indisponibles le week-end prochain',
    assignedWithIncompleteProfile: 'Officiels assignés avec profil incomplet',
};

// --- Helper Functions ---
const getNextWeekend = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    const friday = new Date(today);
    friday.setDate(today.getDate() + daysUntilFriday);
    friday.setHours(0, 0, 0, 0);
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);
    sunday.setHours(23, 59, 59, 999);
    return { friday, sunday };
};

// --- Sub-components ---

const ActionCenter: React.FC<{
    officials: Official[];
    matches: Match[];
    officialCategories: string[];
    onFilterSelect: (filter: SmartFilter) => void;
}> = ({ officials, matches, officialCategories, onFilterSelect }) => {
    const actions = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);

        // 1. Missing emails
        const missingEmailOfficials = officials.filter(o => !o.email || o.email.trim() === '');

        // 2. Top-category officials unavailable next weekend
        const topCategory = officialCategories[0];
        let topUnavailableOfficials: Official[] = [];
        if (topCategory) {
            const { friday, sunday } = getNextWeekend();
            topUnavailableOfficials = officials.filter(o => {
                if (o.category !== topCategory) return false;
                return o.unavailabilities.some(unav => {
                    const start = new Date(unav.startDate);
                    const end = new Date(unav.endDate);
                    return start <= sunday && end >= friday;
                });
            });
        }

        // 3. Officials assigned to upcoming matches with incomplete profiles
        const upcomingMatchOfficialIds = new Set(
            matches
                .filter(m => m.matchDate && new Date(m.matchDate) >= today)
                .flatMap(m => m.assignments)
                .map(a => a.officialId)
                .filter((id): id is string => !!id)
        );
        const assignedWithIncompleteProfile = officials.filter(
            o => upcomingMatchOfficialIds.has(o.id) && getIncompleteProfileFields(o).length > 0
        );

        const items = [];
        if (assignedWithIncompleteProfile.length > 0) {
            items.push({
                text: `${assignedWithIncompleteProfile.length} officiel(s) assigné(s) à des matchs à venir ont un profil incomplet.`,
                filter: 'assignedWithIncompleteProfile' as SmartFilter
            });
        }
        if (topUnavailableOfficials.length > 0) {
            items.push({
                text: `${topUnavailableOfficials.length} officiel(s) de haut niveau sont indisponibles le week-end prochain.`,
                filter: 'topUnavailableNextWeekend' as SmartFilter
            });
        }
        if (missingEmailOfficials.length > 0) {
            items.push({
                text: `${missingEmailOfficials.length} officiel(s) n'ont pas d'adresse e-mail enregistrée.`,
                filter: 'missingEmail' as SmartFilter
            });
        }

        return items;

    }, [officials, matches, officialCategories]);

    if (actions.length === 0) return null;

    return (
        <div className="bg-gray-800 p-4 rounded-lg mb-6 border-l-4 border-yellow-400">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center"><AlertTriangleIcon className="h-5 w-5 mr-2 text-yellow-400" /> Centre d'Actions</h3>
            <ul className="space-y-2">
                {actions.map((action, index) => (
                    <li key={index}>
                        <button onClick={() => onFilterSelect(action.filter)} className="text-left text-yellow-300 hover:text-yellow-200 hover:underline text-sm">
                            - {action.text}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};


const StatCard: React.FC<{ title: string; value: number | string; icon: React.ReactNode; onClick: () => void; isActive: boolean }> = ({ title, value, icon, onClick, isActive }) => (
    <div 
        onClick={onClick}
        className={`bg-gray-800 p-4 rounded-lg flex items-center cursor-pointer transition-all duration-200 border-2 ${isActive ? 'border-brand-primary shadow-lg' : 'border-transparent hover:border-gray-700'}`}
    >
        <div className="p-3 rounded-full bg-gray-700 mr-4">
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
);


const OfficialsView: React.FC<OfficialsViewProps> = (props) => {
    const { 
        officials, matches, officialCategories, localisations, 
        onUpdateUnavailabilities, onSaveOfficial, onArchiveOfficial, onBulkUpdateOfficialLocations,
        onBulkArchiveOfficials, onBulkUpdateOfficialCategory, onSendBulkMessage,
        currentUser, permissions, logAction 
    } = props;
  const [layout, setLayout] = useState<'card' | 'list'>('list');
  const [isOfficialModalOpen, setIsOfficialModalOpen] = useState(false);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [editingOfficial, setEditingOfficial] = useState<Official | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [sortOrder, setSortOrder] = useState<'name' | 'count'>('name');
  const [groupBy, setGroupBy] = useState<GroupByKey>('location');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isBulkLocationModalOpen, setIsBulkLocationModalOpen] = useState(false);
  const [officialsForBulkEdit, setOfficialsForBulkEdit] = useState<Official[]>([]);
  const [selectedOfficialIds, setSelectedOfficialIds] = useState<Set<string>>(new Set());
  const [listSortConfig, setListSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });

  // State for new bulk actions
  const [isBulkArchiveModalOpen, setIsBulkArchiveModalOpen] = useState(false);
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  
  const [viewingOfficial, setViewingOfficial] = useState<Official | null>(null);
  const [smartFilter, setSmartFilter] = useState<SmartFilter>('all');


  const isOfficialUser = currentUser.role === "Officiel";

  const nextUpcomingMatchDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingMatchDates = matches
        .filter(match => new Date(match.matchDate!) >= today && !match.isArchived)
        .map(match => new Date(match.matchDate!).getTime());

    if (upcomingMatchDates.length === 0) {
        return null;
    }

    return new Date(Math.min(...upcomingMatchDates));
  }, [matches]);

  const handleEdit = useCallback((official: Official) => {
    setEditingOfficial(official);
    setIsOfficialModalOpen(true);
  }, []);
  
  const handleViewDetails = useCallback((official: Official) => {
    setViewingOfficial(official);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingOfficial(null);
    setIsOfficialModalOpen(true);
  }, []);

  const handleCloseOfficialModal = useCallback(() => {
    setIsOfficialModalOpen(false);
    setEditingOfficial(null);
  }, []);

  const handleManageAvailability = useCallback((official: Official) => {
    setEditingOfficial(official);
    setIsAvailabilityModalOpen(true);
  }, []);

  const handleCloseAvailabilityModal = useCallback(() => {
    setIsAvailabilityModalOpen(false);
    setEditingOfficial(null);
  }, []);
  
  const handleOpenBulkLocationModal = useCallback(() => {
      const officialsToEdit = officials.filter(o => selectedOfficialIds.has(o.id));
      if (officialsToEdit.length > 0) {
        setOfficialsForBulkEdit(officialsToEdit);
        setIsBulkLocationModalOpen(true);
      }
  }, [officials, selectedOfficialIds]);

  const handleCloseBulkLocationModal = useCallback(() => {
      setIsBulkLocationModalOpen(false);
      setOfficialsForBulkEdit([]);
  }, []);
  
  const handleSaveBulkLocation = (officialIds: string[], newLocationId: string) => {
    onBulkUpdateOfficialLocations(officialIds, newLocationId);
    setSelectedOfficialIds(new Set());
  };
  
  const handleSelectOfficial = useCallback((officialId: string) => {
    setSelectedOfficialIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(officialId)) {
            newSet.delete(officialId);
        } else {
            newSet.add(officialId);
        }
        return newSet;
    });
  }, []);
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOfficialIds(new Set(sortedOfficialsForList.map(o => o.id)));
    } else {
      setSelectedOfficialIds(new Set());
    }
  };

  const handleConfirmBulkArchive = () => {
    onBulkArchiveOfficials(Array.from(selectedOfficialIds));
    setIsBulkArchiveModalOpen(false);
    setSelectedOfficialIds(new Set());
  };

  const handleApplyBulkCategory = () => {
      if (!bulkCategory) return;
      onBulkUpdateOfficialCategory(Array.from(selectedOfficialIds), bulkCategory);
      setBulkCategory('');
      setSelectedOfficialIds(new Set());
  };

  const handleSendBulkMessage = (subject: string, message: string) => {
      onSendBulkMessage(Array.from(selectedOfficialIds), subject, message);
      setIsBulkMessageModalOpen(false);
      setSelectedOfficialIds(new Set());
  };

  const handleSmartFilterClick = (filter: SmartFilter) => {
      setSmartFilter(prev => prev === filter ? 'all' : filter);
      // Reset manual filters for clarity when a smart filter is applied
      setAvailabilityFilter('all');
      setSearchTerm('');
  };

  const activeOfficials = officials.filter(o => !o.isArchived && o.isActive);
  
  const stats = useMemo(() => {
    const total = activeOfficials.length;
    const available = activeOfficials.filter(o => !isUnavailableOnDate(o, nextUpcomingMatchDate)).length;
    const incomplete = activeOfficials.filter(o => getIncompleteProfileFields(o).length > 0).length;
    return { total, available, incomplete };
  }, [activeOfficials, nextUpcomingMatchDate]);


  const locationMap = useMemo(() => new Map(localisations.map(loc => [loc.id, loc])), [localisations]);

  const formatLocation = useCallback((locationId: string | null): string => {
      if (!locationId) return '';
      const location = locationMap.get(locationId);
      if (!location) return 'ID Inconnu';
      if (location.wilaya_ar && location.commune_ar) {
          return `${location.wilaya_ar} - ${location.commune_ar}`;
      }
      return [location.wilaya, location.daira, location.commune].filter(Boolean).join(' / ');
  }, [locationMap]);

  const filteredOfficials = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const upcomingMatchOfficialIds = new Set(
        matches
            .filter(m => m.matchDate && new Date(m.matchDate) >= today)
            .flatMap(m => m.assignments)
            .map(a => a.officialId)
            .filter((id): id is string => !!id)
    );

    return activeOfficials.filter(o => {
      // Smart Filters
      if (smartFilter === 'incomplete' && getIncompleteProfileFields(o).length === 0) return false;
      if (smartFilter === 'available' && isUnavailableOnDate(o, nextUpcomingMatchDate)) return false;
      if (smartFilter === 'missingEmail' && (o.email && o.email.trim() !== '')) return false;
      if (smartFilter === 'assignedWithIncompleteProfile' && (!upcomingMatchOfficialIds.has(o.id) || getIncompleteProfileFields(o).length === 0)) return false;
      if (smartFilter === 'topUnavailableNextWeekend') {
          const topCategory = officialCategories[0];
          if (!topCategory || o.category !== topCategory) return false;
          const { friday, sunday } = getNextWeekend();
          const isUnavailable = o.unavailabilities.some(unav => {
              const start = new Date(unav.startDate);
              const end = new Date(unav.endDate);
              return start <= sunday && end >= friday;
          });
          if (!isUnavailable) return false;
      }
      
      // Manual Filters (can be applied on top)
      const isUnavailable = isUnavailableOnDate(o, nextUpcomingMatchDate);
      if (availabilityFilter === 'available' && isUnavailable) return false;
      if (availabilityFilter === 'unavailable' && !isUnavailable) return false;

      if (searchTerm) {
        const normalize = (str: string | null | undefined): string => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[/,-]/g, ' ');
        const searchKeywords = normalize(searchTerm).split(' ').filter(Boolean);
        const searchableText = [normalize(o.fullName), normalize(o.category), normalize(formatLocation(o.locationId)), normalize(o.email), normalize(o.phone)].join(' ');
        if (!searchKeywords.every(keyword => searchableText.includes(keyword))) return false;
      }

      return true;
    });
  }, [activeOfficials, searchTerm, availabilityFilter, smartFilter, nextUpcomingMatchDate, matches, officialCategories, formatLocation]);

  const sortedOfficialsForList = useMemo(() => {
    let sortableItems = [...filteredOfficials];
    if (listSortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        switch (listSortConfig.key) {
            case 'availability':
                aValue = isUnavailableOnDate(a, nextUpcomingMatchDate) ? 1 : 0;
                bValue = isUnavailableOnDate(b, nextUpcomingMatchDate) ? 1 : 0;
                break;
            case 'profileStatus':
                aValue = getIncompleteProfileFields(a).length > 0 ? 1 : 0;
                bValue = getIncompleteProfileFields(b).length > 0 ? 1 : 0;
                break;
            case 'location':
                aValue = formatLocation(a.locationId);
                bValue = formatLocation(b.locationId);
                break;
            default:
                aValue = a[listSortConfig.key as keyof Official] || '';
                bValue = b[listSortConfig.key as keyof Official] || '';
                break;
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return listSortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        } else {
            if (aValue < bValue) return listSortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return listSortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        }
      });
    }
    return sortableItems;
  }, [filteredOfficials, listSortConfig, nextUpcomingMatchDate, formatLocation]);

  const requestListSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (listSortConfig && listSortConfig.key === key && listSortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setListSortConfig({ key, direction });
  };


  const groupedOfficials = useMemo(() => {
    return filteredOfficials.reduce((acc, official) => {
        let key: string;
        switch (groupBy) {
            case 'category':
                key = official.category;
                break;
            case 'profileStatus':
                key = getIncompleteProfileFields(official).length > 0 ? 'Profil Incomplet' : 'Profil Complet';
                break;
            case 'location':
            default:
                const location = official.locationId ? locationMap.get(official.locationId) : null;
                key = location?.wilaya_ar?.trim() || location?.wilaya?.trim() || 'Non spécifié';
                break;
        }
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(official);
        return acc;
    }, {} as Record<string, Official[]>);
  }, [filteredOfficials, groupBy, locationMap]);


  useEffect(() => {
    const initialExpandedState = Object.keys(groupedOfficials).reduce((acc, groupName) => {
      acc[groupName] = false;
      return acc;
    }, {} as Record<string, boolean>);
    setExpandedGroups(initialExpandedState);
  }, [searchTerm, availabilityFilter, groupBy, smartFilter]);


  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };
  
  const sortedGroupNames = useMemo(() => {
    const groupKeys = Object.keys(groupedOfficials);
    if (sortOrder === 'name') {
        return groupKeys.sort((a, b) => a.localeCompare(b));
    }
    // sortOrder === 'count'
    return groupKeys.sort((a, b) => {
        const countDiff = groupedOfficials[b].length - groupedOfficials[a].length;
        if (countDiff !== 0) {
            return countDiff;
        }
        return a.localeCompare(b); // Secondary sort by name
    });
  }, [groupedOfficials, sortOrder]);

  return (
    <>
      {viewingOfficial ? (
        <OfficialDetailView
          official={viewingOfficial}
          matches={matches}
          onClose={() => setViewingOfficial(null)}
          onEdit={handleEdit}
          onManageAvailability={handleManageAvailability}
          onSendMessage={(official) => {
              setSelectedOfficialIds(new Set([official.id]));
              setIsBulkMessageModalOpen(true);
          }}
        />
      ) : (
        <>
          <main className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
              <h2 className="text-3xl font-bold text-white">{isOfficialUser ? "Mon Profil & Disponibilités" : "Gestion des Officiels"}</h2>
              <div className="flex items-center space-x-2">
                  {!isOfficialUser && (
                      <div className="bg-gray-800 p-1 rounded-lg flex items-center">
                          <button onClick={() => setLayout('card')} className={`p-2 rounded-md transition-colors ${layout === 'card' ? 'bg-brand-primary text-white' : 'text-gray-300 hover:text-white'}`}><LayoutDashboardIcon className="h-5 w-5"/></button>
                          <button onClick={() => setLayout('list')} className={`p-2 rounded-md transition-colors ${layout === 'list' ? 'bg-brand-primary text-white' : 'text-gray-300 hover:text-white'}`}><ListBulletIcon className="h-5 w-5"/></button>
                      </div>
                  )}
                  {permissions.can('create', 'official') && (
                      <button onClick={handleAdd} className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">
                          <PlusIcon className="h-5 w-5 mr-2" />
                          Ajouter un officiel
                      </button>
                  )}
              </div>
            </div>

            {!isOfficialUser && (
                  <>
                  <ActionCenter officials={activeOfficials} matches={matches} officialCategories={officialCategories} onFilterSelect={handleSmartFilterClick} />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <StatCard title="Officiels Actifs" value={stats.total} icon={<UsersIcon className="h-8 w-8 text-blue-400" />} onClick={() => handleSmartFilterClick('all')} isActive={smartFilter === 'all'}/>
                      <StatCard title="Disponibles Prochainement" value={stats.available} icon={<CheckCircleIcon className="h-8 w-8 text-green-400" />} onClick={() => handleSmartFilterClick('available')} isActive={smartFilter === 'available'}/>
                      <StatCard title="Profils Incomplets" value={stats.incomplete} icon={<AlertTriangleIcon className="h-8 w-8 text-yellow-400" />} onClick={() => handleSmartFilterClick('incomplete')} isActive={smartFilter === 'incomplete'}/>
                  </div>
                  {smartFilter !== 'all' && (
                        <div className="bg-brand-primary/10 text-brand-primary text-sm p-3 rounded-lg flex justify-between items-center mb-4">
                            <span>Filtre actif : <span className="font-semibold">{smartFilterLabels[smartFilter]}</span></span>
                            <button onClick={() => setSmartFilter('all')} className="p-1 rounded-full hover:bg-brand-primary/20" title="Effacer le filtre">
                                <CloseIcon className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                  <div className="bg-gray-800 p-4 rounded-lg mb-6 flex flex-wrap items-center justify-between gap-4">
                      <div className="relative flex-grow max-w-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <SearchIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                              type="text"
                              placeholder="Rechercher par nom, catégorie, lieu..."
                              value={searchTerm}
                              onChange={e => setSearchTerm(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                          />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                          <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-400">Disponibilité {nextUpcomingMatchDate ? `(le ${nextUpcomingMatchDate.toLocaleDateString('fr-FR')})` : ''}:</span>
                              <button onClick={() => setAvailabilityFilter('all')} className={`px-3 py-1 text-sm rounded-full transition-colors ${availabilityFilter === 'all' ? 'bg-brand-primary text-white font-semibold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Tous</button>
                              <button onClick={() => setAvailabilityFilter('available')} className={`px-3 py-1 text-sm rounded-full transition-colors ${availabilityFilter === 'available' ? 'bg-brand-primary text-white font-semibold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Disponibles</button>
                              <button onClick={() => setAvailabilityFilter('unavailable')} className={`px-3 py-1 text-sm rounded-full transition-colors ${availabilityFilter === 'unavailable' ? 'bg-brand-primary text-white font-semibold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Indisponibles</button>
                          </div>
                          {layout === 'card' && (
                              <div className="flex items-center space-x-4">
                                  <div className="flex items-center space-x-2">
                                      <label htmlFor="official-group-by" className="text-sm font-medium text-gray-400">Grouper par:</label>
                                      <select
                                      id="official-group-by"
                                      value={groupBy}
                                      onChange={(e) => setGroupBy(e.target.value as GroupByKey)}
                                      className="bg-gray-900 border border-gray-700 rounded-md shadow-sm py-1.5 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-sm"
                                      aria-label="Grouper les officiels"
                                      >
                                      <option value="location">Lieu</option>
                                      <option value="category">Catégorie</option>
                                      <option value="profileStatus">Statut du Profil</option>
                                      </select>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                      <label htmlFor="official-sort-order" className="text-sm font-medium text-gray-400">Trier par:</label>
                                      <select
                                          id="official-sort-order"
                                          value={sortOrder}
                                          onChange={(e) => setSortOrder(e.target.value as 'name' | 'count')}
                                          className="bg-gray-900 border border-gray-700 rounded-md shadow-sm py-1.5 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-sm"
                                          aria-label="Trier les groupes d'officiels"
                                      >
                                          <option value="name">Nom du Groupe</option>
                                          <option value="count">Effectif</option>
                                      </select>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
                  </>
            )}
            
            {layout === 'card' ? (
              <div className="space-y-4">
                  {isOfficialUser ? (
                      activeOfficials.filter(o => o.userId === currentUser.id).map(official => {
                          const incompleteFields = getIncompleteProfileFields(official);
                          return (
                              <OfficialCard
                                  key={official.id}
                                  official={official}
                                  officialLocation={formatLocation(official.locationId)}
                                  nextUpcomingMatchDate={nextUpcomingMatchDate}
                                  onManageAvailability={handleManageAvailability}
                                  onEdit={handleEdit}
                                  onArchive={onArchiveOfficial}
                                  onViewDetails={handleViewDetails}
                                  permissions={permissions}
                                  currentUser={currentUser}
                                  isSelected={selectedOfficialIds.has(official.id)}
                                  onSelect={handleSelectOfficial}
                                  isProfileComplete={incompleteFields.length === 0}
                                  incompleteProfileFields={incompleteFields}
                              />
                          );
                      })
                  ) : sortedGroupNames.length > 0 ? (
                  sortedGroupNames.map(groupName => {
                      const groupOfficials = groupedOfficials[groupName];
                      const areAllInGroupSelected = groupOfficials.length > 0 && groupOfficials.every(o => selectedOfficialIds.has(o.id));
                      
                      const handleSelectAllForGroup = () => {
                          const groupIds = groupOfficials.map(o => o.id);
                          const newSelection = new Set(selectedOfficialIds);
                          if (areAllInGroupSelected) {
                              groupIds.forEach(id => newSelection.delete(id));
                          } else {
                              groupIds.forEach(id => newSelection.add(id));
                          }
                          setSelectedOfficialIds(newSelection);
                      };

                      const referees = groupOfficials.filter(o => !o.category.toLowerCase().includes('délégué'));
                      const delegates = groupOfficials.filter(o => o.category.toLowerCase().includes('délégué'));
                      const isExpanded = !!expandedGroups[groupName];

                      return (
                      <div key={groupName} className="bg-gray-800 rounded-lg transition-all duration-300">
                          <button
                          onClick={() => toggleGroup(groupName)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-700/50 hover:bg-gray-700 focus:outline-none"
                          aria-expanded={isExpanded}
                          >
                          <div className="flex items-center">
                              <input
                                  type="checkbox"
                                  checked={areAllInGroupSelected}
                                  onChange={handleSelectAllForGroup}
                                  onClick={e => e.stopPropagation()}
                                  className="h-5 w-5 rounded bg-gray-900 border-gray-600 text-brand-primary focus:ring-brand-secondary mr-4 flex-shrink-0"
                                  aria-label={`Sélectionner tous les officiels de ${groupName}`}
                              />
                              <h3 className="text-xl font-semibold text-white">{groupName}</h3>
                              <span className="ml-3 text-sm font-medium text-gray-300 bg-gray-600 px-2.5 py-0.5 rounded-full">{groupOfficials.length}</span>
                          </div>
                          <ChevronDownIcon className={`h-6 w-6 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpanded && (
                          <div className="p-4 space-y-6 animate-fade-in-up">
                              {referees.length > 0 && (
                              <div>
                                  <h4 className="text-md font-semibold text-gray-300 mb-2">Arbitres ({referees.length})</h4>
                                  <div className="space-y-4">
                                  {referees.map(official => {
                                      const incompleteFields = getIncompleteProfileFields(official);
                                      return <OfficialCard key={official.id} official={official} officialLocation={formatLocation(official.locationId)} nextUpcomingMatchDate={nextUpcomingMatchDate} onManageAvailability={handleManageAvailability} onEdit={handleEdit} onArchive={onArchiveOfficial} onViewDetails={handleViewDetails} permissions={permissions} currentUser={currentUser} isSelected={selectedOfficialIds.has(official.id)} onSelect={handleSelectOfficial} isProfileComplete={incompleteFields.length === 0} incompleteProfileFields={incompleteFields} />
                                  })}
                                  </div>
                              </div>
                              )}
                              {delegates.length > 0 && (
                              <div>
                                  <h4 className="text-md font-semibold text-gray-300 mb-2">Délégués ({delegates.length})</h4>
                                  <div className="space-y-4">
                                  {delegates.map(official => {
                                      const incompleteFields = getIncompleteProfileFields(official);
                                      return <OfficialCard key={official.id} official={official} officialLocation={formatLocation(official.locationId)} nextUpcomingMatchDate={nextUpcomingMatchDate} onManageAvailability={handleManageAvailability} onEdit={handleEdit} onArchive={onArchiveOfficial} onViewDetails={handleViewDetails} permissions={permissions} currentUser={currentUser} isSelected={selectedOfficialIds.has(official.id)} onSelect={handleSelectOfficial} isProfileComplete={incompleteFields.length === 0} incompleteProfileFields={incompleteFields} />
                                  })}
                                  </div>
                              </div>
                              )}
                          </div>
                          )}
                      </div>
                      );
                  })
                  ) : (
                  <div className="text-center py-8 bg-gray-800 rounded-lg">
                      <p className="text-gray-400">Aucun officiel ne correspond aux filtres actuels.</p>
                  </div>
                  )}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                  <div className="overflow-x-auto">
                      <table className="min-w-full">
                          <thead className="bg-gray-700">
                              <tr>
                                  <th scope="col" className="p-4"><input type="checkbox" onChange={handleSelectAll} checked={selectedOfficialIds.size === sortedOfficialsForList.length && sortedOfficialsForList.length > 0} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-brand-primary focus:ring-brand-secondary"/></th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => requestListSort('fullName')}>Nom</th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => requestListSort('category')}>Catégorie</th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => requestListSort('location')}>Localisation</th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => requestListSort('createdAt')}>Date Création</th>
                                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => requestListSort('availability')}>Disponibilité</th>
                                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => requestListSort('profileStatus')}>Profil</th>
                                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700">
                              {sortedOfficialsForList.map(official => {
                                  const isSelected = selectedOfficialIds.has(official.id);
                                  const incompleteFields = getIncompleteProfileFields(official);
                                  const isProfileComplete = incompleteFields.length === 0;
                                  const isAvailable = !isUnavailableOnDate(official, nextUpcomingMatchDate);
                                  return (
                                      <tr key={official.id} className={`transition-colors ${isSelected ? 'bg-brand-primary/10' : 'hover:bg-gray-700/50'}`}>
                                          <td className="p-4"><input type="checkbox" checked={isSelected} onChange={() => handleSelectOfficial(official.id)} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-brand-primary focus:ring-brand-secondary"/></td>
                                          <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-white cursor-pointer hover:text-brand-primary" onClick={() => handleViewDetails(official)}>{official.fullName}</div></td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{official.category}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{formatLocation(official.locationId) || <span className="italic text-yellow-500">Non spécifiée</span>}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(official.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-center">
                                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isAvailable ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                                  {isAvailable ? 'Disponible' : 'Indisponible'}
                                              </span>
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-center">
                                              {isProfileComplete ? (
                                                  <span className="text-green-400">Complet</span>
                                              ) : (
                                                  <div className="group relative flex justify-center items-center">
                                                      <span className="text-yellow-400">Incomplet</span>
                                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                                          Infos manquantes: {incompleteFields.join(', ')}
                                                      </div>
                                                  </div>
                                              )}
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                            <button onClick={() => handleEdit(official)} className="text-gray-300 hover:text-brand-primary p-1 rounded-full hover:bg-gray-700 transition-colors mr-2" title="Modifier"><PencilIcon className="h-4 w-4"/></button>
                                            <button onClick={() => handleManageAvailability(official)} className="text-gray-300 hover:text-brand-primary p-1 rounded-full hover:bg-gray-700 transition-colors" title="Gérer les disponibilités"><CalendarDaysIcon className="h-4 w-4"/></button>
                                          </td>
                                      </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>
            )}

            {selectedOfficialIds.size > 0 && !isOfficialUser && (
                <div className="fixed bottom-0 left-0 right-0 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 p-4 shadow-lg z-20 animate-fade-in-up">
                    <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                        <p className="text-white font-medium">{selectedOfficialIds.size} officiel(s) sélectionné(s)</p>
                        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                <select
                                    value={bulkCategory}
                                    onChange={(e) => setBulkCategory(e.target.value)}
                                    className="bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-sm font-medium"
                                >
                                    <option value="">Changer la catégorie...</option>
                                    {officialCategories.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleApplyBulkCategory}
                                    disabled={!bulkCategory}
                                    className="bg-gray-600 text-white font-semibold py-2 px-3 rounded-lg text-sm hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed"
                                >
                                    Appliquer
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button onClick={handleOpenBulkLocationModal} className="flex items-center text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-3 rounded-lg transition-colors">
                                    <LocationPinIcon className="h-5 w-5 mr-2"/> Localisation
                                </button>
                                <button onClick={() => setIsBulkMessageModalOpen(true)} className="flex items-center text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-3 rounded-lg transition-colors">
                                    <EnvelopeIcon className="h-5 w-5 mr-2"/> Message
                                </button>
                                <button onClick={() => setIsBulkArchiveModalOpen(true)} className="flex items-center text-sm bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors">
                                    <TrashIcon className="h-5 w-5 mr-2"/> Archiver
                                </button>
                            </div>
                            
                            <button onClick={() => setSelectedOfficialIds(new Set())} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full" title="Désélectionner tout">
                                <CloseIcon className="h-5 w-5"/>
                            </button>
                        </div>
                    </div>
                </div>
            )}
          </main>
        </>
      )}

      <OfficialModal 
        isOpen={isOfficialModalOpen}
        onClose={handleCloseOfficialModal}
        onSave={onSaveOfficial}
        officialToEdit={editingOfficial}
        officialCategories={officialCategories}
        localisations={localisations}
        officials={officials}
        permissions={permissions}
        logAction={logAction}
      />
      <AvailabilityModal
        isOpen={isAvailabilityModalOpen}
        onClose={handleCloseAvailabilityModal}
        official={editingOfficial}
        onSave={onUpdateUnavailabilities}
      />
      <BulkLocationModal 
        isOpen={isBulkLocationModalOpen}
        onClose={handleCloseBulkLocationModal}
        onSave={handleSaveBulkLocation}
        officialsToUpdate={officialsForBulkEdit}
        localisations={localisations}
      />
      <ConfirmationModal
        isOpen={isBulkArchiveModalOpen}
        onClose={() => setIsBulkArchiveModalOpen(false)}
        onConfirm={handleConfirmBulkArchive}
        title={`Archiver ${selectedOfficialIds.size} officiels`}
        message="Êtes-vous sûr de vouloir archiver les officiels sélectionnés ? Ils ne seront plus disponibles pour les désignations."
      />
      <BulkMessageModal
        isOpen={isBulkMessageModalOpen}
        onClose={() => setIsBulkMessageModalOpen(false)}
        onSend={handleSendBulkMessage}
        recipientCount={selectedOfficialIds.size}
      />
    </>
  );
};

export default OfficialsView;
