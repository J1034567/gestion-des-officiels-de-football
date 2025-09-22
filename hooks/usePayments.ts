// hooks/usePayments.ts
import { useQuery } from '@tanstack/react-query';
import { SupabaseQueryBuilder } from '../lib/supabaseQueryBuilder.ts';
import { QueryOptions, PaginatedResponse } from '../types/query.types.ts';
import { AccountingStatus, Payment } from '../types';

export function usePayments(options: QueryOptions = {}) {
    // There is no public.payments table. Build payments from match_assignments + matches.
    return useQuery<PaginatedResponse<Payment>>({
        queryKey: ['payments', options],
        queryFn: async () => {
            const assignmentsResp = await SupabaseQueryBuilder.executePaginatedQuery<any>(
                'match_assignments',
                `
          *,
          official:officials!match_assignments_official_id_fkey(*),
          match:matches(
            *,
            homeTeam:teams!matches_home_team_id_fkey(*),
            awayTeam:teams!matches_away_team_id_fkey(*),
            leagueGroup:league_groups!matches_league_group_id_fkey(
              *,
              league:leagues(*)
                        ),
                        validatedBy:profiles!matches_validated_by_fkey(full_name)
          )
        `,
                options
            );

            // Map assignments to Payment shape
            const data: Payment[] = (assignmentsResp.data || [])
                .filter((a: any) => !!a.official_id) // only payments for assigned officials
                .map((a: any) => {
                    const match = a.match;
                    const official = a.official;
                    const indemnity = Number(a.indemnity_amount ?? 0);
                    const travelKm = Number(a.travel_distance_km ?? 0);
                    // IRG calculation is not stored; approximate at 0 for now (frontend will still work)
                    const irgAmount = Number(a.irg_amount ?? 0);
                    const total = indemnity - irgAmount;
                    const accountingStatus = (match?.accounting_status as AccountingStatus) || AccountingStatus.NOT_ENTERED;
                    return {
                        id: a.id,
                        officialId: a.official_id,
                        matchId: a.match_id,
                        leagueId: match?.leagueGroup?.league?.id || '',
                        groupId: match?.leagueGroup?.id || match?.league_group_id || '',
                        matchDescription: match ? `${match.homeTeam?.name || ''} vs ${match.awayTeam?.name || ''}` : '',
                        matchDate: match?.match_date || '',
                        officialName: official?.full_name || [official?.first_name, official?.last_name].filter(Boolean).join(' ') || '',
                        role: a.role,
                        indemnity,
                        travelDistanceInKm: travelKm,
                        irgAmount,
                        total,
                        accountingStatus,
                        notes: a.notes || null,
                        originalOfficialId: a.original_official_id || null,
                        validatedByUserId: match?.validated_by || null,
                        validatedAt: match?.validated_at || null,
                        validatedByName: match?.validatedBy?.full_name || undefined,
                    } as Payment;
                });

            return { ...assignmentsResp, data } as PaginatedResponse<Payment>;
        },
        enabled: options.enabled !== false,
    });
}