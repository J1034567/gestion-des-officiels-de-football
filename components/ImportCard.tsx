
import React, { useState, useCallback } from 'react';
import ImportIcon from './icons/ImportIcon';
import PaperclipIcon from './icons/PaperclipIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import DownloadIcon from './icons/DownloadIcon';

export interface ImportResult<T> {
  data: T[];
  successCount: number;
  errorCount: number;
  errors: string[];
}

interface ImportCardProps<T> {
  title: string;
  templateHeaders: string[];
  templateFileName: string;
  onGenerateTemplate: (headers: string[], sheetName: string, fileName: string) => void;
  onFileProcess: (file: File) => Promise<ImportResult<T>>;
  onConfirmImport: (data: T[]) => Promise<void>;
  fileType?: 'excel' | 'csv';
}

const ImportCard = <T,>({ title, templateHeaders, templateFileName, onGenerateTemplate, onFileProcess, onConfirmImport, fileType = 'excel' }: ImportCardProps<T>) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<ImportResult<T> | null>(null);
  
  const acceptTypes = fileType === 'csv' ? '.csv' : '.xlsx,.xls';

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
      setResult(null); // Reset result when a new file is chosen
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    setResult(null);
    try {
      const importResult = await onFileProcess(file);
      setResult(importResult);
    } catch (err: any) {
      setResult({ data: [], successCount: 0, errorCount: 1, errors: [err.message] });
    }
    setIsProcessing(false);
  };
  
  const handleConfirm = async () => {
    if (!result || result.data.length === 0) return;
    setIsSaving(true);
    await onConfirmImport(result.data);
    setIsSaving(false);
    setFile(null);
    setResult(null);
  }

  const handleDownloadTemplate = () => {
    onGenerateTemplate(templateHeaders, title, templateFileName);
  };

  return (
    <div className="bg-gray-900/50 p-4 rounded-lg flex flex-col justify-between">
      <div>
        <div className="flex items-center mb-3">
          <ImportIcon className="h-6 w-6 text-brand-primary mr-3" />
          <h4 className="font-semibold text-white">{title}</h4>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <label className="flex-grow w-full cursor-pointer bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 text-sm flex items-center justify-center">
            <PaperclipIcon className="h-4 w-4 mr-2" />
            {file ? file.name : `Choisir un fichier (${acceptTypes})`}
            <input type="file" className="hidden" accept={acceptTypes} onChange={handleFileChange} />
          </label>
          <button
            onClick={handleDownloadTemplate}
            className="w-full sm:w-auto flex-shrink-0 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 text-sm flex items-center justify-center"
            title="Télécharger le modèle"
          >
            <DownloadIcon className="h-4 w-4 mr-2" />
            Modèle
          </button>
        </div>

        {result && (
          <div className="mt-4 p-3 bg-gray-800/60 rounded-md text-sm animate-fade-in-up">
            <h5 className="font-semibold mb-2">Résultat de l'analyse :</h5>
            {result.errorCount > 0 ? (
                <div className="flex items-start text-red-400">
                    <AlertTriangleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                    <p>{result.errorCount} erreur(s) trouvée(s). Importation impossible.</p>
                </div>
            ) : (
                <div className="flex items-center text-green-400">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    <p>{result.successCount} ligne(s) valide(s) prête(s) à être importée(s).</p>
                </div>
            )}
            {result.errors.length > 0 && (
                <ul className="mt-2 pl-5 list-disc list-inside text-red-400 text-xs space-y-1">
                    {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <button
            onClick={handleProcess}
            disabled={!file || isProcessing}
            className="w-full sm:flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isProcessing ? 'Analyse en cours...' : '1. Analyser le fichier'}
        </button>
        <button
            onClick={handleConfirm}
            disabled={!result || result.errorCount > 0 || result.successCount === 0 || isSaving}
            className="w-full sm:flex-1 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isSaving ? 'Importation...' : '2. Confirmer l\'Import'}
        </button>
      </div>
    </div>
  );
};

export default ImportCard;