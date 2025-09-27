// Centralized job type constants & helpers
// NOTE: Keep in sync between frontend and edge functions if duplicated.

export const JobKinds = {
    MissionOrdersBulkPdf: 'mission_orders.bulk_pdf',
    MissionOrdersSinglePdf: 'mission_orders.single_pdf',
    MissionOrdersSingleEmail: 'mission_orders.single_email',
    MatchSheetsBulkEmail: 'match_sheets.bulk_email', // canonical replacement for legacy mission_orders.email_bulk
    MessagingBulkEmail: 'messaging.bulk_email',
} as const;

export type JobKind = typeof JobKinds[keyof typeof JobKinds];

// Narrow helpers
export const isMissionOrdersPdf = (type: string) => type === JobKinds.MissionOrdersBulkPdf || type === JobKinds.MissionOrdersSinglePdf;
export const isMissionOrdersEmail = (type: string) => type === JobKinds.MissionOrdersSingleEmail;
export const isMatchSheetsBulkEmail = (type: string) => type === JobKinds.MatchSheetsBulkEmail;
export const isMessagingBulkEmail = (type: string) => type === JobKinds.MessagingBulkEmail;

// Minimal payload typing (Edge functions are loosely typed; frontend can create stricter interfaces)
export interface BaseJobPayload { [k: string]: any }

export interface MissionOrdersBulkPdfPayload extends BaseJobPayload {
    orders: { matchId: string; officialId: string }[];
    fileName?: string;
}

export interface MissionOrdersSinglePdfPayload extends BaseJobPayload {
    matchId: string; officialId: string; fileName?: string;
}

export interface MissionOrdersSingleEmailPayload extends BaseJobPayload {
    matchId: string; officialId: string;
}

export interface MatchSheetsBulkEmailPayload extends BaseJobPayload {
    matchIds: string[]; // which match sheets to include
    recipients: { email: string; name?: string }[];
    subject: string;
    message?: string; // plain text or fallback content
    html?: string; // optional HTML version
    attachments?: { filename: string; content: string; type?: string; disposition?: string }[];
}

export interface MessagingBulkEmailPayload extends BaseJobPayload {
    officialIds: string[]; subject: string; message: string;
}

export type AnyJobPayload = MissionOrdersBulkPdfPayload | MissionOrdersSinglePdfPayload | MissionOrdersSingleEmailPayload | MatchSheetsBulkEmailPayload | MessagingBulkEmailPayload | BaseJobPayload;

// Strict mapping from JobKind to its expected payload shape
export interface JobPayloadMap {
    [JobKinds.MissionOrdersBulkPdf]: MissionOrdersBulkPdfPayload;
    [JobKinds.MissionOrdersSinglePdf]: MissionOrdersSinglePdfPayload;
    [JobKinds.MissionOrdersSingleEmail]: MissionOrdersSingleEmailPayload;
    [JobKinds.MatchSheetsBulkEmail]: MatchSheetsBulkEmailPayload;
    [JobKinds.MessagingBulkEmail]: MessagingBulkEmailPayload;
}

// Helper to derive the payload interface for a given JobKind
export type JobPayloadFor<K extends JobKind> = K extends keyof JobPayloadMap ? JobPayloadMap[K] : BaseJobPayload;
