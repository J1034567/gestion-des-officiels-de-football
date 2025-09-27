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
  const { replaceGroup } = useNotificationContext();
  const lastStatusRef = useRef<Record<string, string>>({});

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

  return null;
};

export default JobLifecycleToasts;
