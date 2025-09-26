import React, { useState, useEffect } from "react";
import { useSendReminderEmails } from "../hooks/useSendReminderEmails";
import { useNotificationContext } from "../contexts/NotificationContext";
import { Official } from "../types";
import CloseIcon from "./icons/CloseIcon";
import EnvelopeIcon from "./icons/EnvelopeIcon";

interface QuickEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (officialId: string, email: string) => void;
  official: Official | null;
}

const QuickEmailModal: React.FC<QuickEmailModalProps> = ({
  isOpen,
  onClose,
  onSave,
  official,
}) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [useBackground, setUseBackground] = useState(false);
  const [loading, setLoading] = useState(false);
  const sendReminderEmails = useSendReminderEmails();
  const { showNotification } = useNotificationContext();

  useEffect(() => {
    if (isOpen && official) {
      setEmail(official.email || "");
      setError("");
    }
  }, [isOpen, official]);

  if (!isOpen || !official) return null;

  const handleSave = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Veuillez entrer une adresse e-mail valide.");
      return;
    }
    if (useBackground) {
      setLoading(true);
      try {
        const jobId = await sendReminderEmails([
          { email, name: official.fullName },
        ]);
        showNotification(
          `Envoi planifié (job ${jobId.substring(0, 8)}…)`,
          "info"
        );
        onClose();
      } catch (e: any) {
        showNotification(
          `Échec planification: ${e?.message || "Erreur inconnue"}`,
          "error"
        );
      } finally {
        setLoading(false);
      }
    } else {
      onSave(official.id, email);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">
              Mettre à jour l'E-mail
            </h2>
            <p className="text-sm text-gray-400">{official.fullName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">
              {error}
            </p>
          )}
          <div>
            <label
              htmlFor="quick-email"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Adresse e-mail
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <EnvelopeIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                id="quick-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white"
                placeholder="nom@exemple.com"
                autoFocus
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
            <input
              id="quick-bg"
              type="checkbox"
              checked={useBackground}
              onChange={(e) => setUseBackground(e.target.checked)}
              className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-600 rounded bg-gray-900"
            />
            <label
              htmlFor="quick-bg"
              className="text-sm text-gray-300 select-none"
            >
              Utiliser envoi en arrière-plan (job)
            </label>
          </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-brand-primary hover:bg-brand-secondary disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg"
          >
            {loading ? "Planification…" : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickEmailModal;
