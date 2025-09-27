import React from "react";
import { JobKinds, JobKind } from "../supabase/functions/_shared/jobKinds";
import PrinterIcon from "./icons/PrinterIcon";
import CheckCircleIcon from "./icons/CheckCircleIcon";
import AlertTriangleIcon from "./icons/AlertTriangleIcon";

export interface JobKindMeta {
  kind: JobKind;
  shortLabel: string;
  fullLabel: string;
  verbPresent: string; // "Génération"
  verbProgressive: string; // "Génération en cours"
  verbPast: string; // "Généré"
  category: "mission-orders" | "emails" | "messaging" | "exports";
  isBulk: boolean;
  icon: React.ReactNode;
  hasArtifact?: boolean;
  phaseLabels?: Record<string, string>;
  successToast?: (job: any) => string;
  failureToast?: (job: any) => string;
}

export const JOB_KIND_META: Record<JobKind, JobKindMeta> = {
  [JobKinds.MissionOrdersBulkPdf]: {
    kind: JobKinds.MissionOrdersBulkPdf,
    shortLabel: "Ordres (lot)",
    fullLabel: "Génération d'ordres de mission (lot)",
    verbPresent: "Génération",
    verbProgressive: "Génération des PDF…",
    verbPast: "PDF générés",
    category: "mission-orders",
    isBulk: true,
    icon: <PrinterIcon className="h-4 w-4" />,
    hasArtifact: true,
    phaseLabels: {
      validation: "Validation",
      fetch_data: "Récupération des données",
      generate_pdfs: "Génération",
      merge_documents: "Fusion",
      upload_artifact: "Téléversement",
    },
    successToast: (job) => {
      const stats = job.meta?.generate_stats || job.payload?.generate_stats;
      const succeeded = stats?.succeeded ?? "—";
      return `PDF fusionné (${succeeded} succès)`;
    },
    failureToast: (job) =>
      `Échec génération PDF (${job.error || "Erreur inconnue"})`,
  },
  [JobKinds.MissionOrdersSinglePdf]: {
    kind: JobKinds.MissionOrdersSinglePdf,
    shortLabel: "Ordre",
    fullLabel: "Génération d'ordre de mission",
    verbPresent: "Génération",
    verbProgressive: "Génération du PDF…",
    verbPast: "PDF généré",
    category: "mission-orders",
    isBulk: false,
    icon: <PrinterIcon className="h-4 w-4" />,
    hasArtifact: true,
    successToast: () => "Ordre de mission généré",
    failureToast: (job) =>
      `Échec génération (${job.error || "Erreur inconnue"})`,
  },
  [JobKinds.MissionOrdersSingleEmail]: {
    kind: JobKinds.MissionOrdersSingleEmail,
    shortLabel: "Envoi (ordre)",
    fullLabel: "Envoi par email (ordre)",
    verbPresent: "Envoi",
    verbProgressive: "Envoi en cours…",
    verbPast: "Email envoyé",
    category: "mission-orders",
    isBulk: false,
    icon: <CheckCircleIcon className="h-4 w-4" />,
    successToast: () => "Email envoyé",
    failureToast: (job) => `Échec envoi (${job.error || "Erreur inconnue"})`,
  },
  [JobKinds.MatchSheetsBulkEmail]: {
    kind: JobKinds.MatchSheetsBulkEmail,
    shortLabel: "Feuilles (emails)",
    fullLabel: "Envoi de feuilles de match (lot)",
    verbPresent: "Envoi",
    verbProgressive: "Envoi des emails…",
    verbPast: "Emails envoyés",
    category: "emails",
    isBulk: true,
    icon: <CheckCircleIcon className="h-4 w-4" />,
    successToast: (job) => {
      const stats = job.meta?.email_stats || job.payload?.email_stats;
      if (stats) return `Emails: ${stats.completed}/${stats.total} envoyés`;
      return "Emails envoyés";
    },
    failureToast: (job) => `Échec envoi emails (${job.error || "Erreur"})`,
  },
  [JobKinds.MessagingBulkEmail]: {
    kind: JobKinds.MessagingBulkEmail,
    shortLabel: "Messages (lot)",
    fullLabel: "Campagne email (messagerie)",
    verbPresent: "Envoi",
    verbProgressive: "Envoi des messages…",
    verbPast: "Messages envoyés",
    category: "messaging",
    isBulk: true,
    icon: <CheckCircleIcon className="h-4 w-4" />,
    successToast: () => "Campagne envoyée",
    failureToast: (job) => `Échec campagne (${job.error || "Erreur"})`,
  },
};

// Localized status labels for reuse (can be expanded later)
export const STATUS_DISPLAY: Record<string, string> = {
  pending: "En attente",
  processing: "En cours",
  retrying: "Nouvelle tentative",
  completed: "Terminé",
  failed: "Échec",
  cancelled: "Annulé",
  paused: "En pause",
};
