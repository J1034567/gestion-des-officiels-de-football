import React, { useState } from "react";
import { AuditLog } from "../types";
import ShieldCheckIcon from "./icons/ShieldCheckIcon";

interface AuditLogViewProps {
  logs: AuditLog[];
  isLoading: boolean;
}

const AuditLogView: React.FC<AuditLogViewProps> = ({ logs, isLoading }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const formatTs = (ts?: string) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return isNaN(d.getTime())
      ? ts
      : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
  };

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center mb-6">
        <ShieldCheckIcon className="h-8 w-8 text-brand-primary mr-3" />
        <h2 className="text-3xl font-bold text-white">Journal d'Audit</h2>
      </div>

      <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary mx-auto"></div>
              <h3 className="mt-4 text-xl font-bold text-white">
                Chargement du journal...
              </h3>
            </div>
          ) : logs.length > 0 ? (
            <table className="min-w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Date & Heure
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Utilisateur
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Action
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Détails
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {formatTs(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">
                        {log.userName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {log.userEmail ||
                          (log.userId ? `ID: ${log.userId}` : "Système")}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      <div className="space-y-1">
                        {(log.tableName || log.recordId) && (
                          <div className="text-xs text-gray-400">
                            {log.tableName && (
                              <span className="mr-2">
                                Table:{" "}
                                <span className="text-gray-200">
                                  {log.tableName}
                                </span>
                              </span>
                            )}
                            {log.recordId && (
                              <span>
                                Enreg.:{" "}
                                <span className="text-gray-200">
                                  {log.recordId}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                        {(log.oldValues || log.newValues) && (
                          <button
                            onClick={() => toggle(log.id)}
                            className="text-xs text-brand-primary hover:text-brand-secondary"
                          >
                            {expanded[log.id] ? "Masquer" : "Voir"} valeurs
                          </button>
                        )}
                        {expanded[log.id] && (
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {log.oldValues && (
                              <div className="bg-gray-800/60 p-2 rounded">
                                <div className="text-xs font-semibold text-gray-400 mb-1">
                                  Avant
                                </div>
                                <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words">
                                  {JSON.stringify(log.oldValues, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.newValues && (
                              <div className="bg-gray-800/60 p-2 rounded">
                                <div className="text-xs font-semibold text-gray-400 mb-1">
                                  Après
                                </div>
                                <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words">
                                  {JSON.stringify(log.newValues, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center p-12">
              <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-500" />
              <h3 className="mt-4 text-xl font-bold text-white">
                Aucune action enregistrée
              </h3>
              <p className="mt-2 text-gray-400">
                Le journal d'audit est currently vide.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default AuditLogView;
