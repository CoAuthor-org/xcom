export interface CompanyRow {
  id: string;
  name: string;
  category: string | null;
  github_org_url: string | null;
  website_url: string | null;
  created_at: string;
}

export interface CompanyInsert {
  name: string;
  category?: string | null;
  github_org_url?: string | null;
  website_url?: string | null;
}

export interface CompanyUpdate {
  name?: string;
  category?: string | null;
  github_org_url?: string | null;
  website_url?: string | null;
}

export interface PersonRow {
  id: string;
  company_id: string;
  name: string;
  role: string | null;
  github_handle: string | null;
  social_url: string | null;
  created_at: string;
}

export interface PersonInsert {
  company_id: string;
  name: string;
  role?: string | null;
  github_handle?: string | null;
  social_url?: string | null;
}

export interface PersonUpdate {
  name?: string;
  role?: string | null;
  github_handle?: string | null;
  social_url?: string | null;
}

export interface RepositoryRow {
  id: string;
  company_id: string;
  name: string;
  url: string;
  primary_language: string | null;
  is_open_source: boolean;
  created_at: string;
}

export interface RepositoryInsert {
  company_id: string;
  name: string;
  url: string;
  primary_language?: string | null;
  is_open_source?: boolean;
}

export interface RepositoryUpsertInput {
  name: string;
  url: string;
  primary_language?: string | null;
  is_open_source?: boolean;
}
