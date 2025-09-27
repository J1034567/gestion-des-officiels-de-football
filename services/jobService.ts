import { supabase } from "../lib/supabaseClient";
import { JobRecord } from "../types"; // Assuming a shared types file

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
    const { data, error } = await supabase.functions.invoke('enqueue-job', {
        body: jobDetails
    });

    if (error) {
      console.error("Failed to enqueue job:", error);
      throw new Error(`Could not start the job: ${error.message}`);
    }

    return data.job;
  },
};