import React from "react";
import Auth from "./components/Auth";
import {
  NotificationProvider,
  NotificationToaster,
} from "./contexts/NotificationContext";
import { AppRouter } from "./components/AppRouter";
import { useAuth } from "./contexts/AuthContext";
import VerificationPage from "./components/VerificationPage";

const App: React.FC = () => {
  const { session, isLoading } = useAuth();
  // Notifications handled via global NotificationProvider

  const isVerificationPage = React.useMemo(() => {
    return window.location.hash.startsWith("#/verify/");
  }, []);

  if (isVerificationPage) {
    return <VerificationPage />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-gray-900">
        <NotificationToaster />
        {!session ? <Auth /> : <AppRouter />}
      </div>
    </NotificationProvider>
  );
};

export default App;
