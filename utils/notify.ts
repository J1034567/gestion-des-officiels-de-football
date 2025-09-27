import type { NotificationType } from "../contexts/NotificationContext";

// Accept both legacy positional signature and new object signature
export type NotifyFn = (
    message: string,
    type?: NotificationType
) => any; // showNotification returns an id

export function makeNotifier(show: (
    message: string,
    type?: NotificationType
) => any) {
    return {
        success: (msg: string) => show(msg, "success"),
        error: (msg: string) => show(msg, "error"),
        info: (msg: string) => show(msg, "info"),
    } as const;
}
