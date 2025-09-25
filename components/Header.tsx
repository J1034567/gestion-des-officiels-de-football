import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import WhistleIcon from "./icons/WhistleIcon";
import CogIcon from "./icons/CogIcon";
import ShieldCheckIcon from "./icons/ShieldCheckIcon";
import LogoutIcon from "./icons/LogoutIcon";
import { League } from "../types";
import AccountingIcon from "./icons/AccountingIcon";
import CreditCardIcon from "./icons/CreditCardIcon";
import DocumentTextIcon from "./icons/DocumentTextIcon";
import ShieldExclamationIcon from "./icons/ShieldExclamationIcon";
import TableCellsIcon from "./icons/TableCellsIcon";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { logAndThrow } from "../utils/logging";
import { useNotificationContext } from "../contexts/NotificationContext";
import { makeNotifier } from "../utils/notify";
import { useJobCenter } from "../hooks/useJobCenter";
import JobsIcon from "./icons/JobsIcon";
import JobCenterPanel from "./JobCenterPanel";

interface HeaderProps {
  seasons: string[];
  currentSeason: string;
  onSetCurrentSeason: (season: string) => void;
  leagues: League[];
  currentLeagueId: string;
  onSetCurrentLeagueId: (leagueId: string) => void;
}

type NavigationTab =
  | "planning"
  | "classements"
  | "disciplinary"
  | "officials"
  | "finances"
  | "clubs"
  | "settings"
  | "audit"
  | "accounting"
  | "virements"
  | "etats";

const Header: React.FC<HeaderProps> = ({
  seasons,
  currentSeason,
  onSetCurrentSeason,
  leagues,
  currentLeagueId,
  onSetCurrentLeagueId,
}) => {
  const { user, permissions } = useAuth();
  const location = useLocation();
  const { showNotification } = useNotificationContext();
  const notify = makeNotifier(showNotification);
  const { activeCount } = useJobCenter();
  const [showJobs, setShowJobs] = useState(false);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        notify.error(`Erreur déconnexion: ${error.message}`);
        return logAndThrow("auth.signOut", error);
      }
      notify.success("Déconnexion réussie.");
    } catch (e) {
      // Routing will handle session loss anyway; just log
      notify.error((e as any)?.message || String(e));
    }
  };

  const allNavItems: {
    path: string;
    label: string;
    icon: React.ReactNode;
    visible: boolean;
  }[] = [
    {
      path: "/planning",
      label: "Planning",
      icon: null,
      visible:
        permissions.can("view", "assignments") ||
        permissions.can("view", "matches"),
    },
    {
      path: "/classements",
      label: "Classements",
      icon: <TableCellsIcon className="h-4 w-4 mr-2" />,
      visible: permissions.can("view", "matches"),
    },
    {
      path: "/disciplinary",
      label: "Discipline",
      icon: <ShieldExclamationIcon className="h-4 w-4 mr-2" />,
      visible: permissions.can("view", "disciplinary"),
    },
    {
      path: "/officials",
      label: "Officiels",
      icon: null,
      visible: permissions.can("view", "officials"),
    },
    {
      path: "/clubs",
      label: "Clubs",
      icon: null,
      visible: permissions.can("view", "clubs"),
    },
    {
      path: "/accounting",
      label: "Comptabilité",
      icon: <AccountingIcon className="h-4 w-4 mr-2" />,
      visible: permissions.can("view", "accounting"),
    },
    {
      path: "/finances",
      label: "Finances",
      icon: null,
      visible: permissions.can("view", "finances"),
    },
    {
      path: "/virements",
      label: "Virements",
      icon: <CreditCardIcon className="h-4 w-4 mr-2" />,
      visible: permissions.can("view", "finances"),
    },
    {
      path: "/etats",
      label: "États",
      icon: <DocumentTextIcon className="h-4 w-4 mr-2" />,
      visible: permissions.can("view", "finances"),
    },
  ];

  const navItems = allNavItems.filter((item) => item.visible);

  const getNavLinkClass = (path: string) => {
    const baseClass =
      "px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center";
    const activeClass = "text-white bg-gray-900";
    const inactiveClass = "text-gray-300 hover:bg-gray-700 hover:text-white";
    return location.pathname === path
      ? `${baseClass} ${activeClass}`
      : `${baseClass} ${inactiveClass}`;
  };

  const getIconNavLinkClass = (path: string) => {
    const baseClass = "p-2 rounded-full transition-colors duration-200";
    const activeClass = "bg-gray-900 text-white";
    const inactiveClass = "text-gray-400 hover:bg-gray-700 hover:text-white";
    return location.pathname === path
      ? `${baseClass} ${activeClass}`
      : `${baseClass} ${inactiveClass}`;
  };

  return (
    <header className="bg-gray-800 shadow-md sticky top-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <WhistleIcon className="h-8 w-8 text-brand-primary" />
            <h1 className="text-2xl font-bold text-white ml-3">
              Gestion des Officiels
            </h1>
          </div>
          <div className="flex items-center">
            <nav className="flex items-center space-x-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={getNavLinkClass(item.path)}
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
              {permissions.can("view", "audit") && (
                <NavLink
                  to="/audit"
                  className={getIconNavLinkClass("/audit")}
                  aria-label="Journal d'audit"
                  title="Journal d'audit"
                >
                  <ShieldCheckIcon className="h-5 w-5" />
                </NavLink>
              )}
              {permissions.can("view", "settings") && (
                <NavLink
                  to="/settings"
                  className={getIconNavLinkClass("/settings")}
                  aria-label="Paramètres"
                  title="Paramètres"
                >
                  <CogIcon className="h-5 w-5" />
                </NavLink>
              )}
              <button
                  className={`relative p-2 rounded-full transition-colors ${
                    showJobs
                      ? "bg-gray-900 text-white"
                      : "text-gray-400 hover:bg-gray-700 hover:text-white"
                  }`}
                  onClick={() => setShowJobs((s) => !s)}
                  title="Tâches en arrière-plan"
                  aria-label="Tâches en arrière-plan"
                >
                  <JobsIcon size={18} />
                  {activeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-semibold rounded-full h-5 min-w-[20px] flex items-center justify-center px-[4px]">
                      {activeCount}
                    </span>
                  )}
                </button>
                {showJobs && (
                  <JobCenterPanel onClose={() => setShowJobs(false)} />
                )}
            </nav>
            <div className="ml-4 border-l border-gray-700 pl-4 flex items-center">
              <div className="hidden sm:block">
                <label htmlFor="season-select" className="sr-only">
                  Saison
                </label>
                <select
                  id="season-select"
                  value={currentSeason}
                  onChange={(e) => onSetCurrentSeason(e.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-sm font-medium"
                  aria-label="Sélectionner une saison"
                >
                  {seasons.map((season) => (
                    <option key={season} value={season}>
                      {season}
                    </option>
                  ))}
                </select>
              </div>
              <div className="hidden sm:block ml-2">
                <label htmlFor="league-select" className="sr-only">
                  Ligue
                </label>
                <select
                  id="league-select"
                  value={currentLeagueId}
                  onChange={(e) => onSetCurrentLeagueId(e.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-sm font-medium"
                  aria-label="Sélectionner une ligue"
                >
                  <option value="all">Toutes les ligues</option>
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ml-4 border-l border-gray-700 pl-4 flex items-center">
                <div className="text-right">
                  <p className="text-sm font-medium text-white">
                    {user?.full_name}
                  </p>
                  <p className="text-xs text-gray-400">{user?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-3 p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white"
                  title="Déconnexion"
                >
                  <LogoutIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
