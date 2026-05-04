export type Announcement = {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "alert";
  is_active: boolean;
  created_at: string;
};
