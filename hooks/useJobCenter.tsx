import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { JOB_KIND_META } from "../components/job-kind-meta";

// Local canonical JobRecord type exported for consumers (panels, rows, config)
export interface JobRecord {
  id: string;
  type: string;
  label: string;
  scope?: string | null;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  phase?: string | null; // current backend phase
  phaseProgress?: number | null; // 0-100 within phase
  status:
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "cancelled"
    | "paused"
    | "retrying";
  total?: number | null;
  completed?: number | null;
  artifactUrl?: string | null;
  error?: string | null;
  meta?: any; // payload snapshot
}

// NOTE: It's recommended to move this type to a shared `types.ts` file
// export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
// export interface JobRecord { ... }

interface JobCenterContextValue {
  jobs: Record<string, JobRecord>;
  ordered: JobRecord[]; // derived, sorted by created desc by default
  get: (id: string) => JobRecord | undefined;
  activeCount: number;
  isLoading: boolean;
  clearCompleted: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
  optimisticAdd: (job: Partial<JobRecord> & { id: string }) => void;
  isClearing: boolean;
  deletingIds: Set<string>;
}

const JobCenterContext = createContext<JobCenterContextValue | undefined>(
  undefined
);

// Service functions to interact with the backend
const jobService = {
  getJobs: async (): Promise<JobRecord[]> => {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    // Map DB columns to client-side JobRecord interface if needed
    return data.map((dbJob) => ({
      id: dbJob.id,
      type: dbJob.type,
      label: dbJob.label || "Unnamed Job",
      scope: dbJob.payload?.scope,
      createdAt: new Date(dbJob.created_at).getTime(),
      updatedAt: new Date(dbJob.updated_at).getTime(),
      phase: dbJob.phase ?? null,
      phaseProgress: dbJob.phase_progress ?? null,
      status: dbJob.status,
      total: dbJob.total,
      completed: dbJob.progress,
      artifactUrl: dbJob.result?.artifactUrl,
      error: dbJob.error_message,
      meta: dbJob.payload, // meta is now the payload
    })) as JobRecord[];
  },
  retryJob: async (jobId: string) => {
    const { error } = await supabase.functions.invoke("retry-job", {
      body: { jobId },
    });
    if (error) throw error;
  },
  deleteJob: async (jobId: string) => {
    const { error } = await supabase.from("jobs").delete().match({ id: jobId });
    if (error) throw error;
  },
  deleteCompletedJobs: async () => {
    const { error } = await supabase
      .from("jobs")
      .delete()
      .match({ status: "completed" });
    if (error) throw error;
  },
};

const mapDbJob = (dbJob: any): JobRecord => ({
  id: dbJob.id,
  type: dbJob.type,
  label: dbJob.label || "Unnamed Job",
  scope: dbJob.payload?.scope,
  createdAt: new Date(dbJob.created_at).getTime(),
  updatedAt: new Date(dbJob.updated_at).getTime(),
  phase: dbJob.phase ?? null,
  phaseProgress: dbJob.phase_progress ?? null,
  status: dbJob.status,
  total: dbJob.total,
  completed: dbJob.progress,
  artifactUrl: dbJob.result?.artifactUrl,
  error: dbJob.error_message,
  meta: dbJob.payload,
});

