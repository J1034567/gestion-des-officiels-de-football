import { Player, Match, Sanction, DisciplinarySettings, SanctionType } from '../types';

export interface SuspensionStatus {
    isSuspended: boolean;
    reason: string | null;
}

/**
 * Calculates if a player is suspended for a specific match.
 * This model assumes suspensions are served consecutively in completed matches for the player's team.
 */
export const getSuspensionStatusForMatch = (
    player: Player,
    targetMatch: Match,
    allSanctions: Sanction[],
    allMatches: Match[],
    settings: DisciplinarySettings
): SuspensionStatus => {

    if (!targetMatch.matchDate) {
        return { isSuspended: false, reason: null };
    }

    // 1. Get all relevant sanctions for the player up to (but not including) the target match day.
    const relevantSanctions = allSanctions
        .filter(s =>
            s.playerId === player.id &&
            !s.isCancelled &&
            new Date(s.decisionDate) < new Date(targetMatch.matchDate!)
        )
        .sort((a, b) => new Date(a.decisionDate).getTime() - new Date(b.decisionDate).getTime());

    if (relevantSanctions.length === 0) {
        return { isSuspended: false, reason: null };
    }

    // 2. Calculate the total suspension debt from red cards and commission decisions.
    let totalSuspensionDebt = relevantSanctions
        .filter(s => s.type !== SanctionType.YELLOW_CARD)
        .reduce((sum, s) => sum + s.suspensionMatches, 0);
    
    // 3. Calculate suspension debt from yellow card accumulation
    const yellowCards = relevantSanctions.filter(s => s.type === SanctionType.YELLOW_CARD);
    if (settings.yellowCardThreshold > 0 && settings.yellowCardSuspension > 0) {
        const yellowCardSuspensions = Math.floor(yellowCards.length / settings.yellowCardThreshold);
        totalSuspensionDebt += yellowCardSuspensions * settings.yellowCardSuspension;
    }


    if (totalSuspensionDebt === 0) {
        return { isSuspended: false, reason: null };
    }
    
    // 4. Find the date of the first sanction to start counting served matches from.
    const firstSanctionDate = new Date(relevantSanctions[0].decisionDate);

    // 5. Count how many matches the player's team has played SINCE THE FIRST SANCTION and BEFORE THE TARGET MATCH.
    // This represents the number of suspension matches already served.
    const matchesServed = allMatches
        .filter(m =>
            !m.isArchived &&
            m.status === 'Joué' && // MatchStatus.COMPLETED
            m.matchDate &&
            player.currentTeamId &&
            (m.homeTeam.id === player.currentTeamId || m.awayTeam.id === player.currentTeamId) &&
            new Date(m.matchDate) >= firstSanctionDate &&
            new Date(m.matchDate) < new Date(targetMatch.matchDate!)
        ).length;
        
    // 6. Compare debt with served matches.
    if (matchesServed < totalSuspensionDebt) {
        const remaining = totalSuspensionDebt - matchesServed;
        return { isSuspended: true, reason: `Suspendu (reste ${remaining} match(s) à purger)` };
    }

    return { isSuspended: false, reason: null };
};


export interface CurrentSuspensionStatus {
    isSuspended: boolean;
    remainingMatches: number;
}

/**
 * Calculates a player's current suspension status based on all their sanctions.
 */
export const getCurrentSuspensionStatus = (
    player: Player,
    allSanctions: Sanction[],
    allMatches: Match[],
    settings: DisciplinarySettings
): CurrentSuspensionStatus => {
    // 1. Get all relevant, active sanctions for the player.
    const relevantSanctions = allSanctions
        .filter(s => s.playerId === player.id && !s.isCancelled)
        .sort((a, b) => new Date(a.decisionDate).getTime() - new Date(b.decisionDate).getTime());

    if (relevantSanctions.length === 0) {
        return { isSuspended: false, remainingMatches: 0 };
    }

    // 2. Calculate total suspension debt from red cards and commission decisions.
    let totalSuspensionDebt = relevantSanctions
        .filter(s => s.type !== SanctionType.YELLOW_CARD)
        .reduce((sum, s) => sum + s.suspensionMatches, 0);
    
    // 3. Calculate suspension debt from yellow card accumulation.
    const yellowCards = relevantSanctions.filter(s => s.type === SanctionType.YELLOW_CARD);
    if (settings.yellowCardThreshold > 0 && settings.yellowCardSuspension > 0) {
        const yellowCardSuspensions = Math.floor(yellowCards.length / settings.yellowCardThreshold);
        totalSuspensionDebt += yellowCardSuspensions * settings.yellowCardSuspension;
    }

    if (totalSuspensionDebt === 0) {
        return { isSuspended: false, remainingMatches: 0 };
    }
    
    // 4. Find the date of the first sanction to start counting served matches from.
    const firstSanctionDate = new Date(relevantSanctions[0].decisionDate);

    // 5. Count how many matches the player's team has played SINCE THE FIRST SANCTION.
    const matchesServed = allMatches
        .filter(m =>
            !m.isArchived &&
            m.status === 'Joué' && // MatchStatus.COMPLETED
            m.matchDate &&
            player.currentTeamId &&
            (m.homeTeam.id === player.currentTeamId || m.awayTeam.id === player.currentTeamId) &&
            new Date(m.matchDate) >= firstSanctionDate
        ).length;
        
    // 6. Compare debt with served matches.
    const remainingMatches = totalSuspensionDebt - matchesServed;

    if (remainingMatches > 0) {
        return { isSuspended: true, remainingMatches: remainingMatches };
    }

    return { isSuspended: false, remainingMatches: 0 };
};
