export type SettingsCatalog = {
  candidate_status: string[];
  candidate_source: string[];
  candidate_employee_type: string[];
  group_bu: string[];
  bdm: string[];
  candidate_role: string[];
};

export type SettingsCatalogKey = keyof SettingsCatalog;

export const SETTINGS_STORAGE_KEY = "tara_settings_catalog_v1";
export const SETTINGS_UPDATED_EVENT = "tara-settings-updated";

export const DEFAULT_SETTINGS_CATALOG: SettingsCatalog = {
  candidate_status: ["new", "active", "on_hold"],
  candidate_source: ["manual", "referral", "portal", "linkedin"],
  candidate_employee_type: ["full_time", "contract", "part_time"],
  group_bu: [],
  bdm: [],
  candidate_role: [],
};

function normalizeValues(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function normalizeCatalog(input: Partial<SettingsCatalog> | null | undefined): SettingsCatalog {
  return {
    candidate_status: normalizeValues(input?.candidate_status?.length ? input.candidate_status : DEFAULT_SETTINGS_CATALOG.candidate_status),
    candidate_source: normalizeValues(input?.candidate_source?.length ? input.candidate_source : DEFAULT_SETTINGS_CATALOG.candidate_source),
    candidate_employee_type: normalizeValues(input?.candidate_employee_type?.length ? input.candidate_employee_type : DEFAULT_SETTINGS_CATALOG.candidate_employee_type),
    group_bu: normalizeValues(input?.group_bu),
    bdm: normalizeValues(input?.bdm),
    candidate_role: normalizeValues(input?.candidate_role),
  };
}

export function loadSettingsCatalog(): SettingsCatalog {
  if (typeof window === "undefined") return DEFAULT_SETTINGS_CATALOG;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS_CATALOG;
    const parsed = JSON.parse(raw) as Partial<SettingsCatalog>;
    return normalizeCatalog(parsed);
  } catch {
    return DEFAULT_SETTINGS_CATALOG;
  }
}

export function saveSettingsCatalog(catalog: SettingsCatalog) {
  if (typeof window === "undefined") return;
  const normalized = normalizeCatalog(catalog);
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
}
