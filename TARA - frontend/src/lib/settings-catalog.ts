export type SettingsCatalog = {
  client_category: string[];
  candidate_status: string[];
  candidate_source: string[];
  candidate_employee_type: string[];
  group_bu: string[];
  bdm: string[];
  candidate_role: string[];
};

export type SettingsCatalogKey = keyof SettingsCatalog;

export type SettingsCatalogDefaults = Record<SettingsCatalogKey, string>;

export interface SettingsCatalogState {
  catalog: SettingsCatalog;
  defaults: SettingsCatalogDefaults;
}

export const SETTINGS_STORAGE_KEY = "tara_settings_catalog_v1";
export const SETTINGS_UPDATED_EVENT = "tara-settings-updated";

export const DEFAULT_SETTINGS_CATALOG: SettingsCatalog = {
  client_category: ["finance", "it", "hospitality", "healthcare", "manufacturing", "retail"],
  candidate_status: ["new", "active", "on_hold"],
  candidate_source: ["manual", "referral", "portal", "linkedin"],
  candidate_employee_type: ["full_time", "contract", "part_time"],
  group_bu: [],
  bdm: [],
  candidate_role: [],
};

export const DEFAULT_SETTINGS_DEFAULTS: SettingsCatalogDefaults = {
  client_category: "finance",
  candidate_status: "new",
  candidate_source: "manual",
  candidate_employee_type: "full_time",
  group_bu: "",
  bdm: "",
  candidate_role: "",
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

function findMatchingValue(values: string[], target: unknown): string | null {
  if (typeof target !== "string") return null;
  const trimmed = target.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  return values.find((value) => value.trim().toLowerCase() === normalized) ?? null;
}

function normalizeDefaultValue(key: SettingsCatalogKey, value: unknown, values: string[]): string {
  const explicitMatch = findMatchingValue(values, value);
  if (explicitMatch) return explicitMatch;

  const builtInMatch = findMatchingValue(values, DEFAULT_SETTINGS_DEFAULTS[key]);
  if (builtInMatch) return builtInMatch;

  return values[0] ?? "";
}

export function normalizeCatalog(input: Partial<SettingsCatalog> | null | undefined): SettingsCatalog {
  return {
    client_category: normalizeValues(
      input?.client_category?.length ? input.client_category : DEFAULT_SETTINGS_CATALOG.client_category,
    ),
    candidate_status: normalizeValues(
      input?.candidate_status?.length ? input.candidate_status : DEFAULT_SETTINGS_CATALOG.candidate_status,
    ),
    candidate_source: normalizeValues(
      input?.candidate_source?.length ? input.candidate_source : DEFAULT_SETTINGS_CATALOG.candidate_source,
    ),
    candidate_employee_type: normalizeValues(
      input?.candidate_employee_type?.length
        ? input.candidate_employee_type
        : DEFAULT_SETTINGS_CATALOG.candidate_employee_type,
    ),
    group_bu: normalizeValues(input?.group_bu),
    bdm: normalizeValues(input?.bdm),
    candidate_role: normalizeValues(input?.candidate_role),
  };
}

function getRawCatalog(input: unknown): Partial<SettingsCatalog> | null | undefined {
  if (!input || typeof input !== "object") return undefined;
  if ("catalog" in input && input.catalog && typeof input.catalog === "object") {
    return input.catalog as Partial<SettingsCatalog>;
  }
  return input as Partial<SettingsCatalog>;
}

function getRawDefaults(input: unknown): Partial<SettingsCatalogDefaults> | null | undefined {
  if (!input || typeof input !== "object") return undefined;
  if ("defaults" in input && input.defaults && typeof input.defaults === "object") {
    return input.defaults as Partial<SettingsCatalogDefaults>;
  }
  return undefined;
}

export function normalizeCatalogState(input: unknown): SettingsCatalogState {
  const catalog = normalizeCatalog(getRawCatalog(input));
  const rawDefaults = getRawDefaults(input);

  return {
    catalog,
    defaults: {
      client_category: normalizeDefaultValue("client_category", rawDefaults?.client_category, catalog.client_category),
      candidate_status: normalizeDefaultValue("candidate_status", rawDefaults?.candidate_status, catalog.candidate_status),
      candidate_source: normalizeDefaultValue("candidate_source", rawDefaults?.candidate_source, catalog.candidate_source),
      candidate_employee_type: normalizeDefaultValue(
        "candidate_employee_type",
        rawDefaults?.candidate_employee_type,
        catalog.candidate_employee_type,
      ),
      group_bu: normalizeDefaultValue("group_bu", rawDefaults?.group_bu, catalog.group_bu),
      bdm: normalizeDefaultValue("bdm", rawDefaults?.bdm, catalog.bdm),
      candidate_role: normalizeDefaultValue("candidate_role", rawDefaults?.candidate_role, catalog.candidate_role),
    },
  };
}

export function loadSettingsCatalogState(): SettingsCatalogState {
  if (typeof window === "undefined") {
    return {
      catalog: DEFAULT_SETTINGS_CATALOG,
      defaults: DEFAULT_SETTINGS_DEFAULTS,
    };
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {
        catalog: DEFAULT_SETTINGS_CATALOG,
        defaults: DEFAULT_SETTINGS_DEFAULTS,
      };
    }

    return normalizeCatalogState(JSON.parse(raw));
  } catch {
    return {
      catalog: DEFAULT_SETTINGS_CATALOG,
      defaults: DEFAULT_SETTINGS_DEFAULTS,
    };
  }
}

export function saveSettingsCatalogState(state: SettingsCatalogState) {
  if (typeof window === "undefined") return;
  const normalized = normalizeCatalogState(state);
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
}
