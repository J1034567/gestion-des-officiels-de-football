
export interface Location {
  id: string;
  wilaya: string | null;
  daira: string | null;
  commune: string | null;
  latitude: number | null;
  longitude: number | null;
  wilaya_ar: string | null;
  commune_ar: string | null;
  daira_ar: string | null;
}

export type OfficialRole = string; // From settings: 'referee', 'assistant_referee_1', etc.

export enum PaymentStatus {
  PENDING_ENTRY = 'En attente de saisie',
  PENDING_VALIDATION = 'En attente de validation',
  REJECTED = 'Rejeté',
  READY_TO_PAY = 'Prêt à payer',
  PAID = 'Payé et Clôturé'
}


// Map new DB roles to a more descriptive frontend enum
export enum UserRole {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  COORDINATOR = "coordinator",
  OFFICIAL = "official",
  TEAM_MANAGER = "team_manager",
  VIEWER = "viewer",
  ACCOUNTANT_ENTRY = "accountant_entry",
  ACCOUNTANT_VALIDATOR = "accountant_validator",
  ACCOUNTANT_CLOSER = "accountant_closer"
}

// Aligned with new DB ENUM 'match_status'
export enum MatchStatus {
  SCHEDULED = "Prévu", // scheduled
  IN_PROGRESS = "En cours", // in_progress
  COMPLETED = "Joué", // completed
  POSTPONED = "Reporté", // postponed
  CANCELLED = "Annulé" // cancelled
}

// Aligned with new DB ENUM 'accounting_status'
export enum AccountingStatus {
  NOT_ENTERED = "not_entered", // Non saisi
  PENDING_VALIDATION = "pending_validation", // En attente de validation
  VALIDATED = "validated", // Validé
  REJECTED = "rejected", // Rejeté
  CLOSED = "closed" // Clos
}

// Aligned with new DB ENUM 'accounting_period_type'
export enum AccountingPeriodType {
  DAILY = "daily",
  MONTHLY = "monthly",
  PAYMENT_BATCH = "payment_batch"
}

// Aligned with new DB ENUM 'accounting_period_status'
export enum AccountingPeriodStatus {
  OPEN = "open",
  CLOSED = "closed"
}


