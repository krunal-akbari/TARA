"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_SETTINGS_CATALOG,
  loadSettingsCatalog,
  normalizeCatalog,
  saveSettingsCatalog,
  SETTINGS_UPDATED_EVENT,
  type SettingsCatalog,
  type SettingsCatalogKey,
} from "@/lib/settings-catalog";

export function useSettingsCatalog() {
  const [catalog, setCatalog] = useState<SettingsCatalog>(DEFAULT_SETTINGS_CATALOG);

  useEffect(() => {
    setCatalog(loadSettingsCatalog());
  }, []);

  useEffect(() => {
    const refresh = () => setCatalog(loadSettingsCatalog());
    window.addEventListener("storage", refresh);
    window.addEventListener(SETTINGS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refresh);
    };
  }, []);

  const setValues = useCallback((key: SettingsCatalogKey, values: string[]) => {
    setCatalog((prev) => {
      const next = normalizeCatalog({ ...prev, [key]: values });
      saveSettingsCatalog(next);
      return next;
    });
  }, []);

  const resetDefaults = useCallback(() => {
    setCatalog(DEFAULT_SETTINGS_CATALOG);
    saveSettingsCatalog(DEFAULT_SETTINGS_CATALOG);
  }, []);

  return { catalog, setValues, resetDefaults };
}
