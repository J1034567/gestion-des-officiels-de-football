// src/components/JobRow.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import type { JobRecord } from "../hooks/useJobCenter";
import { STATUS_CONFIG, formatDuration } from "./job-center.config";
import { JOB_KIND_META, STATUS_DISPLAY } from "./job-kind-meta";
import { Download, RefreshCw, Trash2 } from "lucide-react";

interface JobRowProps {
  job: JobRecord;
  onRemove: (id: string) => Promise<void> | void;
  onRetry: (id: string) => Promise<void> | void;
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
    const [isRemoving, setIsRemoving] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const lastPhaseRef = useRef<string | null>(null);
    const [phaseGlow, setPhaseGlow] = useState(false);

    // Phase boundary glow
    useEffect(() => {
      const current = job.phase || job.meta?.phase || null;
      if (current && lastPhaseRef.current && current !== lastPhaseRef.current) {
        // Trigger glow animation on phase boundary change
        setPhaseGlow(true);
        const t = setTimeout(() => setPhaseGlow(false), 1200);
        return () => clearTimeout(t);
      }
      if (!lastPhaseRef.current && current) {
        // first assignment – no animation
      }
      lastPhaseRef.current = current;
    }, [job.phase, job.meta?.phase]);

    // Track previous intra-phase value to enable smooth animated transitions.
    const lastIntraRef = useRef<number | null>(null);
    const [animateBump, setAnimateBump] = useState(false);
    // Optimistic progress simulation when backend only reports 0 then 100
    const [optimisticPct, setOptimisticPct] = useState<number | null>(null);
    const optimisticPhaseRef = useRef<string | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
      const phase = job.phase || job.meta?.phase || null;
      const real = job.phaseProgress ?? job.meta?.phase_progress ?? null;
      // Reset when phase changes
      if (optimisticPhaseRef.current !== phase) {
        optimisticPhaseRef.current = phase;
        setOptimisticPct(null);
      }
      // If we have a real incremental value, adopt it and stop sim
      if (typeof real === "number" && real > 0 && real < 100) {
        setOptimisticPct(null);
        return;
      }
      if (phase && (real === null || real === 0)) {
        // Start / continue optimistic animation up to a soft cap (e.g., 85%)
        const start = performance.now();
        const base = optimisticPct ?? 0;
        const cap = 85; // do not exceed to avoid lying about near-completion
        const durationMs = 8000; // time to reach cap if uninterrupted
        const tick = (ts: number) => {
          const elapsed = ts - start;
          // Ease-out curve
          let ratio = Math.min(1, elapsed / durationMs);
          ratio = 1 - Math.pow(1 - ratio, 2);
          const next = Math.min(cap, base + (cap - base) * ratio);
          setOptimisticPct(next);
          if (
            next < cap &&
            (job.phaseProgress ?? job.meta?.phase_progress ?? 0) === 0 &&
            job.status === "processing"
          ) {
            rafRef.current = requestAnimationFrame(tick);
          }
        };
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
        return () => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
      } else {
        // If real finishes (100) or no phase, clear simulation
        setOptimisticPct(null);
      }
    }, [
      job.phase,
      job.meta?.phase,
      job.phaseProgress,
      job.meta?.phase_progress,
      job.status,
    ]);
    useEffect(() => {
      const currentIntra =
        job.phaseProgress ?? job.meta?.phase_progress ?? null;
      if (
        typeof currentIntra === "number" &&
        typeof lastIntraRef.current === "number"
      ) {
        if (currentIntra > lastIntraRef.current) {
          // Trigger a subtle bump animation to visually show progress arrival
          setAnimateBump(true);
          const t = setTimeout(() => setAnimateBump(false), 400);
          return () => clearTimeout(t);
        }
      }
      lastIntraRef.current = currentIntra;
    }, [job.phaseProgress, job.meta?.phase_progress]);
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

    const isNew = Date.now() - job.createdAt < 3000;
    return (
      <div
        className={`px-4 py-2 border-b border-gray-700/60 last:border-b-0 transition-colors ${
          isNew
            ? "bg-blue-700/20 animate-[pulse_2s_ease-in-out_2]"
            : "hover:bg-gray-700/40"
        }`}
      >
        <div className="grid grid-cols-12 gap-2 items-center">
          {/* Created At */}
          <div className="col-span-2 text-xs text-gray-400 tabular-nums">
            {new Date(job.createdAt).toLocaleTimeString()}
          </div>

          {/* Type, Verb & Scope */}
          <div className="col-span-4 flex flex-col gap-1 text-xs truncate">
            {(() => {
              const meta =
                JOB_KIND_META[job.type as keyof typeof JOB_KIND_META];
              const baseLabel = meta ? meta.fullLabel : job.label;
              const progressive = meta?.verbProgressive;
              const past = meta?.verbPast;
              let displayLine = baseLabel;
              if (job.status === "processing" && progressive)
                displayLine = progressive;
              else if (job.status === "completed" && past)
                displayLine =
                  past +
                  (job.meta?.generate_stats?.succeeded
                    ? ` (${job.meta.generate_stats.succeeded})`
                    : "");
              return (
                <div className="font-semibold truncate" title={baseLabel}>
                  {displayLine}
                </div>
              );
            })()}
            <div
              className="text-gray-400 truncate flex items-center gap-2"
              title={job.scope || job.meta?.scope || ""}
            >
              {(() => {
                const meta =
                  JOB_KIND_META[job.type as keyof typeof JOB_KIND_META];
                return (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-700 border border-gray-600 text-gray-300 text-[10px]"
                    title={meta?.fullLabel || job.type}
                  >
                    {meta?.icon && (
                      <span className="shrink-0">{meta.icon}</span>
                    )}
                    <span className="truncate max-w-[90px]">
                      {meta?.shortLabel || job.type}
                    </span>
                  </span>
                );
              })()}
              <span className="truncate">
                {job.scope || job.meta?.scope || ""}
              </span>
            </div>
          </div>

          {/* Progress & Phase */}
          <div className="col-span-3 flex flex-col gap-1">
            {(() => {
              const meta =
                JOB_KIND_META[job.type as keyof typeof JOB_KIND_META];
              const phaseLabels = meta?.phaseLabels;
              const phaseWeights = meta?.phaseWeights;
              const phases = phaseLabels ? Object.keys(phaseLabels) : [];
              const currentPhase = job.phase || job.meta?.phase || null;
              const withinPhasePct =
                job.phaseProgress ?? job.meta?.phase_progress ?? null;
              if (!phaseLabels || phases.length === 0) {
                // Fallback single bar
                return (
                  <div className="h-2 bg-gray-700 rounded overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ease-out ${progressBarColor}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                );
              }
              // Weighted or equal segments
              const segmentDefs = phases.map((p) => {
                const weight = phaseWeights?.find((w) => w.name === p)?.weight;
                return {
                  name: p,
                  weight:
                    typeof weight === "number" ? weight : 100 / phases.length,
                };
              });
              const totalWeight =
                segmentDefs.reduce((a, b) => a + b.weight, 0) || 1;
              const normalized = segmentDefs.map((s) => ({
                ...s,
                pct: (s.weight / totalWeight) * 100,
              }));
              const currentIdx = currentPhase
                ? phases.indexOf(currentPhase)
                : -1;
              return (
                <div
                  className={`flex h-2 w-full overflow-hidden rounded bg-gray-700 relative ${
                    phaseGlow
                      ? "ring-2 ring-blue-400/60 shadow-[0_0_8px_2px_rgba(96,165,250,0.6)] transition-all"
                      : "ring-0"
                  } ${animateBump ? "[animation:ping_0.6s_ease-in-out]" : ""}`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={(() => {
                    const meta =
                      JOB_KIND_META[job.type as keyof typeof JOB_KIND_META];
                    if (!meta?.phaseWeights || !job.phase) return progressPct;
                    const weights = meta.phaseWeights;
                    const total =
                      weights.reduce((a, b) => a + b.weight, 0) || 1;
                    let acc = 0;
                    for (const w of weights) {
                      if (w.name === job.phase) {
                        const intra =
                          (job.phaseProgress ?? job.meta?.phase_progress ?? 0) /
                          100;
                        acc += w.weight * intra;
                        break;
                      } else acc += w.weight;
                    }
                    return Math.min(
                      100,
                      Math.max(0, Math.round((acc / total) * 100))
                    );
                  })()}
                  aria-label={(() => {
                    const meta =
                      JOB_KIND_META[job.type as keyof typeof JOB_KIND_META];
                    const phase = job.phase || job.meta?.phase;
                    const phaseLabel = phase && meta?.phaseLabels?.[phase];
                    return phaseLabel
                      ? `${meta?.shortLabel || job.type} – ${phaseLabel}`
                      : `${meta?.shortLabel || job.type}`;
                  })()}
                >
                  {normalized.map((seg, idx) => {
                    const p = seg.name;
                    const isCompleted =
                      job.status === "completed" ||
                      idx < currentIdx ||
                      (job.status === "processing" && idx < currentIdx);
                    const isCurrent =
                      job.status === "processing" && idx === currentIdx;
                    const baseColor =
                      job.status === "failed"
                        ? "bg-red-500/60"
                        : "bg-blue-500/30";
                    const fillColor =
                      job.status === "failed"
                        ? "bg-red-500"
                        : job.status === "completed"
                        ? "bg-green-500"
                        : "bg-blue-500";
                    let innerPct = 0;
                    if (isCompleted) innerPct = 100;
                    else if (isCurrent) {
                      if (typeof withinPhasePct === "number") {
                        innerPct = Math.min(100, Math.max(0, withinPhasePct));
                      } else if (optimisticPct !== null) {
                        innerPct = optimisticPct;
                      }
                    }
                    const weightPct = Math.round(
                      (seg.weight / totalWeight) * 100
                    );
                    const displayIntra =
                      typeof withinPhasePct === "number"
                        ? withinPhasePct.toFixed(0)
                        : isCurrent && optimisticPct !== null
                        ? Math.round(optimisticPct).toString() + "~"
                        : undefined;
                    const tooltip = `${phaseLabels[p]} (${weightPct}%${
                      displayIntra ? ` – ${displayIntra}%` : ""
                    })`;
                    return (
                      <div
                        key={p}
                        className={`relative ${baseColor}`}
                        style={{ width: `${seg.pct}%` }}
                        title={tooltip}
                      >
                        <div
                          className={`h-full transition-all duration-500 ease-[cubic-bezier(.4,0,.2,1)] ${
                            innerPct > 0 ? fillColor : ""
                          } ${
                            innerPct > 0 && innerPct < 100 ? "shadow-inner" : ""
                          } ${
                            isCurrent &&
                            optimisticPct !== null &&
                            typeof withinPhasePct !== "number"
                              ? "animate-[pulse_2s_ease-in-out_infinite]"
                              : ""
                          }`}
                          style={{ width: `${innerPct}%` }}
                        >
                          {isCurrent &&
                            typeof withinPhasePct !== "number" &&
                            innerPct === 0 && (
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.2s_linear_infinite]" />
                            )}
                        </div>
                        {idx < normalized.length - 1 && (
                          <div className="absolute top-0 right-0 h-full w-px bg-gray-800/70" />
                        )}
                      </div>
                    );
                  })}
                  {phaseGlow && (
                    <div className="pointer-events-none absolute inset-0 animate-pulse bg-blue-400/10" />
                  )}
                </div>
              );
            })()}
            <div className="text-[10px] text-gray-400 flex justify-between items-center">
              <span>
                {(() => {
                  // If we have weighted phases and current phase progress, derive overall weighted progress for display
                  const meta =
                    JOB_KIND_META[job.type as keyof typeof JOB_KIND_META];
                  if (!meta?.phaseWeights || !job.phase)
                    return `${progressPct}%`;
                  const weights = meta.phaseWeights;
                  const total = weights.reduce((a, b) => a + b.weight, 0) || 1;
                  let acc = 0;
                  for (const w of weights) {
                    if (w.name === job.phase) {
                      const intra =
                        (job.phaseProgress ?? job.meta?.phase_progress ?? 0) /
                        100;
                      acc += w.weight * intra;
                      break;
                    } else {
                      acc += w.weight; // completed
                    }
                  }
                  const overall = Math.min(
                    100,
                    Math.max(0, Math.round((acc / total) * 100))
                  );
                  return `${overall}%`;
                })()}
              </span>
              <span className="truncate">
                {(() => {
                  const meta =
                    JOB_KIND_META[job.type as keyof typeof JOB_KIND_META];
                  if (job.status !== "processing")
                    return formatDuration(duration);
                  const phase = job.phase || job.meta?.phase;
                  if (!meta) return formatDuration(duration);
                  const label = phase && meta.phaseLabels?.[phase];
                  return label ? label : formatDuration(duration);
                })()}
              </span>
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
                disabled={isRetrying}
                onClick={async () => {
                  try {
                    setIsRetrying(true);
                    await onRetry(job.id);
                  } finally {
                    setIsRetrying(false);
                  }
                }}
                title="Réessayer"
                className={`text-yellow-400 hover:bg-yellow-500/20 ${
                  isRetrying ? "opacity-60 cursor-wait" : ""
                }`}
              >
                <RefreshCw
                  size={16}
                  className={isRetrying ? "animate-spin" : ""}
                />
              </IconButton>
            )}
            {(job.status === "completed" ||
              job.status === "failed" ||
              job.status === "cancelled") && (
              <IconButton
                disabled={isRemoving}
                onClick={async () => {
                  try {
                    setIsRemoving(true);
                    await onRemove(job.id);
                  } finally {
                    /* keep removing state until unmounted */
                  }
                }}
                title="Supprimer"
                className={`text-red-400 hover:bg-red-500/20 ${
                  isRemoving ? "opacity-60 cursor-wait" : ""
                }`}
              >
                <Trash2
                  size={16}
                  className={isRemoving ? "animate-pulse" : ""}
                />
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
