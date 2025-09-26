import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { supabase } from "../lib/supabaseClient";

/** Job Center Types */
export type JobType = "mission_orders" | "emails";
export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobRecord {
  id: string; // stable uuid/hash
  type: JobType;
  label: string; // short display label
  scope?: string; // optional scope identifier (e.g., matchId or 'all')
  createdAt: number;
  updatedAt: number;
  status: JobStatus;
  total?: number; // legacy progress total (still supported)
  completed?: number; // legacy progress completed (still supported)
  artifactUrl?: string; // resulting file if any (signed url)
  artifactPath?: string; // internal storage path (new unified jobs)
  artifactType?: string; // 'pdf' | 'zip' | etc.
  phase?: string | null; // current phase name
  phaseProgress?: number; // 0-100 progress within current phase
  progress?: number; // server-computed overall progress (override legacy calc when present)
  attempts?: number; // retry attempts (server side)
  priority?: number; // scheduling priority
  errorCode?: string | null; // standardized error code
  error?: string | null; // human-friendly message
  dedupeKey?: string | null; // idempotency key
  meta?: Record<string, any>;
}

export interface JobRetryEventDetail {
  job: JobRecord;
}

interface JobCenterContextValue {
  jobs: JobRecord[];
  register: (
    job: Omit<JobRecord, "createdAt" | "updatedAt" | "status"> & {
      status?: JobStatus;
    }
  ) => void;
  update: (id: string, patch: Partial<JobRecord>) => void;
  complete: (id: string, patch?: Partial<JobRecord>) => void;
  fail: (id: string, error?: string) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  clearCompleted: (olderThanMs?: number) => void;
  get: (id: string) => JobRecord | undefined;
  activeCount: number;
  retry: (id: string) => void;
}

const JobCenterContext = createContext<JobCenterContextValue | undefined>(
  undefined
);

const STORAGE_KEY = "jobCenter.store.v1";
const MAX_JOBS = 100; // cap to avoid unbounded growth
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 12; // 12h expiry for completed jobs
const DEBUG_JOBS =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

function prune(list: JobRecord[]): JobRecord[] {
  const cutoff = Date.now() - DEFAULT_TTL_MS;
  return list.filter(
    (j) => !(j.status === "completed" && j.updatedAt < cutoff)
  );
}

export const JobCenterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [jobs, setJobs] = useState<JobRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: JobRecord[] = JSON.parse(raw);
      return prune(parsed)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_JOBS);
    } catch {
      return [];
    }
  });
  const persistRef = useRef<number | null>(null);

  const persist = useCallback((next: JobRecord[]) => {
    setJobs(next);
    if (persistRef.current) cancelAnimationFrame(persistRef.current);
    persistRef.current = requestAnimationFrame(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    });
  }, []);

  const register: JobCenterContextValue["register"] = useCallback((job) => {
    setJobs((prev) => {
      const existing = prev.find((j) => j.id === job.id);
      if (existing) {
        // Already registered; ignore duplicate
        return prev;
      }
      const record: JobRecord = {
        ...job,
        status: job.status ?? "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (DEBUG_JOBS) console.debug("[JobCenter] register", record.id, record);
      const next = [record, ...prev].slice(0, MAX_JOBS);
      if (persistRef.current) cancelAnimationFrame(persistRef.current);
      persistRef.current = requestAnimationFrame(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      });
      // Defer event dispatch to next microtask to avoid any React "setState during render" warnings
      queueMicrotask(() => {
        try {
          window.dispatchEvent(
            new CustomEvent<JobRetryEventDetail>("jobcenter:registered", {
              detail: { job: record },
            })
          );
        } catch {
          /* ignore */
        }
      });
      return next;
    });
  }, []);

  const update: JobCenterContextValue["update"] = useCallback((id, patch) => {
    let updated: JobRecord | undefined;
    setJobs((prev) => {
      const next = prev.map((j) => {
        if (j.id === id) {
          // Merge while keeping unspecified new fields from previous state
          updated = { ...j, ...patch, updatedAt: Date.now() } as JobRecord;
          return updated;
        }
        return j;
      });
      // schedule localStorage persistence without creating a second state change
      if (persistRef.current) cancelAnimationFrame(persistRef.current);
      persistRef.current = requestAnimationFrame(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      });
      return next;
    });
    if (updated) {
      if (DEBUG_JOBS) console.debug("[JobCenter] update", updated.id, updated);
      queueMicrotask(() => {
        try {
          window.dispatchEvent(
            new CustomEvent("jobcenter:status", { detail: { job: updated } })
          );
        } catch {
          /* ignore */
        }
      });
    }
  }, []);

  const complete = useCallback(
    (id: string, patch?: Partial<JobRecord>) => {
      if (DEBUG_JOBS) console.debug("[JobCenter] complete", id, patch);
      update(id, { status: "completed", ...patch });
    },
    [update]
  );

  const fail = useCallback(
    (id: string, error?: string) => {
      if (DEBUG_JOBS) console.debug("[JobCenter] fail", id, error);
      update(id, { status: "failed", error: error || "Erreur inconnue" });
    },
    [update]
  );

  const cancel = useCallback(
    (id: string) => {
      if (DEBUG_JOBS) console.debug("[JobCenter] cancel", id);
      update(id, { status: "cancelled" });
    },
    [update]
  );

  const remove = useCallback(
    (id: string) => {
      persist(jobs.filter((j) => j.id !== id));
    },
    [jobs, persist]
  );

  const clearCompleted = useCallback(
    (olderThanMs?: number) => {
      const cutoff = olderThanMs
        ? Date.now() - olderThanMs
        : Date.now() - DEFAULT_TTL_MS;
      persist(
        jobs.filter((j) => !(j.status === "completed" && j.updatedAt < cutoff))
      );
    },
    [jobs, persist]
  );

  // periodic prune
  useEffect(() => {
    const id = setInterval(() => {
      persist(prune(jobs));
    }, 60_000);
    return () => clearInterval(id);
  }, [jobs, persist]);

  const value: JobCenterContextValue = {
    jobs,
    register,
    update,
    complete,
    fail,
    cancel,
    remove,
    clearCompleted,
    get: (id) => jobs.find((j) => j.id === id),
    activeCount: jobs.filter((j) =>
      ["pending", "processing"].includes(j.status)
    ).length,
    retry: (id: string) => {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;
      const nextMeta = {
        ...(job.meta || {}),
        retryCount: (job.meta?.retryCount || 0) + 1,
      };
      const dispatchedJob: JobRecord = {
        ...job,
        status: "pending",
        completed: 0,
        error: undefined,
        meta: nextMeta,
        updatedAt: Date.now(),
      };
      if (DEBUG_JOBS)
        console.debug("[JobCenter] retry", dispatchedJob.id, {
          retryCount: nextMeta.retryCount,
        });
      // Optimistically update local state synchronously
      setJobs((prev) => prev.map((j) => (j.id === id ? dispatchedJob : j)));
      // Persist asynchronously
      if (persistRef.current) cancelAnimationFrame(persistRef.current);
      persistRef.current = requestAnimationFrame(() => {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(jobs.map((j) => (j.id === id ? dispatchedJob : j)))
          );
        } catch {
          /* ignore */
        }
      });
      queueMicrotask(() => {
        try {
          window.dispatchEvent(
            new CustomEvent<JobRetryEventDetail>("jobcenter:retry", {
              detail: { job: dispatchedJob },
            })
          );
        } catch {
          /* ignore */
        }
      });
    },
  };

  return (
    <JobCenterContext.Provider value={value}>
      {children}
    </JobCenterContext.Provider>
  );
};

