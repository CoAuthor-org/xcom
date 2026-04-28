import { supabase } from "@/lib/supabase";
import type {
  CompanyInsert,
  CompanyRow,
  RepositoryRow,
  RepositoryUpsertInput,
} from "@/lib/crm/types";

function ensureClient() {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }
  return supabase;
}

export async function listCompanies(): Promise<CompanyRow[]> {
  const client = ensureClient();
  const { data, error } = await client
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompanyRow[];
}

export async function createCompany(input: CompanyInsert): Promise<CompanyRow> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Company name is required");
  }
  const client = ensureClient();
  const { data, error } = await client
    .from("companies")
    .insert({
      name,
      category: input.category?.trim() || null,
      github_org_url: input.github_org_url?.trim() || null,
      website_url: input.website_url?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CompanyRow;
}

export async function listRepositoriesByCompany(
  companyId: string
): Promise<RepositoryRow[]> {
  const client = ensureClient();
  const { data, error } = await client
    .from("repositories")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RepositoryRow[];
}

export async function upsertRepositoriesForCompany(
  companyId: string,
  repositories: RepositoryUpsertInput[]
): Promise<number> {
  const client = ensureClient();
  const rows = repositories
    .map((repository) => ({
      company_id: companyId,
      name: repository.name.trim(),
      url: repository.url.trim(),
      primary_language: repository.primary_language?.trim() || null,
      is_open_source: repository.is_open_source ?? true,
    }))
    .filter((repository) => repository.name && repository.url);

  console.info("[opensource] upsertRepositoriesForCompany:prepared-rows", {
    companyId,
    inputCount: repositories.length,
    preparedCount: rows.length,
  });

  if (rows.length === 0) {
    console.warn("[opensource] upsertRepositoriesForCompany:no-valid-rows", {
      companyId,
    });
    return 0;
  }

  const { error } = await client
    .from("repositories")
    .upsert(rows, { onConflict: "company_id,url" });
  if (error) {
    console.error("[opensource] upsertRepositoriesForCompany:error", {
      companyId,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }
  console.info("[opensource] upsertRepositoriesForCompany:success", {
    companyId,
    upsertedCount: rows.length,
  });
  return rows.length;
}
