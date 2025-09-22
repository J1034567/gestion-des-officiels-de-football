// contexts/AuthContext.tsx

import React, { createContext, useContext, useMemo } from "react";
import {
  useSession,
  useUser as useSupabaseUser,
} from "@supabase/auth-helpers-react";
import { Session } from "@supabase/supabase-js";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { usePermissions, Permissions } from "../hooks/usePermissions";
import { User, Official } from "../types";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

// A lightweight query to get only the data needed for the permissions hook
function useOfficialIdentities() {
  return useQuery<Partial<Official>[]>({
    queryKey: ["officialIdentities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("officials")
        .select("id, user_id");
      if (error) throw error;
      // The `usePermissions` hook expects a partial `Official[]`, so we map user_id to the correct property name
      return data.map((o) => ({ id: o.id, userId: o.user_id })) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!useSupabaseUser(), // Only run if there is a supabase user
  });
}

interface AuthContextType {
  user: User | null;
  permissions: Permissions;
  isLoading: boolean;
  session: Session | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const session = useSession();
  const supabaseUser = useSupabaseUser();

  const {
    data: user,
    isLoading: isUserLoading,
    isFetching: isUserFetching,
  } = useCurrentUser(supabaseUser?.id);
  
  const { data: officials, isLoading: isOfficialsLoading } =
    useOfficialIdentities();

// FIX: Cast `officials` to `Official[]`. The `usePermissions` hook expects the full type,
  // but for its logic, it only requires the `id` and `userId` fields which are provided by `useOfficialIdentities`.
  // This cast resolves the type error without altering the hook's signature.
  const permissions = usePermissions(user, (officials as Official[]) || []);

  const isLoading =
    (session === undefined) || isUserLoading || isUserFetching || (!!session && isOfficialsLoading);

  const value = useMemo(
    () => ({
      user: user || null,
      permissions,
      isLoading,
      session,
    }),
    [user, permissions, isLoading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
