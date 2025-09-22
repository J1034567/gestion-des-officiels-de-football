
import { useState, useCallback, useRef } from 'react';

export interface Notification {
  message: string;
  type: 'success' | 'error' | 'info';
}

export const useNotification = (): [Notification | null, (message: string, type: Notification['type']) => void, () => void] => {
  const [notification, setNotification] = useState<Notification | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const closeNotification = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setNotification(null);
  }, []);

  const showNotification = useCallback((message: string, type: Notification['type']) => {
    closeNotification(); // Clear any existing notification and its timeout
    setNotification({ message, type });
    timeoutRef.current = window.setTimeout(() => {
      closeNotification();
    }, 5000); // Auto-dismiss after 5 seconds
  }, [closeNotification]);

  return [notification, showNotification, closeNotification];
};
