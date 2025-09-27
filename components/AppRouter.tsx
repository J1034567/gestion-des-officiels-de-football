// components/AppRouter.tsx

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Header from "./Header";
const Dashboard = React.lazy(() => import("./Dashboard"));
const PlanningContainer = React.lazy(
  () => import("./containers/PlanningContainer")
);
const OfficialsContainer = React.lazy(
  () => import("./containers/OfficialsContainer")
);
const FinancesView = React.lazy(() => import("./FinancesView"));
const FinancesContainer = React.lazy(
  () => import("./containers/FinancesContainer")
);
const ClubsContainer = React.lazy(() => import("./containers/ClubsContainer"));
const SettingsView = React.lazy(() => import("./SettingsView"));
const SettingsContainer = React.lazy(
  () => import("./containers/SettingsContainer")
);
const AuditLogView = React.lazy(() => import("./AuditLogView"));
const AccountingContainer = React.lazy(
  () => import("./containers/AccountingContainer")
);
const VirementsContainer = React.lazy(
  () => import("./containers/VirementsContainer")
);
const EtatsContainer = React.lazy(() => import("./containers/EtatsContainer"));
const DisciplinaryView = React.lazy(() => import("./DisciplinaryView"));
const DisciplinaryContainer = React.lazy(
  () => import("./containers/DisciplinaryContainer")
);
const RankingsView = React.lazy(() => import("./RankingsView"));
import { useAuth } from "../contexts/AuthContext";
import { useAppSettings } from "../hooks/useAppSettings";
import { useLeagues } from "../hooks/useLeagues";
import { useLeagueGroups } from "../hooks/useLeagueGroups";
import { useTeams } from "../hooks/useTeams";
import { useMatches } from "../hooks/useMatches";
import { useAuditLogs } from "../hooks/useAuditLogs";
import { UserRole } from "../types";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { setExportServiceNotifier } from "@/services/exportService";

const ProtectedRoute = ({
  isAllowed,
  children,
}: {
  isAllowed: boolean;
  children: React.ReactNode;
}) => {
  if (!isAllowed) {
    return <Navigate to="/planning" replace />;
  }
  return <>{children}</>;
};

export const AppRouter = () => {
  const { user, permissions } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useAppSettings();
  const { data: leagues, isLoading: leaguesLoading } = useLeagues();

  const [currentSeason, setCurrentSeason] = useState<string>("");
  const [currentLeagueId, setCurrentLeagueId] = useState<string>("all");
  // Removed obsolete settingsDirty state (managed inside SettingsContainer now)

  const { showNotification } = useNotificationContext();
  React.useEffect(() => {
    // Adapter: wrap overloaded showNotification into simple (msg,type) form expected by export service
    setExportServiceNotifier(
      (msg: string, type?: "success" | "error" | "info") =>
        showNotification(msg, type)
    );
  }, [showNotification]);

  // Initialize season from localStorage if available; otherwise default to latest from settings
  useEffect(() => {
    const storedSeason = localStorage.getItem("currentSeason");
    if (storedSeason) {
      setCurrentSeason(storedSeason);
      return;
    }
    if (!currentSeason && settings?.seasons && settings.seasons.length > 0) {
      const sortedSeasons = [...settings.seasons].sort((a, b) =>
        b.localeCompare(a)
      );
      setCurrentSeason(sortedSeasons[0]);
    }
  }, [settings]);

  // Initialize league filter from localStorage if available
  useEffect(() => {
    const storedLeagueId = localStorage.getItem("currentLeagueId");
    if (storedLeagueId) setCurrentLeagueId(storedLeagueId);
  }, []);

  // Persist filters to localStorage
  useEffect(() => {
    if (currentSeason) localStorage.setItem("currentSeason", currentSeason);
  }, [currentSeason]);
  useEffect(() => {
    if (currentLeagueId)
      localStorage.setItem("currentLeagueId", currentLeagueId);
  }, [currentLeagueId]);

  const handleSetCurrentSeason = useCallback(
    (season: string) => setCurrentSeason(season),
    []
  );
  const handleSetCurrentLeagueId = useCallback(
    (leagueId: string) => setCurrentLeagueId(leagueId),
    []
  );

  // Data fetching
  const { data: leagueGroupsData, isLoading: lgLoading } = useLeagueGroups({
    season: currentSeason,
  });
  const { data: teamsData, isLoading: teamsLoading } = useTeams({
    pagination: { page: 1, pageSize: 2000 },
    filters: { includeArchived: true },
  });
  const { data: matchesData, isLoading: matchesLoading } = useMatches({
    filters: {
      season: currentSeason,
      leagueId: currentLeagueId === "all" ? undefined : currentLeagueId,
    },
    pagination: { page: 1, pageSize: 2000 },
  });
  const { data: auditLogsData, isLoading: auditLogsLoading } = useAuditLogs({
    pagination: { page: 1, pageSize: 2000 },
  });

  const matches = useMemo(() => matchesData?.data || [], [matchesData]);
  const teams = useMemo(() => teamsData?.data || [], [teamsData]);
  const leagueGroups = useMemo(
    () => leagueGroupsData || [],
    [leagueGroupsData]
  );
  const auditLogs = useMemo(() => auditLogsData?.data || [], [auditLogsData]);

  // Mutations
  const allRoles = Object.values(UserRole).map((roleName) => ({
    id: roleName,
    name: roleName,
  }));

  const isLoading =
    settingsLoading ||
    leaguesLoading ||
    lgLoading ||
    teamsLoading ||
    matchesLoading ||
    auditLogsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  // All assignment & mutation handlers moved to their respective containers.

  return (
    <BrowserRouter>
      <Header
        seasons={settings?.seasons || []}
        currentSeason={currentSeason}
        onSetCurrentSeason={handleSetCurrentSeason}
        leagues={leagues || []}
        currentLeagueId={currentLeagueId}
        onSetCurrentLeagueId={handleSetCurrentLeagueId}
      />
      <React.Suspense
        fallback={
          <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-brand-primary"></div>
          </div>
        }
      >
        <Routes>
          <Route
            path="/planning"
            element={<PlanningContainer currentSeason={currentSeason} />}
          />
          <Route
            path="/classements"
            element={
              <RankingsView
                matches={matches}
                teams={teams}
                leagues={leagues || []}
                leagueGroups={leagueGroups}
                currentUser={user!}
              />
            }
          />
          <Route path="/disciplinary" element={<DisciplinaryContainer />} />
          <Route path="/officials" element={<OfficialsContainer />} />
          <Route
            path="/clubs"
            element={<ClubsContainer currentSeason={currentSeason} />}
          />
          <Route path="/finances" element={<FinancesContainer />} />
          <Route
            path="/accounting"
            element={
              <ProtectedRoute isAllowed={permissions.can("view", "accounting")}>
                <AccountingContainer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/virements"
            element={
              <ProtectedRoute isAllowed={permissions.can("view", "finances")}>
                <VirementsContainer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/etats"
            element={
              <ProtectedRoute isAllowed={permissions.can("view", "finances")}>
                <EtatsContainer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit"
            element={
              <ProtectedRoute isAllowed={permissions.can("view", "audit")}>
                <AuditLogView logs={auditLogs} isLoading={auditLogsLoading} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute isAllowed={permissions.can("view", "settings")}>
                <SettingsContainer currentSeason={currentSeason} />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/planning" replace />} />
          <Route path="*" element={<Navigate to="/planning" replace />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
};
