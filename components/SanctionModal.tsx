import React, { useState, useEffect, useMemo } from 'react';
import { Sanction, Player, Match, SanctionType, DisciplinarySettings } from '../types';
import CloseIcon from './icons/CloseIcon';
import DatePicker from './DatePicker';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import GavelIcon from './icons/GavelIcon';
import SearchableSelect from './SearchableSelect';

interface SanctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sanction: Partial<Sanction>) => void;
  sanctionToEdit: Sanction | null;
  players: Player[];
  matches: Match[];
  disciplinarySettings: DisciplinarySettings | null;
}

type SanctionSource = 'match' | 'commission';

const SanctionTypeButton: React.FC<{
  type: SanctionType;
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  colorClasses: string;
}> = ({ type, label, icon, selected, onClick, colorClasses }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200 ${
      selected
        ? `${colorClasses} border-opacity-100 shadow-lg scale-105`
        : 'bg-gray-700 border-gray-600 hover:border-gray-500 hover:bg-gray-600'
    }`}
  >
    <div className="h-8 w-8 mb-2">{icon}</div>
    <span className="font-semibold text-sm">{label}</span>
  </button>
);

const SanctionModal: React.FC<SanctionModalProps> = ({ isOpen, onClose, onSave, sanctionToEdit, players, matches, disciplinarySettings }) => {
  const isEditing = !!sanctionToEdit;
  
  const [step, setStep] = useState(isEditing ? 1 : 0);
  const [source, setSource] = useState<SanctionSource | null>(isEditing ? (sanctionToEdit.matchId ? 'match' : 'commission') : null);

  const [playerId, setPlayerId] = useState('');
  const [type, setType] = useState<SanctionType | null>(null);
  const [matchId, setMatchId] = useState('');
  const [decisionDate, setDecisionDate] = useState('');
  const [suspensionMatches, setSuspensionMatches] = useState<number | ''>('');
  const [fineAmount, setFineAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const sortedMatches = useMemo(() => 
    matches
        .filter(m => m.matchDate)
        .sort((a,b) => new Date(b.matchDate!).getTime() - new Date(a.matchDate!).getTime())
  , [matches]);

  useEffect(() => {
    if (!isOpen) {
        // When modal closes, fully reset all state to avoid lingering data from causing bugs
        setTimeout(() => {
            setStep(0);
            setSource(null);
            setPlayerId('');
            setType(null);
            setMatchId('');
            setDecisionDate('');
            setSuspensionMatches('');
            setFineAmount('');
            setReason('');
            setNotes('');
            setError('');
        }, 200); // Delay to allow closing animation
    } else {
        if (sanctionToEdit) {
            setStep(1);
            setSource(sanctionToEdit.matchId ? 'match' : 'commission');
            setPlayerId(sanctionToEdit.playerId);
            setType(sanctionToEdit.type);
            setMatchId(sanctionToEdit.matchId || '');
            setDecisionDate(sanctionToEdit.decisionDate);
            setSuspensionMatches(sanctionToEdit.suspensionMatches || '');
            setFineAmount(sanctionToEdit.fineAmount || '');
            setReason(sanctionToEdit.reason || '');
            setNotes(sanctionToEdit.notes || '');
        } else {
            // Reset for creation mode
            setStep(0);
            setSource(null);
        }
        setError('');
    }
  }, [isOpen, sanctionToEdit]);

  // Effect to set smart defaults when source/type/match changes in creation mode
  useEffect(() => {
    if (isOpen && !isEditing && step === 1) {
      if (source === 'commission') {
        setDecisionDate(new Date().toISOString().split('T')[0]);
        setType(SanctionType.SUSPENSION_COMMISSION);
      }
      
      if (source === 'match' && matchId) {
          const selectedMatch = matches.find(m => m.id === matchId);
          if (selectedMatch?.matchDate) {
              setDecisionDate(selectedMatch.matchDate);
          }
      }
      
      if (disciplinarySettings) {
        let defaultSuspension = 0;
        if (type === SanctionType.RED_CARD_DIRECT) {
          defaultSuspension = disciplinarySettings.directRedCardSuspension;
        } else if (type === SanctionType.RED_CARD_TWO_YELLOWS) {
          defaultSuspension = disciplinarySettings.twoYellowsRedCardSuspension;
        }
        // Only set default if field is empty
        if (suspensionMatches === '') {
          setSuspensionMatches(defaultSuspension || '');
        }
      }
    }
  }, [source, type, matchId, step, isEditing, disciplinarySettings, matches, isOpen, suspensionMatches]);
  
  const handleSelectSource = (selectedSource: SanctionSource) => {
      setSource(selectedSource);
      setStep(1);
  };
  
  const handleBack = () => {
      if (!isEditing) {
        setStep(0);
        setSource(null);
        setType(null);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId || !type || !decisionDate) {
      setError('Joueur, Type et Date de décision sont obligatoires.');
      return;
    }

    onSave({
      id: sanctionToEdit?.id,
      playerId,
      type,
      matchId: source === 'match' ? (matchId || null) : null,
      decisionDate,
      suspensionMatches: Number(suspensionMatches) || 0,
      fineAmount: Number(fineAmount) || undefined,
      reason: reason.trim() || undefined,
      notes: notes.trim() || undefined,
      isCancelled: sanctionToEdit?.isCancelled || false,
      matchesServed: sanctionToEdit?.matchesServed || 0,
    });
    onClose();
  };
  
  const playerOptions = useMemo(() => players.map(p => ({ value: p.id, label: p.fullName })), [players]);
  const matchOptions = useMemo(() => sortedMatches.map(m => ({
        value: m.id,
        label: `${new Date(m.matchDate!).toLocaleDateString('fr-FR')} - ${m.homeTeam.name} vs ${m.awayTeam.name}`
  })), [sortedMatches]);


  const renderSourceSelection = () => (
    <div className="p-6 space-y-4">
        <h3 className="text-lg font-medium text-center text-gray-300">Quelle est l'origine de cette sanction ?</h3>
        <div className="grid grid-cols-2 gap-4">
             <button
                type="button"
                onClick={() => handleSelectSource('match')}
                className="flex flex-col items-center justify-center p-6 bg-gray-700 rounded-lg border-2 border-gray-600 hover:border-brand-primary hover:bg-gray-600 transition-colors"
            >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18V3H3zm8 14H5v-2h6v2zm6-4H5v-2h14v2zm0-4H5V7h14v2z" transform="rotate(-15 12 12) scale(0.8)" /></svg>
                <span className="font-semibold text-white">Sanction de Match</span>
                <span className="text-xs text-gray-400">(Carton, etc.)</span>
            </button>
            <button
                type="button"
                onClick={() => handleSelectSource('commission')}
                className="flex flex-col items-center justify-center p-6 bg-gray-700 rounded-lg border-2 border-gray-600 hover:border-brand-primary hover:bg-gray-600 transition-colors"
            >
                <GavelIcon className="h-10 w-10 mb-2 text-purple-400" />
                <span className="font-semibold text-white">Décision de la Commission</span>
                 <span className="text-xs text-gray-400">(Suspension, amende...)</span>
            </button>
        </div>
    </div>
  );

  const renderForm = () => {
    const showSuspensionField = type === SanctionType.RED_CARD_DIRECT || type === SanctionType.RED_CARD_TWO_YELLOWS || type === SanctionType.SUSPENSION_COMMISSION;

    return (
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {!isEditing && (
             <button type="button" onClick={handleBack} className="text-sm text-gray-400 hover:text-white flex items-center">
                <ArrowLeftIcon className="h-4 w-4 mr-1"/> Changer la source
            </button>
          )}
          {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
           
           <div>
              <label htmlFor="player" className="block text-sm font-medium text-gray-300">Joueur <span className="text-red-400">*</span></label>
              <SearchableSelect
                options={playerOptions}
                value={playerId}
                onChange={(val) => setPlayerId(val || '')}
                placeholder="Rechercher un joueur..."
              />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type de Sanction <span className="text-red-400">*</span></label>
            {source === 'match' ? (
                 <div className="grid grid-cols-2 gap-4">
                    <SanctionTypeButton type={SanctionType.YELLOW_CARD} label="Carton Jaune" selected={type === SanctionType.YELLOW_CARD} onClick={() => setType(SanctionType.YELLOW_CARD)} colorClasses="bg-yellow-500 text-yellow-900 border-yellow-400" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" fill="currentColor" viewBox="0 0 24 24"><path d="M4 3h16v18H4z" transform="rotate(-15 12 12) scale(0.8)" /></svg>} />
                    <SanctionTypeButton type={SanctionType.RED_CARD_DIRECT} label="Carton Rouge" selected={type === SanctionType.RED_CARD_DIRECT || type === SanctionType.RED_CARD_TWO_YELLOWS} onClick={() => setType(SanctionType.RED_CARD_DIRECT)} colorClasses="bg-red-600 text-white border-red-500" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" fill="currentColor" viewBox="0 0 24 24"><path d="M4 3h16v18H4z" transform="rotate(-15 12 12) scale(0.8)"/></svg>} />
                </div>
            ) : (
                <SanctionTypeButton type={SanctionType.SUSPENSION_COMMISSION} label="Suspension / Amende" selected={type === SanctionType.SUSPENSION_COMMISSION} onClick={() => setType(SanctionType.SUSPENSION_COMMISSION)} colorClasses="bg-purple-600 text-white border-purple-500" icon={<GavelIcon className="h-full w-full"/>} />
            )}
          </div>
          
           {source === 'match' && (
              <div>
                  <label htmlFor="match" className="block text-sm font-medium text-gray-300">Match (Optionnel)</label>
                  <SearchableSelect
                      options={matchOptions}
                      value={matchId}
                      onChange={(val) => setMatchId(val || '')}
                      placeholder="Rechercher un match..."
                  />
              </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label htmlFor="decisionDate" className="block text-sm font-medium text-gray-300">Date de Décision <span className="text-red-400">*</span></label>
                  <DatePicker id="decisionDate" value={decisionDate} onChange={setDecisionDate} />
              </div>
               {showSuspensionField && (
                <div>
                  <label htmlFor="suspension" className="block text-sm font-medium text-gray-300">Matchs de Suspension</label>
                  <input type="number" id="suspension" value={suspensionMatches} onChange={e => setSuspensionMatches(e.target.value === '' ? '' : Number(e.target.value))} min="0" className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white" />
                </div>
               )}
            </div>
           
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-300">Notes / Motif (Optionnel)</label>
              <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white" />
            </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
          <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">Annuler</button>
          <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">{isEditing ? 'Sauvegarder' : 'Ajouter'}</button>
        </div>
      </form>
    )
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">{isEditing ? 'Modifier la Sanction' : 'Ajouter une Sanction'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><CloseIcon className="h-6 w-6" /></button>
        </div>
        {step === 0 && !isEditing ? renderSourceSelection() : renderForm()}
      </div>
    </div>
  );
};

export default SanctionModal;