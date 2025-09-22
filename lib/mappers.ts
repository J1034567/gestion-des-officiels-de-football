import { AccountingStatus, Assignment, League, LeagueGroup, Match, MatchStatus, Official, Stadium, Team } from '../types';

export const mapTeam = (t: any): Team => ({
    id: t.id,
    code: t.code,
    name: t.name,
    fullName: t.full_name ?? null,
    logoUrl: t.logo_url ?? null,
    primaryColor: t.primary_color ?? null,
    secondaryColor: t.secondary_color ?? null,
    foundedYear: t.founded_year ?? null,
    isArchived: !!t.is_archived,
    createdAt: t.created_at,
    createdBy: t.created_by ?? null,
    createdByName: t.createdByName ?? 'Système',
    updatedAt: t.updated_at ?? null,
    updatedBy: t.updated_by ?? null,
    updatedByName: t.updatedByName ?? null,
});

export const mapStadium = (s: any): Stadium => ({
    id: s.id,
    name: s.name,
    nameAr: s.name_ar ?? null,
    locationId: s.location_id ?? null,
    isArchived: !!s.is_archived,
    createdAt: s.created_at,
    createdBy: s.created_by ?? null,
    createdByName: s.createdByName ?? 'Système',
    updatedAt: s.updated_at ?? null,
    updatedBy: s.updated_by ?? null,
    updatedByName: s.updatedByName ?? null,
});

export const mapOfficial = (o: any): Official => {
    const westernName = `${o.first_name || ''} ${o.last_name || ''}`.trim();
    const arabicName = `${o.first_name_ar || ''} ${o.last_name_ar || ''}`.trim();
    const fullName = [westernName, arabicName && `(${arabicName})`].filter(Boolean).join(' ');
    const srcUnavs = Array.isArray(o.unavailabilities)
        ? o.unavailabilities
        : Array.isArray(o.official_unavailabilities)
            ? o.official_unavailabilities
            : [];
    const unavailabilities = srcUnavs.map((u: any) => ({
        id: u.id,
        startDate: u.start_date,
        endDate: u.end_date,
        reason: u.reason,
        isApproved: !!u.is_approved,
    }));
    return {
        id: o.id,
        firstName: o.first_name,
        lastName: o.last_name,
        firstNameAr: o.first_name_ar,
        lastNameAr: o.last_name_ar,
        fullName,
        category: o.category,
        locationId: o.location_id ?? null,
        address: o.address ?? null,
        position: o.position ?? null,
        email: o.email ?? null,
        phone: o.phone ?? null,
        bankAccountNumber: o.bank_account_number ?? null,
        dateOfBirth: o.date_of_birth ?? null,
        isActive: !!o.is_active,
        isArchived: !!o.is_archived,
        userId: o.user_id ?? null,
        unavailabilities,
        createdAt: o.created_at,
        createdBy: o.created_by ?? null,
        createdByName: o.createdByName ?? 'Système',
        updatedAt: o.updated_at ?? null,
        updatedBy: o.updated_by ?? null,
        updatedByName: o.updatedByName ?? null,
    };
};

export const mapAssignment = (a: any): Assignment => ({
    id: a.id,
    matchId: a.match_id,
    role: a.role,
    officialId: a.official_id ?? null,
    originalOfficialId: a.original_official_id ?? null,
    isConfirmed: !!a.is_confirmed,
    confirmedAt: a.confirmed_at ?? null,
    travelDistanceInKm: a.travel_distance_km ?? null,
    indemnityAmount: a.indemnity_amount ?? null,
    notes: a.notes ?? null,
    createdBy: a.created_by,
});

export const mapLeague = (l: any): League => ({
    id: l.id,
    name: l.name,
    name_ar: l.name_ar,
    level: l.level,
    parent_league_id: l.parent_league_id ?? null,
});

export const mapLeagueGroup = (lg: any): LeagueGroup => ({
    id: lg.id,
    name: lg.name,
    name_ar: lg.name_ar,
    league_id: lg.league_id,
    season: lg.season,
    teamIds: Array.isArray(lg.league_group_teams) ? lg.league_group_teams.map((t: any) => t.team_id) : (lg.teamIds || []),
});

const mapDbStatusToUi = (status: string): MatchStatus => {
    switch (status) {
        case 'scheduled':
            return MatchStatus.SCHEDULED;
        case 'completed':
            return MatchStatus.COMPLETED;
        case 'postponed':
            return MatchStatus.POSTPONED;
        case 'cancelled':
            return MatchStatus.CANCELLED;
        case 'in_progress':
            return MatchStatus.IN_PROGRESS;
        default:
            return MatchStatus.SCHEDULED;
    }
};

export const mapMatch = (m: any): Match | null => {
    if (!m.homeTeam || !m.awayTeam) return null;
    const league = m.leagueGroup?.league ? mapLeague(m.leagueGroup.league) : { id: '', name: 'Ligue non définie', name_ar: '', level: 0, parent_league_id: null } as League;
    const leagueGroup: Match['leagueGroup'] = m.leagueGroup
        ? { id: m.leagueGroup.id, name: m.leagueGroup.name, name_ar: m.leagueGroup.name_ar, league }
        : { id: '', name: 'Groupe non défini', name_ar: '', league };

    return {
        id: m.id,
        season: m.season,
        gameDay: m.game_day,
        leagueGroup,
        matchDate: m.match_date ?? null,
        matchTime: m.match_time ?? null,
        homeTeam: mapTeam(m.homeTeam),
        awayTeam: mapTeam(m.awayTeam),
        homeScore: m.home_score ?? null,
        awayScore: m.away_score ?? null,
        stadium: m.stadium ? mapStadium(m.stadium) : null,
        status: mapDbStatusToUi(m.status),
        assignments: Array.isArray(m.assignments) ? m.assignments.map(mapAssignment) : [],
        isSheetSent: !!m.is_sheet_sent,
        hasUnsentChanges: !!m.has_unsent_changes,
        isArchived: !!m.is_archived,
        createdAt: m.created_at,
        createdBy: m.created_by,
        createdByName: m.createdByName ?? 'Système',
        updatedAt: m.updated_at ?? null,
        updatedBy: m.updated_by ?? null,
        updatedByName: m.updatedByName ?? null,
        accountingStatus: (m.accounting_status as AccountingStatus) ?? AccountingStatus.NOT_ENTERED,
        rejectionReason: m.rejection_reason ?? null,
        rejectionComment: m.rejection_comment ?? null,
        validatedBy: m.validated_by ?? null,
        validatedByName: m.validatedBy?.full_name,
        validatedAt: m.validated_at ?? null,
        accountingPeriodId: m.accounting_period_id ?? null,
    };
};
