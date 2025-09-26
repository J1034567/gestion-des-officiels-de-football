import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

interface JobItemRow {
  id: string;
  seq: number;
  status: string;
  error_code: string | null;
  error_message: string | null;
  target: any;
  started_at: string | null;
  finished_at: string | null;
}

interface JobItemsListProps {
  jobId: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "text-gray-400",
  running: "text-blue-400",
  completed: "text-green-400",
  failed: "text-red-400",
  skipped: "text-yellow-400",
};

export const JobItemsList: React.FC<JobItemsListProps> = ({ jobId }) => {
  const [items, setItems] = useState<JobItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("job_items")
        .select("*")
        .eq("job_id", jobId)
        .order("seq", { ascending: true });
      if (!cancelled) {
        if (!error && data) setItems(data as any);
        setLoading(false);
      }
    }
    load();
    const channel = supabase
      .channel(`job-items-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_items",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          setItems((prev) => {
            const row: any = payload.new || payload.old;
            if (!row) return prev;
            const existingIdx = prev.findIndex((i) => i.id === row.id);
            if (existingIdx === -1)
              return [...prev, row].sort((a, b) => a.seq - b.seq);
            const next = [...prev];
            next[existingIdx] = row;
            return next.sort((a, b) => a.seq - b.seq);
          });
        }
      );
    channel.subscribe();
    return () => {
      cancelled = true;
      try {
        channel.unsubscribe();
      } catch {
        /* ignore */
      }
    };
  }, [jobId]);

  const summary = useMemo(() => {
    const total = items.length;
    const completed = items.filter(
      (i) => i.status === "completed" || i.status === "skipped"
    ).length;
    const failed = items.filter((i) => i.status === "failed").length;
    const running = items.filter((i) => i.status === "running").length;
    return {
      total,
      completed,
      failed,
      running,
      pct: total ? Math.round((completed / total) * 100) : 0,
    };
  }, [items]);

  if (loading && items.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-400">Chargement des éléments…</div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-500">Aucun élément détaillé.</div>
    );
  }

  return (
    <div className="p-3 bg-gray-800/40 border-t border-gray-700/50">
      <div className="flex items-center justify-between text-[11px] mb-2 text-gray-400">
        <div>
          <span className="mr-3">Total: {summary.total}</span>
          <span className="mr-3 text-green-400">
            Terminés: {summary.completed}
          </span>
          <span className="mr-3 text-red-400">Échecs: {summary.failed}</span>
          <span className="mr-3 text-blue-400">
            En cours: {summary.running}
          </span>
          <span className="">Progression: {summary.pct}%</span>
        </div>
      </div>
      <div className="max-h-52 overflow-auto custom-scrollbars pr-1">
        <table className="w-full text-[11px] border-separate border-spacing-y-1">
          <thead className="text-gray-500">
            <tr>
              <th className="text-left font-medium">#</th>
              <th className="text-left font-medium">Cible</th>
              <th className="text-left font-medium">Statut</th>
              <th className="text-left font-medium">Erreur</th>
              <th className="text-left font-medium">Durée</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const started = it.started_at
                ? Date.parse(it.started_at)
                : undefined;
              const finished = it.finished_at
                ? Date.parse(it.finished_at)
                : undefined;
              const duration =
                started && finished
                  ? `${Math.max(1, Math.round((finished - started) / 1000))}s`
                  : started && !finished
                  ? "en cours"
                  : "";
              const targetLabel =
                it.target?.email ||
                it.target?.officialId ||
                it.target?.matchId ||
                it.target?.id ||
                "–";
              return (
                <tr key={it.id} className="bg-gray-900/40 hover:bg-gray-700/40">
                  <td className="px-2 py-1 align-top tabular-nums">{it.seq}</td>
                  <td
                    className="px-2 py-1 align-top truncate max-w-[160px]"
                    title={JSON.stringify(it.target)}
                  >
                    {targetLabel}
                  </td>
                  <td
                    className={`px-2 py-1 align-top font-medium ${
                      STATUS_COLOR[it.status] || "text-gray-400"
                    }`}
                  >
                    {it.status}
                  </td>
                  <td
                    className="px-2 py-1 align-top text-red-400 truncate max-w-[140px]"
                    title={it.error_message || it.error_code || ""}
                  >
                    {it.error_code || ""}
                  </td>
                  <td className="px-2 py-1 align-top text-gray-400">
                    {duration}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
