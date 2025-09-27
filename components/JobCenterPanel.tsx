// src/components/JobCenterPanel.tsx
import React, { useMemo, useState, useCallback } from "react";
import { useJobCenter } from "../hooks/useJobCenter";
import { JobRow } from "./JobRow";
import { STATUS_CONFIG } from "./job-center.config";
import { ChevronUp, ChevronDown } from "lucide-react";

interface JobCenterPanelProps {
  onClose?: () => void;
}

type SortKey = "createdAt" | "status" | "type";

// A proper component for sortable headers
const SortableHeader: React.FC<{
  sortKey: SortKey;
  currentSort: SortKey;
  isDesc: boolean;
  onClick: (key: SortKey) => void;
  children: React.ReactNode;
  className?: string;
}> = React.memo(
  ({ sortKey, currentSort, isDesc, onClick, children, className }) => (
    <button
      onClick={() => onClick(sortKey)}
      className={`flex items-center gap-1 text-xs font-medium ${className}`}
    >
      {children}
      {currentSort === sortKey &&
        (isDesc ? <ChevronDown size={14} /> : <ChevronUp size={14} />)}
    </button>
  )
);

export const JobCenterPanel: React.FC<JobCenterPanelProps> = ({ onClose }) => {
  const { ordered, remove, clearCompleted, retry, isClearing } = useJobCenter();
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [isDesc, setIsDesc] = useState<boolean>(true);
  const [filterActive, setFilterActive] = useState<boolean>(false);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setIsDesc((d) => !d);
      } else {
        setSortKey(key);
        setIsDesc(true);
      }
    },
    [sortKey]
  );

  const sortedJobs = useMemo(() => {
    const arr = ordered;
    const filtered = filterActive
      ? arr.filter((j) => j.status === "pending" || j.status === "processing")
      : arr;

    return filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "createdAt":
          cmp = a.createdAt - b.createdAt;
          break;
        case "status":
          cmp =
            STATUS_CONFIG[a.status].priority - STATUS_CONFIG[b.status].priority;
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
      }
      return isDesc ? -cmp : cmp;
    });
  }, [ordered, sortKey, isDesc, filterActive]);

  return (
    <div className="absolute right-2 top-12 w-[720px] max-h-[70vh] flex flex-col bg-gray-800 shadow-xl border border-gray-700 rounded-lg overflow-hidden z-50 text-gray-200">
      {/* Panel Header */}
      <div className="flex-shrink-0 px-4 py-2 flex items-center justify-between bg-gray-700/70 border-b border-gray-600">
        <h2 className="font-semibold text-sm tracking-wide flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          Centre des tâches
        </h2>
        <div className="flex items-center gap-2">
          <button
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              filterActive
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-gray-700 border-gray-600 hover:bg-gray-600"
            }`}
            onClick={() => setFilterActive((f) => !f)}
          >
            Actives Uniquement
          </button>
          <button
            className={`text-xs px-2 py-1 rounded border transition-colors flex items-center gap-2 ${
              isClearing
                ? "bg-gray-600 border-gray-500 text-gray-300 cursor-wait"
                : "bg-gray-700 border-gray-600 hover:bg-gray-600"
            }`}
            onClick={() => {
              if (!isClearing) clearCompleted();
            }}
            disabled={isClearing}
          >
            {isClearing && (
              <span className="h-3 w-3 rounded-full border-2 border-t-transparent animate-spin" />
            )}
            Nettoyer
          </button>
          {onClose && (
            <button
              className="text-xs px-2 py-1 rounded border bg-gray-700 border-gray-600 hover:bg-gray-600"
              onClick={onClose}
            >
              Fermer
            </button>
          )}
        </div>
      </div>

      {/* Table Headers */}
      <div className="flex-shrink-0 grid grid-cols-12 gap-2 px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 bg-gray-900/40 border-b border-gray-700">
        <div className="col-span-2">
          <SortableHeader
            sortKey="createdAt"
            currentSort={sortKey}
            isDesc={isDesc}
            onClick={handleSort}
          >
            Début
          </SortableHeader>
        </div>
        <div className="col-span-4">Description</div>
        <div className="col-span-3">Progression</div>
        <div className="col-span-2">
          <SortableHeader
            sortKey="status"
            currentSort={sortKey}
            isDesc={isDesc}
            onClick={handleSort}
          >
            Statut
          </SortableHeader>
        </div>
        <div className="col-span-1 text-right">Actions</div>
      </div>

      {/* Jobs List */}
      <div className="flex-grow overflow-auto text-sm custom-scrollbars">
        {sortedJobs.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-xs select-none">
            Aucune tâche à afficher
          </div>
        ) : (
          sortedJobs.map((job) => (
            <JobRow key={job.id} job={job} onRemove={remove} onRetry={retry} />
          ))
        )}
      </div>
    </div>
  );
};

export default JobCenterPanel;
