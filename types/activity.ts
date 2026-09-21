export type ActivityType = "issue" | "pull_request" | "review" | "commit";

export interface GiteaUser { id?: number; login?: string; full_name?: string; html_url?: string; avatar_url?: string; }
export interface ActivityRepository { id?: number; full_name?: string; name?: string; owner?: GiteaUser; html_url?: string; }
export interface Activity {
  type: ActivityType;
  source_id?: string | number | null;
  number?: number | null;
  title?: string | null;
  author?: GiteaUser | null;
  repository: ActivityRepository;
  occurred_at?: string | null;
  updated_at?: string | null;
  url?: string | null;
  state?: string | null;
  labels: ReadonlyArray<Record<string, unknown>>;
  metadata: Readonly<Record<string, unknown>>;
}
export interface PeriodRange { start: string; end: string; }
export interface ActivityStats {
  total: number;
  by_type: Record<ActivityType, number>;
  by_repository: Record<string, number>;
  by_collaborator: ReadonlyArray<{ id?: number | null; login?: string | null; count: number }>;
  by_day: Record<string, number>;
}
