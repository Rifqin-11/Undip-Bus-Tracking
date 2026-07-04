"use client";

import type { ComponentProps } from "react";
import { BuggyList } from "@/components/buggy/PanelActive";
import { AdminDataSection } from "@/components/admin/fleet/AdminDataSection";
import { BuggyOperationalDetail } from "@/components/admin/fleet/BuggyOperationalDetail";
import { HistoryPanel } from "@/components/history/HistoryPanel";
import { AppSettingsPanel } from "@/components/settings/AppSettingsPanel";
import type { Buggy } from "@/types/buggy";

type DashboardSidePanelProps = Omit<
  ComponentProps<typeof BuggyList>,
  | "dataViewContent"
  | "dataDetailViewContent"
  | "historyViewContent"
  | "settingsViewContent"
> & {
  canViewDataPanel: boolean;
  canViewHistory: boolean;
  adminDataProps: ComponentProps<typeof AdminDataSection>;
  selectedAdminBuggy: Buggy | null;
  assignedDriverName?: string;
  activeZones: string[];
  onDetailBack: () => void;
  onDetailDeleteSuccess: () => void;
  onDetailSaved: () => void;
  historyPanelProps: ComponentProps<typeof HistoryPanel>;
  settingsPanelProps: ComponentProps<typeof AppSettingsPanel>;
};

export function DashboardSidePanel({
  canViewDataPanel,
  canViewHistory,
  adminDataProps,
  selectedAdminBuggy,
  assignedDriverName,
  activeZones,
  onDetailBack,
  onDetailDeleteSuccess,
  onDetailSaved,
  historyPanelProps,
  settingsPanelProps,
  ...buggyListProps
}: DashboardSidePanelProps) {
  return (
    <BuggyList
      {...buggyListProps}
      dataViewContent={
        canViewDataPanel ? <AdminDataSection {...adminDataProps} /> : null
      }
      dataDetailViewContent={
        canViewDataPanel && selectedAdminBuggy ? (
          <BuggyOperationalDetail
            buggy={selectedAdminBuggy}
            assignedDriverName={assignedDriverName}
            activeZones={activeZones}
            onBack={onDetailBack}
            onDeleteSuccess={onDetailDeleteSuccess}
            onSaved={onDetailSaved}
            readOnly={adminDataProps.readOnly}
          />
        ) : null
      }
      historyViewContent={
        canViewHistory ? <HistoryPanel {...historyPanelProps} /> : null
      }
      settingsViewContent={<AppSettingsPanel {...settingsPanelProps} />}
    />
  );
}
