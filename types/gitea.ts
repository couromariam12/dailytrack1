export interface GiteaRepository {
  id: number;
  name: string;
  full_name?: string;
  owner: { id?: number; login: string; full_name?: string; html_url?: string };
  description?: string | null;
  html_url?: string | null;
  private?: boolean;
  archived?: boolean;
}
export interface CollectionWarning {
  repository?: string | null;
  types: ReadonlyArray<string>;
  status?: number | null;
  message?: string;
}
