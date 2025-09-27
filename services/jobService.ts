import { supabase } from "../lib/supabaseClient";
import type { JobRecord } from "../hooks/useJobCenter";

export interface EnqueueJobPayload {
  type: string;
  label: string;
  payload?: Record<string, any>;
  total?: number;
}

export const jobService = {
  /**
   * Enqueues a new job to be processed by the backend.
   * This is the primary method for starting any background task.
   */
  async enqueueJob(jobDetails: EnqueueJobPayload): Promise<JobRecord> {
    // 1. Create a deterministic temporary client ID (will be replaced after server response).
    // We keep same ID once server responds, so we wait to extract id from server response.
    // But we still want an immediate placeholder row BEFORE network latency; to do that,
    // we dispatch a pseudo optimistic job with a temporary negative timestamp-based id,
    // then reconcile once real id arrives.
    const placeholderId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (typeof window !== 'undefined') {
      try {
        const optimisticRecord: Partial<JobRecord> & { id: string } = {
          id: placeholderId,
          type: jobDetails.type,
          label: jobDetails.label,
          scope: jobDetails.payload?.scope,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'pending' as any,
          total: jobDetails.total,
          completed: 0,
          artifactUrl: undefined,
          error: undefined,
          meta: jobDetails.payload || {},
        };
        (optimisticRecord as any)._isPlaceholder = true;
        window.dispatchEvent(new CustomEvent('job:enqueue', { detail: optimisticRecord }));
      } catch (e) {
        console.warn('[jobService] Placeholder optimistic dispatch failed', e);
      }
    }

    const { data, error } = await supabase.functions.invoke('enqueue-job', {
      body: jobDetails
    });

    if (error) {
      console.error("Failed to enqueue job:", error);
      // Emit a failure state for the placeholder so user sees immediate feedback
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('job:enqueue:fail', { detail: { id: placeholderId, error: error.message } }));
      }
      throw new Error(`Could not start the job: ${error.message}`);
    }

    const job = data.job;
    // 2. Reconcile: replace placeholder with real job id & data (or just add if placeholder missing)
    if (typeof window !== 'undefined' && job) {
      try {
        const optimisticRecord: Partial<JobRecord> & { id: string } = {
          id: job.id,
          type: job.type,
          label: job.label || jobDetails.label,
          scope: job.payload?.scope,
          createdAt: Date.now(), // client time; realtime update will refine
          updatedAt: Date.now(),
          status: job.status || 'pending',
          total: job.total || jobDetails.total || undefined,
          completed: job.progress || 0,
          artifactUrl: job.result?.artifactUrl,
          error: job.error_message,
          meta: job.payload || jobDetails.payload || {},
        };
        window.dispatchEvent(new CustomEvent('job:enqueue:reconcile', { detail: { placeholderId, record: optimisticRecord } }));
      } catch (e) {
        console.warn('[jobService] Failed to dispatch reconcile event', e);
      }
    }
    return job as JobRecord;
  },
};