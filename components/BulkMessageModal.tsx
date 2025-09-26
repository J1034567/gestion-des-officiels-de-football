import React, { useState } from "react";
import { useSendReminderEmails } from "../hooks/useSendReminderEmails";
import { useNotificationContext } from "../contexts/NotificationContext";
import CloseIcon from "./icons/CloseIcon";
import PaperAirplaneIcon from "./icons/PaperAirplaneIcon";

interface BulkMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (subject: string, message: string) => void; // legacy immediate send path
  recipientCount: number;
  recipients?: { email: string; name?: string }[]; // if provided enables background job path
}

const BulkMessageModal: React.FC<BulkMessageModalProps> = ({
  isOpen,
  onClose,
  onSend,
  recipientCount,
  recipients,
}) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [useBackground, setUseBackground] = useState(true);
  const [loading, setLoading] = useState(false);
  const sendReminderEmails = useSendReminderEmails();
  const { showNotification } = useNotificationContext();

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      setError("Le sujet et le message sont obligatoires.");
      return;
    }
    setError("");
    if (useBackground && recipients && recipients.length) {
      setLoading(true);
      try {
        const jobId = await sendReminderEmails(
          recipients.map((r) => ({ email: r.email, name: r.name }))
        );
        showNotification(
          `Envoi planifié: job ${jobId.substring(0, 8)}… (${
            recipients.length
          } emails)`,
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
      onSend(subject, message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Envoyer un Message en Masse
            </h2>
            <p className="text-sm text-gray-400">
              À {recipientCount} officiel(s) sélectionné(s)
            </p>
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
              htmlFor="bulk-subject"
              className="block text-sm font-medium text-gray-300"
            >
              Sujet <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="bulk-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
              placeholder="Ex: Rappel important"
            />
          </div>
          <div>
            <label
              htmlFor="bulk-message"
              className="block text-sm font-medium text-gray-300"
            >
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              id="bulk-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
              placeholder="Votre message ici..."
            />
          </div>
          {recipients && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
              <input
                id="bg-send"
                type="checkbox"
                checked={useBackground}
                onChange={(e) => setUseBackground(e.target.checked)}
                className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-600 rounded bg-gray-900"
              />
              <label
                htmlFor="bg-send"
                className="text-sm text-gray-300 select-none"
              >
                Utiliser traitement en arrière-plan (recommandé pour {">"} 20
                destinataires)
              </label>
            </div>
          )}
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={loading}
            className={`bg-brand-primary hover:bg-brand-secondary disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2`}
          >
            <PaperAirplaneIcon className="h-5 w-5" />
            {loading
              ? "Planification…"
              : useBackground && recipients?.length
              ? "Planifier envoi"
              : "Envoyer le Message"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkMessageModal;
