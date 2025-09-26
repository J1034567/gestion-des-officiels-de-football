// src/components/JobRow.tsx
import React, { useMemo } from "react";
import { JobRecord } from "../hooks/useJobCenter";
import { STATUS_CONFIG, formatDuration } from "./job-center.config";
import { Download, RefreshCw, Trash2 } from "lucide-react";

interface JobRowProps {
  job: JobRecord;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

// A small, reusable icon button component
const IconButton: React.FC<React.ComponentProps<"button">> = ({
  className,
  ...props
}) => (
  <button
    {...props}
    className={`p-1 rounded-md transition-colors ${className}`}
  />
);

export const JobRow: React.FC<JobRowProps> = React.memo(
  ({ job, onRemove, onRetry }) => {
    const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
    const {
      label: statusLabel,
      Icon: StatusIcon,
      color: statusColor,
    } = statusConfig;

    const { progressPct, duration } = useMemo(() => {
      const progress =
        job.total && job.total > 0
          ? Math.min(100, Math.round(((job.completed || 0) / job.total) * 100))
          : job.status === "completed"
          ? 100
          : 0;

      const dur =
        job.status === "completed" || job.status === "failed"
          ? job.updatedAt - job.createdAt
          : Date.now() - job.createdAt;

      return { progressPct: progress, duration: dur };
    }, [job.status, job.total, job.completed, job.createdAt, job.updatedAt]);

    const progressBarColor =
      job.status === "failed"
        ? "bg-red-500"
        : job.status === "completed"
        ? "bg-green-500"
        : "bg-blue-500";

    return (
      <div className="px-4 py-2 border-b border-gray-700/60 last:border-b-0 hover:bg-gray-700/40 transition-colors">
        <div className="grid grid-cols-12 gap-2 items-center">
          {/* Created At */}
          <div className="col-span-2 text-xs text-gray-400 tabular-nums">
            {new Date(job.createdAt).toLocaleTimeString()}
          </div>

          {/* Type & Scope */}
          <div className="col-span-4 flex flex-col gap-1 text-xs truncate">
            <div className="font-semibold truncate" title={job.label}>
              {job.label}
            </div>
            <div
              className="text-gray-400 truncate"
              title={job.scope || job.meta?.scope || ""}
            >
              <span className="inline-block px-2 py-0.5 rounded bg-gray-700 border border-gray-600 text-gray-300 capitalize text-[10px]">
                {job.type}
              </span>
              <span className="ml-2">{job.scope || job.meta?.scope || ""}</span>
            </div>
          </div>

          {/* Progress */}
          <div className="col-span-3 flex flex-col gap-1">
            <div className="h-2 bg-gray-700 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ease-out ${progressBarColor}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-400 flex justify-between">
              <span>{progressPct}%</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Status */}
          <div className="col-span-2 flex items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-white font-medium ${statusColor}`}
            >
              <StatusIcon
                size={14}
                className={job.status === "processing" ? "animate-spin" : ""}
              />
              {statusLabel}
            </span>
          </div>

          {/* Actions */}
          <div className="col-span-1 flex items-center justify-end gap-1">
            {job.artifactUrl && (
              <a
                href={job.artifactUrl}
                target="_blank"
                rel="noreferrer"
                title="Télécharger l'artefact"
              >
                <IconButton className="text-blue-400 hover:bg-blue-500/20">
                  <Download size={16} />
                </IconButton>
              </a>
            )}
            {(job.status === "failed" || job.status === "cancelled") && (
              <IconButton
                onClick={() => onRetry(job.id)}
                title="Réessayer"
                className="text-yellow-400 hover:bg-yellow-500/20"
              >
                <RefreshCw size={16} />
              </IconButton>
            )}
            {(job.status === "completed" ||
              job.status === "failed" ||
              job.status === "cancelled") && (
              <IconButton
                onClick={() => onRemove(job.id)}
                title="Supprimer"
                className="text-red-400 hover:bg-red-500/20"
              >
                <Trash2 size={16} />
              </IconButton>
            )}
          </div>
        </div>
        {job.error && (
          <div
            className="mt-1.5 pl-1 text-xs text-red-400/90 line-clamp-2 bg-red-900/20 p-2 rounded-md"
            title={job.error}
          >
            <span className="font-semibold">Erreur:</span> {job.error}
          </div>
        )}
      </div>
    );
  }
);
