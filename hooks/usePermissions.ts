import { useMemo } from 'react';
import { User, UserRole, Match, Official, Payment, AccountingStatus } from '../types';

export type Action = 
  | 'view' 
  | 'create' 
  | 'edit' 
  | 'delete' 
  | 'archive' 
  | 'assign'
  | 'send'
  | 'manage'
  | 'edit_role'
  | 'submit_accounting'
  | 'validate_accounting'
  | 'reject_accounting'
  | 'close_accounting_period'
  | 'reopen_accounting_period';

export type Resource = 
  | 'assignments'
  | 'matches' 
  | 'match' 
  | 'officials' 
  | 'official' 
  | 'official_financials'
  | 'clubs' 
  | 'club_or_stadium'
  | 'finances'
  | 'payment'
  | 'audit'
  | 'settings'
  | 'match_sheet'
  | 'availability'
  | 'league'
  | 'league_group'
  | 'users'
  | 'accounting'
  | 'disciplinary';

// A "data" object can be passed for fine-grained checks (e.g. is this the user's own data?)
type PermissionCheck = (user: User, data?: any) => boolean;

const permissionsConfig: Record<string, Partial<Record<Resource, Partial<Record<Action, PermissionCheck>>>>> = {
  [UserRole.SUPER_ADMIN]: {
    // Super Admin can do everything - will be handled by a direct check
  },
  [UserRole.ADMIN]: {
    assignments: { view: () => true },
    matches: { view: () => true, create: () => true, edit: () => true, archive: () => true },
    match: { view: () => true, edit: () => true, assign: () => true, send: () => true, archive: () => true },
    officials: { view: () => true, create: () => true, edit: () => true, archive: () => true },
    official: { view: () => true, edit: () => true, archive: () => true },
    official_financials: { manage: () => true },
    clubs: { view: () => true, create: () => true, edit: () => true, archive: () => true },
    club_or_stadium: { create: () => true, edit: () => true, archive: () => true },
    finances: { view: () => true, edit: () => true },
    payment: { view: () => true, edit: () => true },
    audit: { view: () => true },
    settings: { view: () => true, manage: () => true },
    match_sheet: { send: () => true },
    availability: { edit: () => true },
    league: { delete: () => true },
    league_group: { delete: () => true },
    users: { view: () => true },
    accounting: { view: () => true, submit_accounting: () => true, validate_accounting: () => true, reject_accounting: () => true, close_accounting_period: () => true, reopen_accounting_period: () => true },
    disciplinary: { view: () => true },
  },
  [UserRole.COORDINATOR]: {
    assignments: { view: () => true },
    matches: { view: () => true, create: () => true, edit: () => true, archive: () => true },
    match: { view: () => true, edit: () => true, assign: () => true, send: () => true, archive: () => true },
    officials: { view: () => true, create: () => true, edit: () => true, archive: () => true },
    official: { view: () => true, edit: () => true, archive: () => true },
    clubs: { view: () => true, create: () => true, edit: () => true, archive: () => true },
    club_or_stadium: { create: () => true, edit: () => true, archive: () => true },
    availability: { edit: () => true },
    match_sheet: { send: () => true },
    disciplinary: { view: () => true },
  },
  [UserRole.OFFICIAL]: {
    matches: { view: () => true },
    match: {
      view: (user, data: { match: Match, officials: Official[] }) =>
        data.match.assignments.some(a => {
            if (!a.officialId) return false;
            const official = data.officials.find(o => o.id === a.officialId);
            return !!official && official.userId === user.id;
        })
    },
    officials: { view: () => true },
    official: {
      view: (user, official: Official) => official.userId === user.id,
      edit: (user, official: Official) => official.userId === user.id,
    },
    finances: { view: () => true },
    payment: {
      view: (user, data: { payment: Payment, officials: Official[] }) => {
        const official = data.officials.find(o => o.id === data.payment.officialId);
        return !!official && official.userId === user.id;
      }
    },
    availability: {
        edit: (user, official: Official) => official.userId === user.id
    },
  },
  [UserRole.TEAM_MANAGER]: {
    matches: { view: () => true },
    match: {
      view: (user, match: Match) => match.homeTeam.id === user.teamId || match.awayTeam.id === user.teamId
    },
  },
  [UserRole.VIEWER]: {
    matches: { view: () => true },
    match: { view: () => true },
    officials: { view: () => true },
    official: { view: () => true },
    clubs: { view: () => true },
    finances: { view: () => true },
    payment: { view: () => true },
  },
  [UserRole.ACCOUNTANT_ENTRY]: {
      accounting: { view: () => true, submit_accounting: (user, match: Match) => match.accountingStatus === AccountingStatus.NOT_ENTERED || match.accountingStatus === AccountingStatus.REJECTED },
      matches: { view: () => true, edit: () => true },
      match: { edit: () => true },
      officials: { view: () => true, edit: () => true },
      official: { edit: () => true },
      clubs: { view: () => true, edit: () => true },
      club_or_stadium: { edit: () => true },
  },
  [UserRole.ACCOUNTANT_VALIDATOR]: {
      accounting: { view: () => true, validate_accounting: (user, match: Match) => match.accountingStatus === AccountingStatus.PENDING_VALIDATION, reject_accounting: (user, match: Match) => match.accountingStatus === AccountingStatus.PENDING_VALIDATION },
      matches: { view: () => true, edit: () => true },
      match: { edit: () => true },
      officials: { view: () => true, edit: () => true },
      official: { edit: () => true },
      clubs: { view: () => true, edit: () => true },
      club_or_stadium: { edit: () => true },
  },
  [UserRole.ACCOUNTANT_CLOSER]: {
      accounting: { view: () => true, close_accounting_period: () => true },
      matches: { view: () => true },
  },
};

export interface Permissions {
    can: (action: Action, resource: Resource, data?: any) => boolean;
}

export const usePermissions = (user: User | null, officials: Official[] = []): Permissions => {
  const permissions = useMemo(() => {
    const can = (action: Action, resource: Resource, data?: any): boolean => {
      if (!user) return false;

      // Super Admin has all permissions
      if (user.role === UserRole.SUPER_ADMIN) return true;

      const rolePermissions = permissionsConfig[user.role];
      if (!rolePermissions) return false;

      const resourcePermissions = rolePermissions[resource];
      if (!resourcePermissions) return false;

      const actionPermission = resourcePermissions[action];
      if (typeof actionPermission === 'function') {
        let enhancedData = data;
        if (user.role === UserRole.OFFICIAL) {
            if (resource === 'match') {
                enhancedData = { match: data, officials };
            } else if (resource === 'payment') {
                enhancedData = { payment: data, officials };
            }
        }
        return actionPermission(user, enhancedData);
      }
      
      return false;
    };

    return { can };
  }, [user, officials]);

  return permissions;
};