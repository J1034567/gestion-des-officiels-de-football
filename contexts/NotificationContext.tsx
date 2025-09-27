import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import Toast from "../components/Toast";

export type NotificationType = "success" | "error" | "info";

export interface NotificationState {
  id: string;
  message: string;
  type: NotificationType;
  group?: string; // logical group for replacement (e.g. job:<id>)
  createdAt: number;
  autoCloseMs?: number;
  persist?: boolean; // if true, won't auto dismiss
}

interface NotificationContextValue {
  notifications: NotificationState[];
  showNotification: (
    opts: Omit<NotificationState, "createdAt" | "id"> & { id?: string }
  ) => string; // returns id
  closeNotification: (id: string) => void;
  closeGroup: (group: string) => void;
  replaceGroup: (
    group: string,
    opts: Omit<NotificationState, "createdAt" | "id" | "group"> & {
      id?: string;
    }
  ) => string;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<NotificationState[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const scheduleAutoClose = useCallback((id: string, ms?: number) => {
    if (!ms) return;
    if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
    timersRef.current[id] = window.setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      delete timersRef.current[id];
    }, ms);
  }, []);

  const closeNotification = useCallback((id: string) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const closeGroup = useCallback((group: string) => {
    setNotifications((prev) => prev.filter((n) => n.group !== group));
  }, []);

  const showNotification = useCallback(
    (opts: Omit<NotificationState, "createdAt" | "id"> & { id?: string }) => {
      const id = opts.id || crypto.randomUUID();
      setNotifications((prev) => {
        // If same id exists replace
        const existingIdx = prev.findIndex((n) => n.id === id);
        const next = [...prev];
        const record: NotificationState = {
          id,
          message: opts.message,
          type: opts.type,
          group: opts.group,
          createdAt: Date.now(),
          autoCloseMs: opts.autoCloseMs ?? (opts.type === "info" ? 4000 : 6000),
          persist: opts.persist,
        };
        if (existingIdx >= 0) next[existingIdx] = record;
        else next.push(record);
        return next;
      });
      scheduleAutoClose(
        id,
        opts.persist
          ? undefined
          : opts.autoCloseMs ?? (opts.type === "info" ? 4000 : 6000)
      );
      return id;
    },
    [scheduleAutoClose]
  );

  const replaceGroup = useCallback(
    (
      group: string,
      opts: Omit<NotificationState, "createdAt" | "id" | "group"> & {
        id?: string;
      }
    ) => {
      // Remove existing in group then add new
      setNotifications((prev) => prev.filter((n) => n.group !== group));
      return showNotification({ ...opts, group });
    },
    [showNotification]
  );

  const clearAll = useCallback(() => {
    Object.values(timersRef.current).forEach((t) => clearTimeout(t));
    timersRef.current = {};
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        showNotification,
        closeNotification,
        closeGroup,
        replaceGroup,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotificationContext must be used within NotificationProvider"
    );
  return ctx;
};

export const NotificationToaster: React.FC = () => {
  const { notifications, closeNotification } = useNotificationContext();
  return (
    <div className="fixed top-5 right-5 z-[100] flex flex-col gap-3 w-full max-w-sm">
      {notifications
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((n) => (
          <Toast
            key={n.id}
            notification={{ message: n.message, type: n.type }}
            onClose={() => closeNotification(n.id)}
          />
        ))}
    </div>
  );
};
