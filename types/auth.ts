export type UserRole = "collaborator" | "admin";
export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  gitea: { connected: boolean; user_id?: number; username?: string };
}
