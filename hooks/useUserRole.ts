"use client";

/**
 * Client-side role/profile hook.
 *
 * Reads the signed-in Supabase user and the application `accounts` row. Components
 * use this for UI branching only; protected routes still enforce access server-side.
 */
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "Admin" | "Driver" | "Pengguna umum" | null;

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  buggy_id?: string | null;
}

/**
 * Shared hook for role checking across all components.
 * Returns the current user's role and profile information.
 */
export function useUserRole() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUserProfile(null);
      setLoading(false);
      return null;
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", user.id)
      .single();

    const name =
      account?.name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "User";
    const role = (account?.role as UserRole) || "Pengguna umum";
    const avatar = name.charAt(0).toUpperCase();
    const nextProfile = {
      id: user.id,
      name,
      role,
      avatar,
      buggy_id: account?.buggy_id || null,
    };

    setUserProfile(nextProfile);
    setLoading(false);
    return nextProfile;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function syncUserProfile() {
      if (!isMounted) return;
      await fetchUserProfile();
    }

    void syncUserProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      void fetchUserProfile();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const isAdmin = userProfile?.role === "Admin";
  const isDriver = userProfile?.role === "Driver";
  const isPenggunaUmum = userProfile?.role === "Pengguna umum";
  const isAuthenticated = !!userProfile;

  return {
    userProfile,
    loading,
    isAdmin,
    isDriver,
    isPenggunaUmum,
    isAuthenticated,
    role: userProfile?.role,
    refresh: fetchUserProfile,
  };
}

/**
 * Hook to check if user can perform certain actions based on their role
 */
export function useRolePermissions() {
  const { isAdmin, isDriver, isPenggunaUmum, role } = useUserRole();

  return {
    canCreateAccount: isAdmin,
    canEditAccount: isAdmin,
    canDeleteAccount: isAdmin,
    canCreateBuggy: isAdmin,
    canEditBuggy: isAdmin,
    canDeleteBuggy: isAdmin,
    canCreateGeofence: isAdmin,
    canEditGeofence: isAdmin,
    canDeleteGeofence: isAdmin,
    canViewAllBuggies: isAdmin || isPenggunaUmum,
    canViewAssignedBuggyOnly: isDriver,
    canViewDataPanel: isAdmin || isDriver,
    canViewHistoryPanel: isAdmin || isDriver,
    role,
  };
}
