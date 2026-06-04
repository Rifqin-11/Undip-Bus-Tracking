import type { UserRole } from "@/hooks/useUserRole";

export type DashboardPermissions = {
  canViewOperatorPanels: boolean;
  canManageDashboard: boolean;
  canViewHistory: boolean;
  canViewDataPanel: boolean;
  canViewAllBuggies: boolean;
  canViewAssignedBuggyOnly: boolean;
  canUseFavorites: boolean;
};

/**
 * Centralized UI capability map for the shared dashboard.
 *
 * Server routes and API handlers remain the security boundary; these flags only
 * decide which dashboard panels and controls are rendered for the current role.
 */
export function getDashboardPermissions(
  role: UserRole | undefined,
  isAuthenticated: boolean,
): DashboardPermissions {
  const isAdmin = role === "Admin";
  const isDriver = role === "Driver";
  const canViewOperatorPanels = isAdmin || isDriver;

  return {
    canViewOperatorPanels,
    canManageDashboard: isAdmin,
    canViewHistory: canViewOperatorPanels,
    canViewDataPanel: canViewOperatorPanels,
    canViewAllBuggies: isAdmin,
    canViewAssignedBuggyOnly: isDriver,
    canUseFavorites: isAuthenticated,
  };
}
