
import React, { useState } from 'react';
import { PaymentBatch } from '../types';
import CloseIcon from './icons/CloseIcon';
import PaperclipIcon from './icons/PaperclipIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

interface ProofOfPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (batchId: string, proof: { transactionId?: string; file?: File }) => void;
    batch: PaymentBatch | null;
}

const ProofOfPaymentModal: React.FC<ProofOfPaymentModalProps> = ({ isOpen, onClose, onSave, batch }) => {
    const [mode, setMode] = useState<'id' | 'file'>('id');
    const [transactionId, setTransactionId] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState('');

    if (!isOpen || !batch) return null;

    const handleSave = () => {
        setError('');
        if (mode === 'id' && !transactionId.trim()) {
            setError("L'ID de transaction est requis.");
            return;
        }
        if (mode === 'file' && !file) {
            setError('Veuillez sélectionner un fichier.');
            return;
        }
        
        onSave(batch.id, {
            transactionId: mode === 'id' ? transactionId.trim() : undefined,
            file: mode === 'file' ? file : undefined,
        });
        onClose();
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">Ajouter une Preuve de Paiement</h2>
                        <p className="text-sm text-gray-400">Lot: {batch.reference}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><CloseIcon className="h-6 w-6"/></button>
                </div>
                <div className="p-6 space-y-4">
                     {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
                     <div className="flex bg-gray-900/50 p-1 rounded-lg">
                        <button onClick={() => setMode('id')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${mode === 'id' ? 'bg-brand-primary text-white' : 'text-gray-300'}`}>ID de Transaction</button>
                        <button onClick={() => setMode('file')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${mode === 'file' ? 'bg-brand-primary text-white' : 'text-gray-300'}`}>Fichier de Preuve</button>
                     </div>
                     
                     {mode === 'id' ? (
                         <div>
                            <label htmlFor="transaction-id" className="block text-sm font-medium text-gray-300 mb-1">ID de Transaction Bancaire</label>
                            <input type="text" id="transaction-id" value={transactionId} onChange={e => setTransactionId(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white" placeholder="Entrez l'ID de la transaction..." autoFocus />
                         </div>
                     ) : (
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Télécharger un Fichier</label>
                            <label className="w-full flex items-center justify-center px-4 py-3 bg-gray-700 text-gray-300 rounded-lg cursor-pointer hover:bg-gray-600">
                                <PaperclipIcon className="h-5 w-5 mr-2" />
                                <span className="font-medium">{file ? file.name : "Sélectionner un fichier (PDF, JPG, PNG)..."}</span>
                                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
                            </label>
                         </div>
                     )}
                     <div className="p-3 bg-yellow-900/30 text-yellow-300 text-xs rounded-lg flex items-start gap-2">
                        <AlertTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>La soumission d'une nouvelle preuve écrasera toute preuve existante pour ce lot.</span>
                     </div>
                </div>
                <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end gap-3">
                    <button onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500">Annuler</button>
                    <button onClick={handleSave} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Sauvegarder</button>
                </div>
            </div>
        </div>
    );
};

export default ProofOfPaymentModal;
