import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { JobCenterProvider } from "./hooks/useJobCenter";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { supabase } from "./lib/supabaseClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient.ts";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <SessionContextProvider supabaseClient={supabase}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <JobCenterProvider>
            <App />
          </JobCenterProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SessionContextProvider>
  </React.StrictMode>
);
