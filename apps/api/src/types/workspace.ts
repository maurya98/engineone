export interface Workspace {
  id: string;
  name: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: 'admin' | 'member';
  created_at: Date;
}

export interface Repository {
  id: string;
  workspace_id: string;
  name: string;
  default_branch_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface RepoMember {
  repo_id: string;
  user_id: string;
  role: 'maintainer' | 'developer' | 'qa';
  created_at: Date;
}
