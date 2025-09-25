import React, { useEffect } from "react";
import { useJobCenter } from "../hooks/useJobCenter";
import {
  getBulkMissionOrdersPdf,
  MissionOrderRequest,
} from "../services/missionOrderService";
import { downloadBlob } from "../services/pdfService";

/**
 * JobCenterOrchestrator
 * Listens to jobcenter:retry events and replays underlying business logic based on job.type.
 * Current supported types:
 * - mission_orders: expects meta.orders (MissionOrderRequest[]) and meta.fileName
 * - emails: expects meta.matchIds (string[]) and meta.scope; will invoke provided callback per match if available (window.__jobcenterSendMatchSheet)
 *
 * To integrate email resend logic, assign a global handler early in app boot:
 * (window as any).__jobcenterSendMatchSheet = async (matchId: string) => { ... };
 */
export const JobCenterOrchestrator: React.FC = () => {
  const { update, complete, fail } = useJobCenter();

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const job = detail?.job;
      if (!job) return;
      if (job.status !== "pending") return; // ensure we only handle freshly reset jobs

      if (job.type === "mission_orders") {
        const orders: MissionOrderRequest[] | undefined = job.meta?.orders;
        const fileName: string = job.meta?.fileName || "Ordres_de_Mission.pdf";
        if (!orders || orders.length === 0) {
          fail(job.id, "Aucune donnée de commande (orders) pour rejouer.");
          return;
        }
        try {
          update(job.id, {
            status: "processing",
            completed: 0,
            total: orders.length,
          });
          const blob = await getBulkMissionOrdersPdf(orders, (p) => {
            update(job.id, {
              status: p.completed < p.total ? "processing" : "completed",
              completed: p.completed,
              total: p.total,
            });
          });
          if (!blob) throw new Error("PDF vide");
          downloadBlob(blob, fileName);
          complete(job.id, { completed: orders.length, total: orders.length });
        } catch (err: any) {
          fail(job.id, err?.message || "Echec retraitement");
        }
        return;
      }

      if (job.type === "emails") {
        const matchIds: string[] | undefined = job.meta?.matchIds;
        const sender = (window as any).__jobcenterSendMatchSheet;
        if (
          !Array.isArray(matchIds) ||
          matchIds.length === 0 ||
          typeof sender !== "function"
        ) {
          fail(job.id, "Impossible de rejouer: matchIds ou sender manquant.");
          return;
        }
        try {
          update(job.id, {
            status: "processing",
            completed: 0,
            total: matchIds.length,
          });
          let done = 0;
          for (const mid of matchIds) {
            try {
              await sender(mid);
            } catch (e) {
              console.warn("Email resend failure", mid, e);
            }
            done += 1;
            update(job.id, {
              status: done < matchIds.length ? "processing" : "completed",
              completed: done,
              total: matchIds.length,
            });
          }
          complete(job.id, {
            completed: matchIds.length,
            total: matchIds.length,
          });
        } catch (err: any) {
          fail(job.id, err?.message || "Echec renvoi");
        }
        return;
      }
    };
    window.addEventListener("jobcenter:retry", handler as any);
    return () => window.removeEventListener("jobcenter:retry", handler as any);
  }, [update, complete, fail]);

  // Force reprint now triggers a direct retry via updated retry logic; no extra listener needed.

  return null;
};

export default JobCenterOrchestrator;
