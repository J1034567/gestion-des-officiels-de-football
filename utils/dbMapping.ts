import { MatchStatus } from "../types";

export const mapUiStatusToDb = (status: MatchStatus): string => {
    switch (status) {
        case MatchStatus.SCHEDULED:
            return "scheduled";
        case MatchStatus.IN_PROGRESS:
            return "in_progress";
        case MatchStatus.COMPLETED:
            return "completed";
        case MatchStatus.POSTPONED:
            return "postponed";
        case MatchStatus.CANCELLED:
            return "cancelled";
        default:
            return "scheduled";
    }
};
