import React, { useEffect, useRef } from "react";
import { useNotificationContext } from "../contexts/NotificationContext";
import { JobRecord } from "../hooks/useJobCenter";

// Centralized listener for job center custom events.
// Mount once high in the tree (e.g. inside App layout after providers).
// Emits toasts for register, completion, failure, retry.

const JobCenterEvents: React.FC = () => {
  const { showNotification } = useNotificationContext();

  useEffect(() => {
    // Track last notified progress bucket per job to avoid spam
    const lastBucketRef = new Map<string, number>();
    const onRegistered = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { job: JobRecord }
        | undefined;
      if (!detail?.job) return;
      showNotification(`Tâche démarrée: ${detail.job.label}`, "info");
    };
    const onRetry = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { job: JobRecord }
        | undefined;
      if (!detail?.job) return;
      lastBucketRef.delete(detail.job.id); // reset buckets on retry
      showNotification(`Relance: ${detail.job.label}`, "info");
    };
    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { job: JobRecord }
        | undefined;
      if (!detail?.job) return;
      if (detail.job.status === "completed") {
        showNotification(`Terminé: ${detail.job.label}`, "success");
      } else if (detail.job.status === "failed") {
        showNotification(`Échec: ${detail.job.label}`, "error");
      } else if (detail.job.status === "processing") {
        // Progress toast only for retried jobs (retryCount >=1)
        const retryCount = detail.job.meta?.retryCount || 0;
        if (retryCount < 1) return; // only show for orchestrated retries
        if (
          typeof detail.job.completed === "number" &&
          typeof detail.job.total === "number" &&
          detail.job.total > 0
        ) {
          const pct = (detail.job.completed / detail.job.total) * 100;
          // Use 25% buckets: 0<..<=25, <=50, <=75, <100 (completion handled above)
          const bucket =
            pct >= 100
              ? 100
              : pct >= 75
              ? 75
              : pct >= 50
              ? 50
              : pct >= 25
              ? 25
              : 0;
          if (bucket > 0) {
            const last = lastBucketRef.get(detail.job.id) || 0;
            if (bucket !== last) {
              lastBucketRef.set(detail.job.id, bucket);
              showNotification(
                `Relance ${retryCount} – ${detail.job.label}: ${Math.floor(
                  pct
                )}%`,
                "info"
              );
            }
          }
        }
      }
    };
    window.addEventListener("jobcenter:registered", onRegistered);
    window.addEventListener("jobcenter:retry", onRetry);
    window.addEventListener("jobcenter:status", onStatus);
    return () => {
      window.removeEventListener("jobcenter:registered", onRegistered);
      window.removeEventListener("jobcenter:retry", onRetry);
      window.removeEventListener("jobcenter:status", onStatus);
    };
  }, [showNotification]);

  return null;
};

export default JobCenterEvents;
