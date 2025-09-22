export function logAndThrow(label: string, error: any, details?: Record<string, any>): never {
    try {
        // Grouped console output for readability
        // eslint-disable-next-line no-console
        console.group(`Supabase Error: ${label}`);
        // eslint-disable-next-line no-console
        console.error('Message:', error?.message || error);
        if (error) {
            // eslint-disable-next-line no-console
            console.error('Error object:', error);
        }
        if (details) {
            // eslint-disable-next-line no-console
            console.log('Context:', details);
        }
        // eslint-disable-next-line no-console
        console.groupEnd();
    } catch {
        // ignore console failures
    }
    throw error;
}

export function logWarning(label: string, details?: Record<string, any>): void {
    try {
        // eslint-disable-next-line no-console
        console.warn(label, details || '');
    } catch { }
}