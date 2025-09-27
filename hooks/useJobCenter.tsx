import React, { createContext, useContext, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { JobRecord } from "../types"; // Assuming JobRecord is moved to a central types file

// NOTE: It's recommended to move this type to a shared `types.ts` file
// export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
// export interface JobRecord { ... }

interface JobCenterContextValue {
  jobs: JobRecord[];
  get: (id: string) => JobRecord | undefined;
  activeCount: number;
  isLoading: boolean;
  clearCompleted: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
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
    return data.map(dbJob => ({
        id: dbJob.id,
        type: dbJob.type,
        label: dbJob.label || 'Unnamed Job',
        scope: dbJob.payload?.scope,
        createdAt: new Date(dbJob.created_at).getTime(),
        updatedAt: new Date(dbJob.updated_at).getTime(),
        status: dbJob.status,
        total: dbJob.total,
        completed: dbJob.progress,
        artifactUrl: dbJob.result?.artifactUrl,
        error: dbJob.error_message,
        meta: dbJob.payload, // meta is now the payload
    })) as JobRecord[];
  },
  retryJob: async (jobId: string) => {
    const { error } = await supabase.functions.invoke('retry-job', { body: { jobId } });
    if (error) throw error;
  },
  deleteJob: async (jobId: string) => {
    const { error } = await supabase.from('jobs').delete().match({ id: jobId });
    if (error) throw error;
  },
  deleteCompletedJobs: async () => {
    const { error } = await supabase.from('jobs').delete().match({ status: 'completed' });
    if (error) throw error;
  }
};


export const JobCenterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const queryKey = ["jobs"];

  const { data: jobs = [], isLoading } = useQuery({
      queryKey,
      queryFn: jobService.getJobs,
  });

  useEffect(() => {
    const channel = supabase
      .channel("jobs-channel")
      .on<JobRecord>(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        (payload) => {
          // Invalidate the query to trigger a refetch, which is simple and robust.
          // For a more optimized approach, you could manually update the query cache.
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const remove = useCallback(async (id: string) => {
      await jobService.deleteJob(id);
      queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);

  const clearCompleted = useCallback(async () => {
      await jobService.deleteCompletedJobs();
      queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);
  
  const retry = useCallback(async (id: string) => {
      await jobService.retryJob(id);
      // No need to invalidate, realtime will catch the status update
  }, []);

  const value: JobCenterContextValue = {
    jobs,
    get: (id) => jobs.find((j) => j.id === id),
    activeCount: jobs.filter((j) =>
      ["pending", "processing"].includes(j.status)
    ).length,
    isLoading,
    remove,
    clearCompleted,
    retry,
  };

  return (
    <JobCenterContext.Provider value={value}>{children}</JobCenterContext.Provider>
  );
};

export function useJobCenter() {
  const ctx = useContext(JobCenterContext);
  if (!ctx)
    throw new Error("useJobCenter must be used within JobCenterProvider");
  return ctx;
}