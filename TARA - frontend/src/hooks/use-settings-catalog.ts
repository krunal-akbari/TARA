"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_SETTINGS_CATALOG,
  DEFAULT_SETTINGS_DEFAULTS,
  loadSettingsCatalogState,
  normalizeCatalogState,
  saveSettingsCatalogState,
  SETTINGS_UPDATED_EVENT,
  type SettingsCatalog,
  type SettingsCatalogDefaults,
  type SettingsCatalogKey,
} from "@/lib/settings-catalog";

export function useSettingsCatalog() {
  const [catalog, setCatalog] = useState<SettingsCatalog>(DEFAULT_SETTINGS_CATALOG);
  const [defaults, setDefaults] = useState<SettingsCatalogDefaults>(DEFAULT_SETTINGS_DEFAULTS);

  useEffect(() => {
    const next = loadSettingsCatalogState();
    setCatalog(next.catalog);
    setDefaults(next.defaults);
  }, []);

  useEffect(() => {
    const refresh = () => {
      const next = loadSettingsCatalogState();
      setCatalog(next.catalog);
      setDefaults(next.defaults);
    };
    window.addEventListener("storage", refresh);
    window.addEventListener(SETTINGS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refresh);
    };
  }, []);

  const setValues = useCallback((key: SettingsCatalogKey, values: string[]) => {
    setCatalog((prevCatalog) => {
      const normalized = normalizeCatalogState({
        catalog: { ...prevCatalog, [key]: values },
        defaults: { ...defaults },
      });
      saveSettingsCatalogState(normalized);
      setDefaults(normalized.defaults);
      return normalized.catalog;
    });
  }, [defaults]);

  const setDefault = useCallback((key: SettingsCatalogKey, value: string) => {
    setCatalog((prevCatalog) => {
      const normalized = normalizeCatalogState({
        catalog: prevCatalog,
        defaults: { ...defaults, [key]: value },
      });
      saveSettingsCatalogState(normalized);
      setDefaults(normalized.defaults);
      return normalized.catalog;
    });
  }, [defaults]);

  const resetDefaults = useCallback(() => {
    setCatalog(DEFAULT_SETTINGS_CATALOG);
    setDefaults(DEFAULT_SETTINGS_DEFAULTS);
    saveSettingsCatalogState({
      catalog: DEFAULT_SETTINGS_CATALOG,
      defaults: DEFAULT_SETTINGS_DEFAULTS,
    });
  }, []);

  return { catalog, defaults, setValues, setDefault, resetDefaults };
}
