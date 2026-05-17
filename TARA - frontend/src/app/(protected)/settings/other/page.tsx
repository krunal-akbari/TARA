"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, Pencil, Plus, Settings, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSettingsCatalog } from "@/hooks/use-settings-catalog";
import { type SettingsCatalogKey } from "@/lib/settings-catalog";

type SectionConfig = {
  key: SettingsCatalogKey;
  title: string;
  description: string;
};

const SETTINGS_SECTIONS: SectionConfig[] = [
  {
    key: "client_category",
    title: "Client Category",
    description: "Default category values for clients (example: Finance, IT, Hospitality).",
  },
  {
    key: "candidate_status",
    title: "Candidate Status",
    description: "Used in candidate forms (example: New, Active, On Hold).",
  },
  {
    key: "candidate_source",
    title: "Candidate Source",
    description: "Default source values for candidate creation.",
  },
  {
    key: "candidate_employee_type",
    title: "Employee Type",
    description: "Default employee type values for candidates.",
  },
  {
    key: "group_bu",
    title: "Group (BU)",
    description: "Business unit values for candidates.",
  },
  {
    key: "bdm",
    title: "BDM",
    description: "Business development manager values.",
  },
  {
    key: "candidate_role",
    title: "Candidate Role",
    description: "Common role values used in candidate forms.",
  },
];

function toTitle(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function SettingsOtherPage() {
  const { catalog, defaults, setValues, setDefault, resetDefaults } = useSettingsCatalog();
  const [drafts, setDrafts] = useState<Record<SettingsCatalogKey, string>>({
    client_category: "",
    candidate_status: "",
    candidate_source: "",
    candidate_employee_type: "",
    group_bu: "",
    bdm: "",
    candidate_role: "",
  });
  const [editing, setEditing] = useState<Record<SettingsCatalogKey, { original: string; value: string } | null>>({
    client_category: null,
    candidate_status: null,
    candidate_source: null,
    candidate_employee_type: null,
    group_bu: null,
    bdm: null,
    candidate_role: null,
  });

  const totalItems = useMemo(
    () => SETTINGS_SECTIONS.reduce((sum, section) => sum + catalog[section.key].length, 0),
    [catalog],
  );

  const onAdd = (event: FormEvent, key: SettingsCatalogKey) => {
    event.preventDefault();
    const value = drafts[key].trim();
    if (!value) return;
    setValues(key, [...catalog[key], value]);
    setDrafts((prev) => ({ ...prev, [key]: "" }));
  };

  const onDelete = (key: SettingsCatalogKey, value: string) => {
    setValues(key, catalog[key].filter((item) => item !== value));
  };

  const onStartEdit = (key: SettingsCatalogKey, value: string) => {
    setEditing((prev) => ({ ...prev, [key]: { original: value, value } }));
  };

  const onCancelEdit = (key: SettingsCatalogKey) => {
    setEditing((prev) => ({ ...prev, [key]: null }));
  };

  const onSaveEdit = (key: SettingsCatalogKey) => {
    const state = editing[key];
    if (!state) return;
    const nextValue = state.value.trim();
    if (!nextValue) return;
    const shouldKeepDefault = defaults[key] === state.original;
    setValues(
      key,
      catalog[key].map((item) => (item === state.original ? nextValue : item)),
    );
    if (shouldKeepDefault) {
      setDefault(key, nextValue);
    }
    setEditing((prev) => ({ ...prev, [key]: null }));
  };

  return (
    <Card className="space-y-4 rounded-lg border-slate-300 bg-white px-5 py-4 shadow-none">
      <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-3">
        <Settings className="size-5 text-slate-800" />
        <h1 className="text-2xl font-semibold text-slate-900">Settings Other</h1>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-700">
          Manage default dropdown values in one place. Total configured values: {totalItems}
        </p>
        <Button type="button" variant="ghost" onClick={resetDefaults}>
          Reset To Default
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => (
          <section key={section.key} className="rounded border border-slate-200 bg-white p-3">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
              <p className="text-xs text-slate-600">{section.description}</p>
            </div>

            <form onSubmit={(event) => onAdd(event, section.key)} className="mb-3 flex gap-2">
              <Input
                value={drafts[section.key]}
                onChange={(event) => setDrafts((prev) => ({ ...prev, [section.key]: event.target.value }))}
                placeholder={`Add ${section.title} value`}
              />
              <Button type="submit" className="inline-flex items-center gap-1">
                <Plus className="size-4" />
                Add
              </Button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-700">
                    <th className="px-2 py-2 font-medium">Value</th>
                    <th className="w-24 px-2 py-2 font-medium">Preview</th>
                    <th className="w-28 px-2 py-2 font-medium">Default</th>
                    <th className="w-28 px-2 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog[section.key].length === 0 ? (
                    <tr>
                      <td className="px-2 py-3 text-slate-500" colSpan={4}>
                        No values configured.
                      </td>
                    </tr>
                  ) : (
                    catalog[section.key].map((value) => (
                      <tr key={value} className="border-b border-slate-100">
                        <td className="px-2 py-2 text-slate-900">
                          {editing[section.key]?.original === value ? (
                            <Input
                              value={editing[section.key]?.value ?? ""}
                              onChange={(event) =>
                                setEditing((prev) => ({
                                  ...prev,
                                  [section.key]: {
                                    original: value,
                                    value: event.target.value,
                                  },
                                }))
                              }
                              className="h-8"
                            />
                          ) : (
                            toTitle(value)
                          )}
                        </td>
                        <td className="px-2 py-2 text-slate-600">
                          {editing[section.key]?.original === value
                            ? toTitle(editing[section.key]?.value ?? "")
                            : toTitle(value)}
                        </td>
                        <td className="px-2 py-2">
                          {defaults[section.key] === value ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              Default
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 px-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              onClick={() => setDefault(section.key, value)}
                            >
                              Set Default
                            </Button>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            {editing[section.key]?.original === value ? (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-8 px-2 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                  onClick={() => onSaveEdit(section.key)}
                                >
                                  <Check className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-8 px-2 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                                  onClick={() => onCancelEdit(section.key)}
                                >
                                  <X className="size-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-8 px-2 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                                onClick={() => onStartEdit(section.key, value)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => onDelete(section.key, value)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}
