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
  message: string;
  type: NotificationType;
}

interface NotificationContextValue {
  notification: NotificationState | null;
  showNotification: (message: string, type: NotificationType) => void;
  closeNotification: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notification, setNotification] = useState<NotificationState | null>(
    null
  );
  const timeoutRef = useRef<number | null>(null);

  const closeNotification = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setNotification(null);
  }, []);

  const showNotification = useCallback(
    (message: string, type: NotificationType) => {
      // Clear any existing toast and its timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setNotification({ message, type });
      timeoutRef.current = window.setTimeout(() => {
        closeNotification();
      }, 5000);
    },
    [closeNotification]
  );

  return (
    <NotificationContext.Provider
      value={{ notification, showNotification, closeNotification }}
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
  const { notification, closeNotification } = useNotificationContext();
  return notification ? (
    <Toast notification={notification} onClose={closeNotification} />
  ) : null;
};
