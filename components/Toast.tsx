import React from "react";
import CheckCircleIcon from "./icons/CheckCircleIcon";
import AlertTriangleIcon from "./icons/AlertTriangleIcon";
import CloseIcon from "./icons/CloseIcon";

// Local minimal notification shape (decoupled from any legacy hook)
interface BasicNotification {
  message: string;
  type?: string;
}

interface ToastProps {
  notification: BasicNotification;
  onClose: () => void;
}

const toastStyles: Record<
  string,
  { bg: string; iconColor: string; icon: React.ReactNode }
> = {
  success: {
    bg: "bg-green-600",
    iconColor: "text-green-300",
    icon: <CheckCircleIcon className="h-6 w-6" />,
  },
  error: {
    bg: "bg-red-600",
    iconColor: "text-red-300",
    icon: <AlertTriangleIcon className="h-6 w-6" />,
  },
  info: {
    bg: "bg-blue-600",
    iconColor: "text-blue-300",
    icon: <AlertTriangleIcon className="h-6 w-6" />,
  },
  warning: {
    bg: "bg-yellow-600",
    iconColor: "text-yellow-200",
    icon: <AlertTriangleIcon className="h-6 w-6" />,
  },
};

const Toast: React.FC<ToastProps> = ({ notification, onClose }) => {
  let { message, type = "info" } = notification;
  if (!message || (typeof message === "string" && message.trim() === "")) {
    message = "…"; // fallback placeholder to avoid blank toast
  }
  const styles = toastStyles[type] || toastStyles["info"];
  return (
    <div
      className={`flex items-center p-4 rounded-lg shadow-lg text-white ${styles.bg} animate-fade-in-right`}
      role="alert"
    >
      <div className={`flex-shrink-0 ${styles.iconColor}`}>{styles.icon}</div>
      <div className="ml-3 text-sm font-medium flex-grow">{message}</div>
      <button
        onClick={onClose}
        className="ml-auto -mx-1.5 -my-1.5 bg-white/10 text-white rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-white/20 inline-flex h-8 w-8"
        aria-label="Close"
      >
        <span className="sr-only">Close</span>
        <CloseIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

export default Toast;