export interface User {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  teamId?: string | null;
  email?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string | null;
  userName: string;
  userEmail?: string;
  action: string;
  tableName?: string;
  recordId?: string;
  oldValues?: any;
  newValues?: any;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface Unavailability {
  id: string;
  startDate: string; // start_date
  endDate: string;   // end_date
  reason?: string;
  isApproved: boolean;
}

export interface Official {
  id: string;
  firstName: string;
  lastName: string;
  firstNameAr: string;
  lastNameAr: string;
  fullName: string;
  category: string; // official_category enum
  locationId: string | null;
  address: string | null;
  position: number | null;
  email: string | null;
  phone: string | null;
  bankAccountNumber: string | null;
  dateOfBirth: string | null;
  isActive: boolean;
  isArchived: boolean;
  userId: string | null;
  unavailabilities: Unavailability[];
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
}

export interface Assignment {
  id: string;
  matchId: string;
  role: OfficialRole; // assignment_role enum
  officialId: string | null;
  originalOfficialId?: string | null;
  isConfirmed: boolean;
  confirmedAt: string | null;
  travelDistanceInKm: number | null;
  indemnityAmount: number | null;
  notes: string | null;
  isNew?: boolean;
  createdBy?: string;
}

export interface Team {
  id: string;
  code: string;
  name: string;
  fullName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  foundedYear: number | null;
  isArchived: boolean;
  createdAt: string;
  createdBy: string | null;
  createdByName: string;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
}

export interface Stadium {
  id: string;
  name: string;
  nameAr: string | null;
  locationId: string | null;
  isArchived: boolean;
  createdAt: string;
  createdBy: string | null;
  createdByName: string;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
}

export interface League {
  id: string;
  name: string;
  name_ar: string;
  level: number;
  parent_league_id: string | null;
}

export interface LeagueGroup {
  id: string;
  name: string;
  name_ar: string;
  league_id: string;
  season: string;
  teamIds: string[];
}

export interface Match {
  id: string;
  season: string;
  gameDay: number;
  leagueGroup: {
    id: string;
    name: string;
    name_ar: string;
    league: {
      id: string;
      name: string;
      name_ar: string;
    }
  };
  matchDate: string | null; // match_date
  matchTime: string | null; // match_time
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  stadium: Stadium | null;
  status: MatchStatus;
  assignments: Assignment[];
  isSheetSent: boolean;
  hasUnsentChanges: boolean;
  isArchived: boolean;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
  // Accounting fields
  accountingStatus: AccountingStatus;
  rejectionReason: string | null;
  rejectionComment: string | null;
  validatedBy: string | null;
  validatedByName?: string;
  validatedAt: string | null;
  accountingPeriodId: string | null;
}

export interface AccountingPeriod {
  id: string;
  type: AccountingPeriodType;
  periodDate: string; // period_date
  status: AccountingPeriodStatus;
  closedBy: string | null;
  closedByName?: string;
  closedAt: string | null;
  reopenedBy: string | null;
  reopenedByName?: string;
  reopenedAt: string | null;
  leagueGroupId?: string | null;
  gameDay?: number | null;
  season?: string | null;
}

export interface PaymentBatch extends AccountingPeriod {
  reference: string;
  totalAmount: number;
  paymentCount: number;
  debitAccountNumber: string;
  transactionId?: string | null;
  proofOfPaymentUrl?: string | null;
  proofOfPaymentFilename?: string | null;
}

export type NavigationTab = 'planning' | 'classements' | 'disciplinary' | 'officials' | 'finances' | 'clubs' | 'settings' | 'audit' | 'accounting' | 'virements' | 'etats';

export type IndemnityRates = {
  [leagueId: string]: { [role in OfficialRole]?: number };
};

export interface TeamHistoryEntry {
  season: string;
  leagueName: string;
  groupName: string;
}

// Synthetic type for the Finances view, derived from match_assignments
export interface Payment {
  id: string; // assignment id
  officialId: string;
  matchId: string;
  leagueId: string;
  groupId: string;
  matchDescription: string;
  matchDate: string;
  officialName: string;
  role: OfficialRole;
  indemnity: number; // This is the GROSS amount
  travelDistanceInKm: number;
  irgAmount: number; // The calculated tax amount
  total: number; // This is now the NET amount
  accountingStatus: AccountingStatus;
  notes: string | null;
  originalOfficialId?: string | null;
  validatedByUserId: string | null;
  validatedAt: string | null;
  validatedByName?: string;
}


export interface TeamSeasonStadium {
  id: string;
  teamId: string;
  stadiumId: string;
  season: string;
}

export interface FinancialSettings {
  irgRatePercent: number;
}

export interface DisciplinarySettings {
  yellowCardThreshold: number;
  yellowCardSuspension: number;
  directRedCardSuspension: number;
  twoYellowsRedCardSuspension: number;
}

export interface OptimizationSettings {
  travelSpeedKmph: number;
  bufferMin: number;
  matchDurationMin: number;
  defaultMatchRisk: number;
  categoryGradeMap: { [category: string]: number };
  categoryCapacityMap: { [category: string]: number };
}

// --- Disciplinary Module Types ---

export enum SanctionType {
  YELLOW_CARD = 'YELLOW_CARD',
  RED_CARD_DIRECT = 'RED_CARD_DIRECT',
  RED_CARD_TWO_YELLOWS = 'RED_CARD_TWO_YELLOWS',
  SUSPENSION_COMMISSION = 'SUSPENSION_COMMISSION',
  OTHER = 'OTHER'
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  licenseNumber: string;
  currentTeamId: string | null;
  isArchived: boolean;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
}

export interface Sanction {
  id: string;
  playerId: string;
  matchId: string | null;
  type: SanctionType;
  reason?: string;
  decisionDate: string;
  suspensionMatches: number;
  fineAmount?: number;
  matchesServed: number;
  isCancelled: boolean;
  notes?: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

export interface Ranking {
  team: Team;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}


// --- ROLE HELPERS ---

// Helper to map DB role names to frontend UserRole enum
export const mapDbRoleToEnum = (dbRole?: string): UserRole => {
  switch (dbRole) {
    case 'super_admin': return UserRole.SUPER_ADMIN;
    case 'admin': return UserRole.ADMIN;
    case 'coordinator': return UserRole.COORDINATOR;
    case 'official': return UserRole.OFFICIAL;
    case 'team_manager': return UserRole.TEAM_MANAGER;
    case 'viewer': return UserRole.VIEWER;
    case 'accountant_entry': return UserRole.ACCOUNTANT_ENTRY;
    case 'accountant_validator': return UserRole.ACCOUNTANT_VALIDATOR;
    case 'accountant_closer': return UserRole.ACCOUNTANT_CLOSER;
    default: return UserRole.VIEWER; // Default to least privileged
  }
}

// Helper to map frontend UserRole enum to a displayable string
export const mapEnumToDisplayRole = (enumRole?: UserRole | string): string => {
  switch (enumRole) {
    case 'super_admin': return "Super Admin";
    case 'admin': return "Admin";
    case 'coordinator': return "Coordinateur";
    case 'official': return "Officiel";
    case 'team_manager': return "Manager d'Équipe";
    case 'viewer': return "Visiteur";
    case 'accountant_entry': return "Comptable - Saisie";
    case 'accountant_validator': return "Comptable - Validateur";
    case 'accountant_closer': return "Comptable - Clôtureur";
    default: return "Visiteur";
  }
}

// --- SANCTION HELPERS ---
export const mapSanctionTypeToDisplay = (type?: SanctionType | string): string => {
  switch (type) {
    case SanctionType.YELLOW_CARD: return "Carton Jaune";
    case SanctionType.RED_CARD_DIRECT: return "Carton Rouge Direct";
    case SanctionType.RED_CARD_TWO_YELLOWS: return "Carton Rouge (2 Avert.)";
    case SanctionType.SUSPENSION_COMMISSION: return "Suspension (Commission)";
    case SanctionType.OTHER: return "Autre Infraction";
    default: return type || "Inconnu";
  }
};