// Helper to map DB row (snake_case) to JobRecord patch (camelCase)
function mapDbRowToJobRecord(row: any): Partial<JobRecord> | null {
  if (!row?.id) return null;
  const statusMap: Record<string, JobStatus> = {
    pending: "pending",
    running: "processing",
    processing: "processing",
    completed: "completed",
    failed: "failed",
    cancelling: "processing", // could expose distinct state later
    cancelled: "cancelled",
  };
  const rec: Partial<JobRecord> = {
    id: row.id,
    status: statusMap[row.status] || "pending",
    progress: typeof row.progress === "number" ? row.progress : undefined,
    phase: row.phase ?? undefined,
    phaseProgress:
      typeof row.phase_progress === "number" ? row.phase_progress : undefined,
    artifactPath: row.artifact_path ?? undefined,
    artifactType: row.artifact_type ?? undefined,
    errorCode: row.error_code ?? undefined,
    attempts: typeof row.attempts === "number" ? row.attempts : undefined,
    priority: typeof row.priority === "number" ? row.priority : undefined,
    dedupeKey: row.dedupe_key ?? undefined,
    // Keep legacy label derivation minimal if not set
  };
  return rec;
}

// Attach realtime subscription inside a dedicated component to avoid re-subscribing on context updates
export const JobRealtimeBridge: React.FC = () => {
  const { update, register, get } = useJobCenter();
  useEffect(() => {
    const channel = supabase.channel("jobs-changes").on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "jobs",
      },
      (payload) => {
        const newRow: any = payload.new || payload.old;
        if (!newRow) return;
        const patch = mapDbRowToJobRecord(newRow);
        if (!patch) return;
        const existing = get(patch.id!);
        if (!existing) {
          // Register minimal record; caller code may enrich label later
          register({
            id: patch.id!,
            type: (newRow.type as JobType) || "mission_orders",
            label: newRow.type || patch.id!,
            status: patch.status as JobStatus,
            meta: { source: "realtime" },
          });
          // Then apply details
          update(patch.id!, patch as any);
        } else {
          update(patch.id!, patch as any);
        }
      }
    );
    channel.subscribe();
    return () => {
      try {
        channel.unsubscribe();
      } catch {
        /* ignore */
      }
    };
  }, [update, register, get]);
  return null;
};

export function useJobCenter() {
  const ctx = useContext(JobCenterContext);
  if (!ctx)
    throw new Error("useJobCenter must be used within JobCenterProvider");
  return ctx;
}