export const JobCenterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // NOTE: We removed direct notification context usage here to avoid provider ordering issues.
  // A separate component can consume JobCenter and Notification contexts together to emit toasts.
  const { data: initial = [], isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: jobService.getJobs,
  });
  const [jobs, setJobs] = useState<Record<string, JobRecord>>({});
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isClearing, setIsClearing] = useState(false);
  const hydratedRef = useRef(false);

  // Hydrate once when initial query resolves
  useEffect(() => {
    if (!hydratedRef.current && initial.length) {
      const map: Record<string, JobRecord> = {};
      initial.forEach((j) => {
        map[j.id] = j;
      });
      setJobs(map);
      hydratedRef.current = true;
    }
  }, [initial]);

  // Realtime incremental updates
  useEffect(() => {
    const channel = supabase
      .channel("jobs-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        (payload: any) => {
          setJobs((prev) => {
            const next = { ...prev };
            if (payload.eventType === "INSERT") {
              next[payload.new.id] = mapDbJob(payload.new);
            } else if (payload.eventType === "UPDATE") {
              const existing = next[payload.new.id];
              next[payload.new.id] = mapDbJob(payload.new);
              // Preserve optimistic createdAt if it was earlier (avoid flicker)
              if (
                existing &&
                existing.createdAt &&
                existing.createdAt < next[payload.new.id].createdAt
              ) {
                next[payload.new.id].createdAt = existing.createdAt;
              }
              // Emit lifecycle toast if status changed to terminal
              // Toast emission moved out of provider (see JobLifecycleToasts component)
            } else if (payload.eventType === "DELETE") {
              delete next[payload.old.id];
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Listen for optimistic enqueue events
  useEffect(() => {
    const addHandler = (e: any) => {
      const optimistic = e.detail as Partial<JobRecord> & { id: string };
      setJobs((prev) => {
        if (prev[optimistic.id]) return prev; // already present
        return { ...prev, [optimistic.id]: { ...(optimistic as JobRecord) } };
      });
    };
    const reconcileHandler = (e: any) => {
      const { placeholderId, record } = e.detail as {
        placeholderId: string;
        record: JobRecord;
      };
      setJobs((prev) => {
        const next = { ...prev };
        // If placeholder exists, delete and insert real
        if (next[placeholderId]) delete next[placeholderId];
        next[record.id] = record;
        return next;
      });
    };
    const failHandler = (e: any) => {
      const { id, error } = e.detail as { id: string; error: string };
      setJobs((prev) => {
        if (!prev[id]) return prev;
        return { ...prev, [id]: { ...prev[id], status: "failed", error } };
      });
    };
    if (typeof window !== "undefined") {
      window.addEventListener("job:enqueue", addHandler as any);
      window.addEventListener("job:enqueue:reconcile", reconcileHandler as any);
      window.addEventListener("job:enqueue:fail", failHandler as any);
      return () => {
        window.removeEventListener("job:enqueue", addHandler as any);
        window.removeEventListener(
          "job:enqueue:reconcile",
          reconcileHandler as any
        );
        window.removeEventListener("job:enqueue:fail", failHandler as any);
      };
    }
  }, []);

  const optimisticAdd = useCallback(
    (job: Partial<JobRecord> & { id: string }) => {
      setJobs((prev) => ({ ...prev, [job.id]: { ...(job as JobRecord) } }));
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    setDeletingIds((ids) => new Set(ids).add(id));
    setJobs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      await jobService.deleteJob(id);
    } catch (e) {
      /* optional rollback */
    }
    setDeletingIds((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }, []);

  const clearCompleted = useCallback(async () => {
    setIsClearing(true);
    setJobs((prev) => {
      const next: Record<string, JobRecord> = {};
      Object.values(prev).forEach((j) => {
        if (j.status !== "completed") next[j.id] = j;
      });
      return next;
    });
    try {
      await jobService.deleteCompletedJobs();
    } catch (e) {
      /* ignore */
    }
    setIsClearing(false);
  }, []);

  const retry = useCallback(async (id: string) => {
    // Optimistic visual status change
    setJobs((prev) => ({
      ...prev,
      [id]: prev[id] ? { ...prev[id], status: "retrying" as any } : prev[id],
    }));
    try {
      await jobService.retryJob(id);
    } catch (e) {
      /* revert? */
    }
  }, []);

  const ordered = Object.values(jobs).sort((a, b) => b.createdAt - a.createdAt);
  const activeCount = ordered.filter((j) =>
    ["pending", "processing", "retrying"].includes(j.status)
  ).length;

  const value: JobCenterContextValue = {
    jobs,
    ordered,
    get: (id) => jobs[id],
    activeCount,
    isLoading: isLoading && !hydratedRef.current,
    clearCompleted,
    remove,
    retry,
    optimisticAdd,
    isClearing,
    deletingIds,
  };

  return (
    <JobCenterContext.Provider value={value}>
      {children}
    </JobCenterContext.Provider>
  );
};

export function useJobCenter() {
  const ctx = useContext(JobCenterContext);
  if (!ctx)
    throw new Error("useJobCenter must be used within JobCenterProvider");
  return ctx;
}
