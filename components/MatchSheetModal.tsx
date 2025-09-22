
import React from 'react';
import { Match, Official, Location } from '../types';
import CloseIcon from './icons/CloseIcon';
import PaperAirplaneIcon from './icons/PaperAirplaneIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import { generateMatchSheetHtml } from '../services/emailService';

interface MatchSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  officials: Official[];
  locations: Location[];
  onConfirmSend: (matchId: string) => void;
  onConfirmNotify: (matchId: string) => void;
}

const MatchSheetModal: React.FC<MatchSheetModalProps> = ({ isOpen, onClose, match, officials, locations, onConfirmSend, onConfirmNotify }) => {
  if (!isOpen || !match) return null;

  const handleConfirm = () => {
    if (match.hasUnsentChanges) {
      onConfirmNotify(match.id);
    } else {
      onConfirmSend(match.id);
    }
    onClose();
  };

  const isUpdate = match.hasUnsentChanges;
  const title = isUpdate ? "Notifier des Changements" : "Envoyer la Feuille de Route";
  const buttonText = isUpdate ? "Confirmer et Notifier" : "Confirmer et Envoyer";
  
  const { subject, html } = generateMatchSheetHtml(match, officials, isUpdate, locations);
  const assignedOfficialsEmails = match.assignments
    .map(a => officials.find(o => o.id === a.officialId)?.email)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl transform transition-all duration-300 flex flex-col">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center">
            {isUpdate ? <AlertTriangleIcon className="h-6 w-6 text-yellow-400 mr-3" /> : <PaperAirplaneIcon className="h-6 w-6 text-brand-primary mr-3" />}
            <div>
                <h2 className="text-2xl font-bold text-white">{title}</h2>
                <p className="text-sm text-gray-400">Aperçu de la communication pour les officiels</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6"/>
          </button>
        </div>
        <div className="p-6 max-h-[60vh] overflow-y-auto bg-gray-900/50 flex-grow">
            {isUpdate && (
                <div className="bg-yellow-900/50 border border-yellow-500 text-yellow-300 p-4 rounded-lg mb-4">
                    <h3 className="font-bold">Attention : Mise à jour importante</h3>
                    <p className="text-sm">Vous êtes sur le point de notifier les officiels d'un changement concernant ce match.</p>
                </div>
            )}
            <div className="space-y-4 text-gray-300">
                <p><strong>Objet :</strong> {subject}</p>
                <p><strong>Destinataires :</strong> {assignedOfficialsEmails}</p>
                <hr className="border-gray-700"/>
                <iframe 
                    srcDoc={html}
                    title="Aperçu de l'e-mail"
                    className="w-full h-96 border border-gray-700 rounded-md"
                    sandbox=""
                />
            </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
          <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">
            Annuler
          </button>
          <button type="button" onClick={handleConfirm} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchSheetModal;
