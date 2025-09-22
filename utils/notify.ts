export type NotifyFn = (message: string, type?: "success" | "error" | "info") => void;

export function makeNotifier(show: NotifyFn) {
    return {
        success: (msg: string) => show(msg, "success"),
        error: (msg: string) => show(msg, "error"),
        info: (msg: string) => show(msg, "info"),
    } as const;
}
