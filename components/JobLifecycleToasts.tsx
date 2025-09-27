import { useEffect, useRef } from "react";
import { useJobCenter } from "../hooks/useJobCenter";
import { JOB_KIND_META } from "./job-kind-meta";
import { useNotificationContext } from "../contexts/NotificationContext";

/**
 * Component that watches job lifecycle changes and emits grouped toasts.
 * Must be rendered inside both JobCenterProvider and NotificationProvider.
 */
export const JobLifecycleToasts: React.FC = () => {
  const { ordered } = useJobCenter();
  const { replaceGroup, showNotification } = useNotificationContext();
  const lastStatusRef = useRef<Record<string, string>>({});
  const lastPhaseRef = useRef<Record<string, string | undefined>>({});
  const lastPhaseToastAtRef = useRef<Record<string, number>>({});

  const PHASE_TOAST_MIN_INTERVAL = 2500; // ms per job

  useEffect(() => {
    ordered.forEach((job) => {
      const prev = lastStatusRef.current[job.id];
      if (prev === job.status) return;
      const meta = JOB_KIND_META[job.type as keyof typeof JOB_KIND_META];
      if (!meta) {
        lastStatusRef.current[job.id] = job.status;
        return;
      }
      const group = `job:${job.id}`;
      if (job.status === "processing" && prev && prev !== "processing") {
        replaceGroup(group, {
          message: meta.verbProgressive || meta.verbPresent,
          type: "info",
        });
      } else if (job.status === "completed") {
        const msg = meta.successToast ? meta.successToast(job) : meta.verbPast;
        replaceGroup(group, { message: msg, type: "success" });
      } else if (job.status === "failed") {
        const msg = meta.failureToast
          ? meta.failureToast(job)
          : `Échec (${job.error || "Erreur"})`;
        replaceGroup(group, { message: msg, type: "error" });
      }
      lastStatusRef.current[job.id] = job.status;
    });
  }, [ordered, replaceGroup]);

  // Phase-change ephemeral toasts (rate-limited per job)
  useEffect(() => {
    ordered.forEach((job) => {
      const meta = JOB_KIND_META[job.type as keyof typeof JOB_KIND_META];
      if (!meta?.phaseLabels) return;
      if (job.status !== "processing") {
        lastPhaseRef.current[job.id] = job.phase || job.meta?.phase;
        return; // only care while processing
      }
      const currentPhase = job.phase || job.meta?.phase;
      const prevPhase = lastPhaseRef.current[job.id];
      if (!currentPhase || currentPhase === prevPhase) return;
      // Rate limit per job
      const now = Date.now();
      const lastToastAt = lastPhaseToastAtRef.current[job.id] || 0;
      if (now - lastToastAt < PHASE_TOAST_MIN_INTERVAL) {
        lastPhaseRef.current[job.id] = currentPhase; // update anyway
        return;
      }
      const label = meta.phaseLabels[currentPhase] || currentPhase;
      showNotification({
        message: `${label}…`,
        type: "info",
        group: `job:${job.id}:phase`,
        autoCloseMs: 1800,
      });
      lastPhaseToastAtRef.current[job.id] = now;
      lastPhaseRef.current[job.id] = currentPhase;
    });
  }, [ordered, showNotification]);

  return null;
};

export default JobLifecycleToasts;
