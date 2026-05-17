"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Binoculars, BriefcaseBusiness } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { ListPageShell } from "@/components/common/list-page-shell";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useListPage } from "@/hooks/use-list-page";
import { useSettingsCatalog } from "@/hooks/use-settings-catalog";
import { useUserNameMap } from "@/hooks/use-user-name-map";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/query-keys";
import { listClients } from "@/lib/services/clients";
import { createJob, listJobs, restoreJob } from "@/lib/services/jobs";
import type { Job } from "@/lib/types/entities";
import { listVendors } from "@/lib/services/vendors";
import { cn } from "@/lib/utils/cn";
import { JOB_INTAKE_CHANNELS } from "@/lib/types/forms";
import { toTitleCase } from "@/lib/utils/format";
import { LINE_INPUT_CLASS, getRowClassName } from "@/lib/utils/table-styles";

type JobTableColumn = {
  key: string;
  header: React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  defaultWidth: number;
  minWidth: number;
  toggleableKey?: ToggleableJobColumnKey;
  render: (_job: Job) => React.ReactNode;
};

type ToggleableJobColumnKey =
  | "id"
  | "title"
  | "description"
  | "status"
  | "priority"
  | "channel"
  | "originClient"
  | "originVendor"
  | "owner"
  | "applications"
  | "deletedAt"
  | "actions";

const JOB_COLUMN_OPTIONS: Array<{ key: ToggleableJobColumnKey; label: string }> = [
  { key: "id", label: "ID" },
  { key: "title", label: "Job Title" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "channel", label: "Channel" },
  { key: "originClient", label: "Origin Client" },
  { key: "originVendor", label: "Origin Business Partner" },
  { key: "owner", label: "BDA" },
  { key: "applications", label: "Applicants" },
  { key: "deletedAt", label: "Deleted At" },
  { key: "actions", label: "Actions" },
];

const DEFAULT_VISIBLE_JOB_COLUMNS: ToggleableJobColumnKey[] =
  JOB_COLUMN_OPTIONS.map((option) => option.key);

const JOB_COLUMN_DIMENSIONS: Record<string, { defaultWidth: number; minWidth: number }> = {
  selection: { defaultWidth: 56, minWidth: 56 },
  id: { defaultWidth: 72, minWidth: 60 },
  title: { defaultWidth: 240, minWidth: 160 },
  description: { defaultWidth: 300, minWidth: 180 },
  status: { defaultWidth: 140, minWidth: 110 },
  priority: { defaultWidth: 120, minWidth: 100 },
  channel: { defaultWidth: 180, minWidth: 120 },
  originClient: { defaultWidth: 130, minWidth: 110 },
  originVendor: { defaultWidth: 130, minWidth: 110 },
  owner: { defaultWidth: 100, minWidth: 80 },
  applications: { defaultWidth: 120, minWidth: 100 },
  deletedAt: { defaultWidth: 170, minWidth: 120 },
  actions: { defaultWidth: 150, minWidth: 120 },
};

export default function JobsPage() {
  const queryClient = useQueryClient();
  const list = useListPage();
  const session = useAuthStore((s) => s.session);
  const { catalog, defaults } = useSettingsCatalog();
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{ key: string; startX: number; startWidth: number; minWidth: number } | null>(null);
  const ownerName = useMemo(() => {
    const full = `${session?.user?.first_name ?? ""} ${session?.user?.last_name ?? ""}`.trim();
    if (full) return full;
    const prefix = session?.user?.email?.split("@")[0] ?? "Current User";
    return toTitleCase(prefix);
  }, [session]);

  const groupBuOptions = useMemo(() => catalog.group_bu, [catalog.group_bu]);
  const defaultGroupBu = defaults.group_bu || groupBuOptions[0] || "";

  const [form, setForm] = useState({
    title: "",
    status: "draft",
    groupBu: defaultGroupBu,
    jobType: "direct_client",
    openClosed: "open",
    priority: "hot",
    originClientName: "",
    originVendorName: "",
    startDate: "",
    assignedTo: "",
    salaryLow: "",
    salaryHigh: "",
    permFee: "",
    benefits: "",
    expectedValue: "",
    bonusPackage: "",
    category: "",
    requiredSkills: "",
    additionalSkills: "",
    industry: "",
    minExperience: "",
    degreeRequirements: "",
    certificationRequirements: "",
    description: "",
    publishedDescription: "",
    locationAddress: "",
    locationCity: "",
    locationState: "",
    locationZip: "",
    locationCountry: "United States",
    internalUser: "",
    distributionList: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [columnSearch, setColumnSearch] = useState("");
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<ToggleableJobColumnKey[]>(
    DEFAULT_VISIBLE_JOB_COLUMNS,
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      Object.entries(JOB_COLUMN_DIMENSIONS).map(([key, value]) => [key, value.defaultWidth]),
    ),
  );
  const [activeResizeKey, setActiveResizeKey] = useState<string | null>(null);
  const isDirectClientType = form.jobType === "direct_client";

  useEffect(() => {
    if (!defaultGroupBu) return;
    setForm((prev) => (prev.groupBu ? prev : { ...prev, groupBu: defaultGroupBu }));
  }, [defaultGroupBu]);

  const resetCreateForm = () => {
    setForm({
      title: "",
      status: "draft",
      groupBu: defaultGroupBu,
      jobType: "direct_client",
      openClosed: "open",
      priority: "hot",
      originClientName: "",
      originVendorName: "",
      startDate: "",
      assignedTo: "",
      salaryLow: "",
      salaryHigh: "",
      permFee: "",
      benefits: "",
      expectedValue: "",
      bonusPackage: "",
      category: "",
      requiredSkills: "",
      additionalSkills: "",
      industry: "",
      minExperience: "",
      degreeRequirements: "",
      certificationRequirements: "",
      description: "",
      publishedDescription: "",
      locationAddress: "",
      locationCity: "",
      locationState: "",
      locationZip: "",
      locationCountry: "United States",
      internalUser: "",
      distributionList: "",
    });
    setSelectedClientId(null);
    setSelectedVendorId(null);
    setShowClientSuggestions(false);
    setShowVendorSuggestions(false);
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.jobs.list(list.page, list.includeDeleted),
    queryFn: () => listJobs({ page: list.page, pageSize: list.pageSize, includeDeleted: list.includeDeleted }),
  });

  const normalizedClientSearch = form.originClientName.trim();
  const normalizedVendorSearch = form.originVendorName.trim();

  const { data: clientOptions } = useQuery({
    queryKey: [...queryKeys.clients.all, "job-create-search", normalizedClientSearch, isDirectClientType],
    queryFn: () =>
      listClients({
        page: 1,
        pageSize: 100,
        includeDeleted: false,
        search: normalizedClientSearch || undefined,
      }),
    enabled: list.showCreate && isDirectClientType,
  });

  const { data: vendorOptions } = useQuery({
    queryKey: [...queryKeys.vendors.all, "job-create-search", normalizedVendorSearch, isDirectClientType],
    queryFn: () =>
      listVendors({
        page: 1,
        pageSize: 100,
        includeDeleted: false,
        search: normalizedVendorSearch || undefined,
      }),
    enabled: list.showCreate && !isDirectClientType,
  });

  const clientNameOptions = useMemo(() => {
    const uniqueByName = new Map<string, { id: number; name: string }>();
    for (const client of clientOptions?.items ?? []) {
      const normalizedName = client.name.trim().toLowerCase();
      if (!normalizedName || uniqueByName.has(normalizedName)) continue;
      uniqueByName.set(normalizedName, { id: client.id, name: client.name });
    }
    return Array.from(uniqueByName.values());
  }, [clientOptions?.items]);

  const vendorNameOptions = useMemo(() => {
    const uniqueByName = new Map<string, { id: number; name: string }>();
    for (const vendor of vendorOptions?.items ?? []) {
      const normalizedName = vendor.name.trim().toLowerCase();
      if (!normalizedName || uniqueByName.has(normalizedName)) continue;
      uniqueByName.set(normalizedName, { id: vendor.id, name: vendor.name });
    }
    return Array.from(uniqueByName.values());
  }, [vendorOptions?.items]);

  const jobItems = useMemo(() => {
    const items = data?.items ?? [];
    const search = list.normalizedSearch.toLowerCase();
    if (!search) return items;
    return items.filter((item) => {
      const haystack = `${item.id} ${item.title} ${item.status} ${item.intake_channel}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [data?.items, list.normalizedSearch]);
  const jobOwnerIds = useMemo(() => jobItems.map((job) => job.owner_user_id), [jobItems]);
  const { getUserFirstName } = useUserNameMap(jobOwnerIds);

  const pagination = list.getPagination(data?.total ?? 0);
  const selection = list.getSelectionHelpers(jobItems);
  const visibleColumnKeySet = useMemo(() => new Set(visibleColumnKeys), [visibleColumnKeys]);

  useEffect(() => {
    if (!showColumnMenu) return;

    const onMouseDown = (event: MouseEvent) => {
      if (!columnMenuRef.current?.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [showColumnMenu]);

  useEffect(() => {
    if (!activeResizeKey) return;

    const onMouseMove = (event: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;

      const nextWidth = Math.max(state.minWidth, state.startWidth + event.clientX - state.startX);
      setColumnWidths((prev) => (
        prev[state.key] === nextWidth
          ? prev
          : { ...prev, [state.key]: nextWidth }
      ));
    };

    const onMouseUp = () => {
      resizeStateRef.current = null;
      setActiveResizeKey(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [activeResizeKey]);

  const renderCompactText = (value: string | null | undefined, emptyValue = "-") =>
    value ? (
      <span className="block w-full truncate" title={value}>
        {value}
      </span>
    ) : (
      emptyValue
    );
  const filteredColumnOptions = useMemo(() => {
    const search = columnSearch.trim().toLowerCase();
    if (!search) return JOB_COLUMN_OPTIONS;

    return JOB_COLUMN_OPTIONS.filter((option) =>
      option.label.toLowerCase().includes(search),
    );
  }, [columnSearch]);
  const toggleColumn = (key: ToggleableJobColumnKey) => {
    setVisibleColumnKeys((prev) => {
      const next = prev.includes(key)
        ? prev.filter((columnKey) => columnKey !== key)
        : [...prev, key];

      return JOB_COLUMN_OPTIONS
        .map((option) => option.key)
        .filter((columnKey) => next.includes(columnKey));
    });
  };
  const selectAllColumns = () => {
    setVisibleColumnKeys(JOB_COLUMN_OPTIONS.map((option) => option.key));
  };
  const clearAllColumns = () => {
    setVisibleColumnKeys([]);
  };
  const getColumnWidth = (column: JobTableColumn) =>
    columnWidths[column.key] ?? column.defaultWidth;
  const startColumnResize = (event: React.MouseEvent<HTMLDivElement>, column: JobTableColumn) => {
    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      key: column.key,
      startX: event.clientX,
      startWidth: getColumnWidth(column),
      minWidth: column.minWidth,
    };
    setActiveResizeKey(column.key);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const jobTableColumns: JobTableColumn[] = [
    {
      key: "selection",
      header: (
        <input
          type="checkbox"
          checked={selection.allSelected}
          onChange={selection.toggleSelectAll}
          aria-label="Select all jobs"
        />
      ),
      headerClassName: "px-3 py-2",
      cellClassName: "px-3 py-2",
      defaultWidth: JOB_COLUMN_DIMENSIONS.selection.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.selection.minWidth,
      render: (job) => (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={list.selectedIds.has(job.id)}
            onChange={() => selection.toggleSelectOne(job.id)}
            aria-label={`Select job ${job.title}`}
          />
          <Link
            href={`/jobs/${job.id}`}
            className="text-slate-500 hover:text-blue-700"
            aria-label={`View details for job ${job.title}`}
          >
            <Binoculars className="size-4" />
          </Link>
        </div>
      ),
    },
    {
      key: "id",
      toggleableKey: "id",
      header: "ID",
      headerClassName: "px-3 py-2 font-medium text-slate-900",
      cellClassName: "px-3 py-2 tabular-nums text-slate-800",
      defaultWidth: JOB_COLUMN_DIMENSIONS.id.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.id.minWidth,
      render: (job) => job.id,
    },
    {
      key: "title",
      toggleableKey: "title",
      header: "Job Title",
      headerClassName: "px-3 py-2 font-medium text-slate-900",
      cellClassName: "px-3 py-2",
      defaultWidth: JOB_COLUMN_DIMENSIONS.title.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.title.minWidth,
      render: (job) => (
        <Link href={`/jobs/${job.id}`} className="font-medium text-blue-700 hover:underline">
          {job.title}
        </Link>
      ),
    },
    {
      key: "description",
      toggleableKey: "description",
      header: "Description",
      headerClassName: "px-3 py-2 font-medium text-slate-900",
      cellClassName: "px-3 py-2 text-slate-800",
      defaultWidth: JOB_COLUMN_DIMENSIONS.description.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.description.minWidth,
      render: (job) => renderCompactText(job.description),
    },
    {
      key: "status",
      toggleableKey: "status",
      header: "Status",
      headerClassName: "px-3 py-2 font-medium text-slate-900",
      cellClassName: "px-3 py-2",
      defaultWidth: JOB_COLUMN_DIMENSIONS.status.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.status.minWidth,
      render: (job) => <StatusChip value={job.status} />,
    },
    {
      key: "priority",
      toggleableKey: "priority",
      header: "Priority",
      headerClassName: "px-3 py-2 font-medium text-slate-900",
      cellClassName: "px-3 py-2 text-slate-800",
      defaultWidth: JOB_COLUMN_DIMENSIONS.priority.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.priority.minWidth,
      render: (job) => toTitleCase(job.priority.replace(/_/g, " ")),
    },
    {
      key: "channel",
      toggleableKey: "channel",
      header: "Channel",
      headerClassName: "px-3 py-2 font-medium text-slate-900",
      cellClassName: "px-3 py-2 text-slate-800",
      defaultWidth: JOB_COLUMN_DIMENSIONS.channel.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.channel.minWidth,
      render: (job) => toTitleCase(job.intake_channel.replace(/_/g, " ")),
    },
    {
      key: "originClient",
      toggleableKey: "originClient",
      header: "Origin Client",
      headerClassName: "px-3 py-2 font-medium text-slate-900",
      cellClassName: "px-3 py-2 tabular-nums text-slate-800",
      defaultWidth: JOB_COLUMN_DIMENSIONS.originClient.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.originClient.minWidth,
      render: (job) => job.origin_client_id ?? "-",
    },
    {
      key: "originVendor",
      toggleableKey: "originVendor",
      header: "Origin Business Partner",
      headerClassName: "px-3 py-2 font-medium text-slate-900",
      cellClassName: "px-3 py-2 tabular-nums text-slate-800",
      defaultWidth: JOB_COLUMN_DIMENSIONS.originVendor.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.originVendor.minWidth,
      render: (job) => job.origin_vendor_id ?? "-",
    },
    {
      key: "owner",
      toggleableKey: "owner",
      header: "BDA",
      headerClassName: "px-3 py-2 font-medium text-slate-900",
      cellClassName: "px-3 py-2 text-slate-800",
      defaultWidth: JOB_COLUMN_DIMENSIONS.owner.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.owner.minWidth,
      render: (job) => getUserFirstName(job.owner_user_id),
    },
    {
      key: "applications",
      toggleableKey: "applications",
      header: "Applicants",
      headerClassName: "px-3 py-2 font-medium text-slate-900",
      cellClassName: "px-3 py-2",
      defaultWidth: JOB_COLUMN_DIMENSIONS.applications.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.applications.minWidth,
      render: (job) => (
        <Link href={`/jobs/${job.id}#applied-candidates`} className="tabular-nums text-blue-700 hover:underline">
          {job.applications_count}
        </Link>
      ),
    },
    {
      key: "deletedAt",
      toggleableKey: "deletedAt",
      header: "Deleted At",
      headerClassName: "px-3 py-2 font-medium text-slate-900",
      cellClassName: "px-3 py-2 text-slate-800",
      defaultWidth: JOB_COLUMN_DIMENSIONS.deletedAt.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.deletedAt.minWidth,
      render: (job) => renderCompactText(job.deleted_at),
    },
    {
      key: "actions",
      toggleableKey: "actions",
      header: "Actions",
      headerClassName: "px-3 py-2 font-medium text-slate-900",
      cellClassName: "px-3 py-2",
      defaultWidth: JOB_COLUMN_DIMENSIONS.actions.defaultWidth,
      minWidth: JOB_COLUMN_DIMENSIONS.actions.minWidth,
      render: (job) => (
        <div className="flex gap-2 whitespace-nowrap">
          {job.deleted_at ? (
            <Button variant="secondary" onClick={() => restoreMutation.mutate(job.id)}>Restore</Button>
          ) : null}
        </div>
      ),
    },
  ];
  const visibleJobTableColumns = jobTableColumns.filter(
    (column) => !column.toggleableKey || visibleColumnKeySet.has(column.toggleableKey),
  );
  const visibleTableMinWidth = visibleJobTableColumns.reduce(
    (total, column) => total + getColumnWidth(column),
    0,
  );

  const createMutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      resetCreateForm();
      list.setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to create job")),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreJob,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
    onError: (err) => setError(getApiErrorMessage(err, "Failed to restore job")),
  });

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("Job Title is required");

    try {
      let matchedClientId: number | null = selectedClientId;
      let matchedVendorId: number | null = selectedVendorId;

      const normalizedClientName = form.originClientName.trim();
      const normalizedVendorName = form.originVendorName.trim();

      if (isDirectClientType) {
        matchedVendorId = null;
      } else {
        matchedClientId = null;
      }

      if ((!matchedClientId && normalizedClientName && isDirectClientType) || (!matchedVendorId && normalizedVendorName && !isDirectClientType)) {
        const [clientResult, vendorResult] = await Promise.all([
          normalizedClientName && isDirectClientType
            ? listClients({
                page: 1,
                pageSize: 100,
                includeDeleted: false,
                search: normalizedClientName,
              })
            : Promise.resolve(null),
          normalizedVendorName && !isDirectClientType
            ? listVendors({
                page: 1,
                pageSize: 100,
                includeDeleted: false,
                search: normalizedVendorName,
              })
            : Promise.resolve(null),
        ]);

        if (clientResult && !matchedClientId) {
          const exactClient = clientResult.items.find(
            (item) => item.name.trim().toLowerCase() === normalizedClientName.toLowerCase(),
          );
          matchedClientId = exactClient?.id ?? null;
        }

        if (vendorResult && !matchedVendorId) {
          const exactVendor = vendorResult.items.find(
            (item) => item.name.trim().toLowerCase() === normalizedVendorName.toLowerCase(),
          );
          matchedVendorId = exactVendor?.id ?? null;
        }
      }

      await createMutation.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status.trim(),
        intake_channel: form.jobType,
        group_bu: form.groupBu.trim() || undefined,
        origin_client_id: matchedClientId,
        origin_vendor_id: matchedVendorId,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create job"));
    }
  };

  const createFormContent = (
    <div className="rounded border border-slate-200 bg-white p-4">
      <form className="space-y-4" onSubmit={onCreate}>
        <div className="flex items-center gap-2 border-b border-rose-300 pb-2 text-lg font-semibold"><BriefcaseBusiness className="size-5 text-rose-600" />Add Job</div>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Job Information</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
            <div><Label htmlFor="job-title">Job Title *</Label><Input id="job-title" className={LINE_INPUT_CLASS} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div>
              <Label htmlFor="job-status">Status *</Label>
              <Select id="job-status" className={LINE_INPUT_CLASS} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="closed">Closed</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="job-group-bu">Group (BU)</Label>
              <Select id="job-group-bu" className={LINE_INPUT_CLASS} value={form.groupBu} onChange={(e) => setForm((p) => ({ ...p, groupBu: e.target.value }))}>
                <option value="">{groupBuOptions.length > 0 ? "Select Group (BU)" : "No Group (BU) configured"}</option>
                {groupBuOptions.map((option) => (
                  <option key={option} value={option}>{toTitleCase(option.replace(/_/g, " "))}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="job-type">Job Type *</Label>
              <Select
                id="job-type"
                className={LINE_INPUT_CLASS}
                value={form.jobType}
                onChange={(e) => {
                  setSelectedClientId(null);
                  setSelectedVendorId(null);
                  setShowClientSuggestions(false);
                  setShowVendorSuggestions(false);
                  setForm((p) => {
                    const nextJobType = e.target.value;
                    if (nextJobType === "direct_client") {
                      return { ...p, jobType: nextJobType, originVendorName: "" };
                    }
                    return { ...p, jobType: nextJobType, originClientName: "" };
                  });
                }}
              >
                {JOB_INTAKE_CHANNELS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Open/Closed</Label>
              <div className="flex h-9 items-center gap-2">
                <button type="button" className={`rounded border px-3 py-1 text-sm ${form.openClosed === "open" ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-white"}`} onClick={() => setForm((p) => ({ ...p, openClosed: "open" }))}>Open</button>
                <button type="button" className={`rounded border px-3 py-1 text-sm ${form.openClosed === "closed" ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-white"}`} onClick={() => setForm((p) => ({ ...p, openClosed: "closed" }))}>Closed</button>
              </div>
            </div>
            <div>
              <Label htmlFor="job-priority">Priority</Label>
              <Select id="job-priority" className={LINE_INPUT_CLASS} value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </Select>
            </div>
            <div className="relative">
              <Label htmlFor="job-client-company">Client Company</Label>
              <Input
                id="job-client-company"
                className={`${LINE_INPUT_CLASS} ${!isDirectClientType ? "cursor-not-allowed opacity-50" : ""}`}
                value={form.originClientName}
                disabled={!isDirectClientType}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showClientSuggestions}
                aria-controls="job-client-suggestions"
                onFocus={() => {
                  if (!isDirectClientType) return;
                  setShowClientSuggestions(true);
                }}
                onBlur={() => {
                  window.setTimeout(() => setShowClientSuggestions(false), 120);
                }}
                onChange={(e) => {
                  setForm((p) => ({ ...p, originClientName: e.target.value }));
                  setSelectedClientId(null);
                  if (isDirectClientType) setShowClientSuggestions(true);
                }}
                placeholder={isDirectClientType ? "Search client company by name" : "Disabled for selected job type"}
                autoComplete="off"
              />
              {isDirectClientType && showClientSuggestions ? (
                <div id="job-client-suggestions" role="listbox" className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded border border-slate-300 bg-white shadow-lg">
                  {clientNameOptions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-600">No clients found.</p>
                  ) : clientNameOptions.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      role="option"
                      aria-selected={selectedClientId === client.id}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setForm((p) => ({ ...p, originClientName: client.name }));
                        setSelectedClientId(client.id);
                        setShowClientSuggestions(false);
                      }}
                    >
                      {client.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="relative">
              <Label htmlFor="job-vendor">Business Partners</Label>
              <Input
                id="job-vendor"
                className={`${LINE_INPUT_CLASS} ${isDirectClientType ? "cursor-not-allowed opacity-50" : ""}`}
                value={form.originVendorName}
                disabled={isDirectClientType}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showVendorSuggestions}
                aria-controls="job-vendor-suggestions"
                onFocus={() => {
                  if (isDirectClientType) return;
                  setShowVendorSuggestions(true);
                }}
                onBlur={() => {
                  window.setTimeout(() => setShowVendorSuggestions(false), 120);
                }}
                onChange={(e) => {
                  setForm((p) => ({ ...p, originVendorName: e.target.value }));
                  setSelectedVendorId(null);
                  if (!isDirectClientType) setShowVendorSuggestions(true);
                }}
                placeholder={!isDirectClientType ? "Search business partner by name" : "Disabled for selected job type"}
                autoComplete="off"
              />
              {!isDirectClientType && showVendorSuggestions ? (
                <div id="job-vendor-suggestions" role="listbox" className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded border border-slate-300 bg-white shadow-lg">
                  {vendorNameOptions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-600">No business partners found.</p>
                  ) : vendorNameOptions.map((vendor) => (
                    <button
                      key={vendor.id}
                      type="button"
                      role="option"
                      aria-selected={selectedVendorId === vendor.id}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setForm((p) => ({ ...p, originVendorName: vendor.name }));
                        setSelectedVendorId(vendor.id);
                        setShowVendorSuggestions(false);
                      }}
                    >
                      {vendor.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div><Label htmlFor="job-start-date">Start Date</Label><Input id="job-start-date" className={LINE_INPUT_CLASS} type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} /></div>
            <div><Label htmlFor="job-owner">BDA</Label><Input id="job-owner" className={LINE_INPUT_CLASS} value={ownerName} readOnly /></div>
            <div className="sm:col-span-2"><Label htmlFor="job-assigned-to">Assigned To</Label><Input id="job-assigned-to" className={LINE_INPUT_CLASS} value={form.assignedTo} onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Compensation Information</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
            <div><Label htmlFor="job-salary-low">Salary Low</Label><Input id="job-salary-low" className={LINE_INPUT_CLASS} value={form.salaryLow} onChange={(e) => setForm((p) => ({ ...p, salaryLow: e.target.value }))} /></div>
            <div><Label htmlFor="job-salary-high">Salary High</Label><Input id="job-salary-high" className={LINE_INPUT_CLASS} value={form.salaryHigh} onChange={(e) => setForm((p) => ({ ...p, salaryHigh: e.target.value }))} /></div>
            <div><Label htmlFor="job-perm-fee">Perm Fee (%)</Label><Input id="job-perm-fee" className={LINE_INPUT_CLASS} value={form.permFee} onChange={(e) => setForm((p) => ({ ...p, permFee: e.target.value }))} /></div>
            <div><Label htmlFor="job-benefits">Benefits</Label><Input id="job-benefits" className={LINE_INPUT_CLASS} value={form.benefits} onChange={(e) => setForm((p) => ({ ...p, benefits: e.target.value }))} /></div>
            <div><Label htmlFor="job-expected-value">Expected Value</Label><Input id="job-expected-value" className={LINE_INPUT_CLASS} value={form.expectedValue} onChange={(e) => setForm((p) => ({ ...p, expectedValue: e.target.value }))} /></div>
            <div><Label htmlFor="job-bonus-package">Bonus Package</Label><Input id="job-bonus-package" className={LINE_INPUT_CLASS} value={form.bonusPackage} onChange={(e) => setForm((p) => ({ ...p, bonusPackage: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Skills / Experience</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
            <div><Label htmlFor="job-category">Category</Label><Input id="job-category" className={LINE_INPUT_CLASS} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} /></div>
            <div><Label htmlFor="job-required-skills">Required Skills</Label><Input id="job-required-skills" className={LINE_INPUT_CLASS} value={form.requiredSkills} onChange={(e) => setForm((p) => ({ ...p, requiredSkills: e.target.value }))} /></div>
            <div className="sm:col-span-2"><Label htmlFor="job-additional-skills">Additional Skills / Keywords</Label><Textarea id="job-additional-skills" className="min-h-20 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:ring-0" value={form.additionalSkills} onChange={(e) => setForm((p) => ({ ...p, additionalSkills: e.target.value }))} /></div>
            <div><Label htmlFor="job-industry">Industry</Label><Input id="job-industry" className={LINE_INPUT_CLASS} value={form.industry} onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))} /></div>
            <div><Label htmlFor="job-min-experience">Minimum Experience (Years)</Label><Input id="job-min-experience" className={LINE_INPUT_CLASS} value={form.minExperience} onChange={(e) => setForm((p) => ({ ...p, minExperience: e.target.value }))} /></div>
            <div><Label htmlFor="job-degree-requirements">Degree Requirements</Label><Input id="job-degree-requirements" className={LINE_INPUT_CLASS} value={form.degreeRequirements} onChange={(e) => setForm((p) => ({ ...p, degreeRequirements: e.target.value }))} /></div>
            <div><Label htmlFor="job-certification-requirements">Certification Requirements</Label><Input id="job-certification-requirements" className={LINE_INPUT_CLASS} value={form.certificationRequirements} onChange={(e) => setForm((p) => ({ ...p, certificationRequirements: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Job Description</div>
          <div className="grid gap-3 px-3 py-3">
            <div><Label htmlFor="job-description">Job Description</Label><Textarea id="job-description" className="min-h-28 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:ring-0" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div><Label htmlFor="job-published-description">Published Description</Label><Textarea id="job-published-description" className="min-h-28 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:ring-0" value={form.publishedDescription} onChange={(e) => setForm((p) => ({ ...p, publishedDescription: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Job Location</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-4">
            <div className="sm:col-span-4"><Label htmlFor="job-location-address">Address</Label><Input id="job-location-address" className={LINE_INPUT_CLASS} value={form.locationAddress} onChange={(e) => setForm((p) => ({ ...p, locationAddress: e.target.value }))} /></div>
            <div><Label htmlFor="job-location-city">City</Label><Input id="job-location-city" className={LINE_INPUT_CLASS} value={form.locationCity} onChange={(e) => setForm((p) => ({ ...p, locationCity: e.target.value }))} /></div>
            <div><Label htmlFor="job-location-state">State / Province</Label><Input id="job-location-state" className={LINE_INPUT_CLASS} value={form.locationState} onChange={(e) => setForm((p) => ({ ...p, locationState: e.target.value }))} /></div>
            <div><Label htmlFor="job-location-zip">Zip/Postal Code</Label><Input id="job-location-zip" className={LINE_INPUT_CLASS} value={form.locationZip} onChange={(e) => setForm((p) => ({ ...p, locationZip: e.target.value }))} /></div>
            <div><Label htmlFor="job-location-country">Country</Label><Input id="job-location-country" className={LINE_INPUT_CLASS} value={form.locationCountry} onChange={(e) => setForm((p) => ({ ...p, locationCountry: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Email Notification</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
            <div><Label htmlFor="job-internal-user">Internal User</Label><Input id="job-internal-user" className={LINE_INPUT_CLASS} value={form.internalUser} onChange={(e) => setForm((p) => ({ ...p, internalUser: e.target.value }))} /></div>
            <div><Label htmlFor="job-distribution-list">Distribution List</Label><Input id="job-distribution-list" className={LINE_INPUT_CLASS} value={form.distributionList} onChange={(e) => setForm((p) => ({ ...p, distributionList: e.target.value }))} /></div>
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" onClick={() => list.setShowCreate(false)}>Cancel</Button><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : "Save"}</Button></div>
      </form>
    </div>
  );

  return (
    <ListPageShell
      icon={<BriefcaseBusiness className="size-5 text-sky-600" />}
      title="Jobs"
      search={list.search}
      onSearchChange={list.setSearch}
      includeDeleted={list.includeDeleted}
      onIncludeDeletedChange={list.setIncludeDeleted}
      showIncludeDeleted={false}
      addButtonLabel="Add Job"
      showCreate={list.showCreate}
      onToggleCreate={list.toggleShowCreate}
      filters={(
        <div ref={columnMenuRef} className="relative z-50">
          <Button
            type="button"
            variant="ghost"
            className="h-10 gap-2 px-3"
            onClick={() => setShowColumnMenu((current) => !current)}
          >
            <span>Columns</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {visibleColumnKeys.length}
            </span>
          </Button>
          {showColumnMenu ? (
            <div className="absolute left-0 top-full z-[100] mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Columns</p>
                    <p className="mt-1 text-sm text-slate-600">Choose which job fields are visible.</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
                    {visibleColumnKeys.length} selected
                  </span>
                </div>
                <div className="mt-3">
                  <Input
                    value={columnSearch}
                    onChange={(event) => setColumnSearch(event.target.value)}
                    placeholder="Search columns..."
                    className="h-9"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  onClick={selectAllColumns}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  onClick={clearAllColumns}
                >
                  Clear All
                </button>
                <button
                  type="button"
                  className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  onClick={() => setVisibleColumnKeys(DEFAULT_VISIBLE_JOB_COLUMNS)}
                >
                  Reset Default
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto px-2 py-2">
                {filteredColumnOptions.length > 0 ? (
                  filteredColumnOptions.map((option) => {
                    const checked = visibleColumnKeySet.has(option.key);

                    return (
                      <label
                        key={option.key}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          checked ? "bg-blue-50 text-slate-900" : "text-slate-700 hover:bg-slate-50",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-4 rounded border-slate-300 text-blue-600 accent-blue-600"
                          checked={checked}
                          onChange={() => toggleColumn(option.key)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{option.label}</p>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-slate-500">
                    No columns match your search.
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Drag the table header edge to resize visible columns.
              </div>
            </div>
          ) : null}
        </div>
      )}
      createForm={createFormContent}
      error={<ErrorBanner message={error} onDismiss={() => setError(null)} />}
      pagination={pagination}
    >
      <table
        className="w-full table-fixed border-collapse text-left text-sm"
        style={{ minWidth: `${visibleTableMinWidth}px` }}
      >
        <colgroup>
          {visibleJobTableColumns.map((column) => (
            <col key={column.key} style={{ width: `${getColumnWidth(column)}px` }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-slate-300">
            {visibleJobTableColumns.map((column) => (
              <th
                key={column.key}
                className={column.headerClassName}
                style={{ width: `${getColumnWidth(column)}px`, minWidth: `${getColumnWidth(column)}px` }}
              >
                <div className="group relative flex items-center pr-3">
                  <div className="min-w-0 truncate">
                    {column.header}
                  </div>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${typeof column.header === "string" ? column.header : "column"} column`}
                    onMouseDown={(event) => startColumnResize(event, column)}
                    className={cn(
                      "absolute right-[-6px] top-[-1px] h-[calc(100%+2px)] w-3 cursor-col-resize select-none",
                      activeResizeKey === column.key && "bg-sky-200/70",
                    )}
                  >
                    <div className="mx-auto h-full w-px bg-transparent transition-colors group-hover:bg-slate-300" />
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td className="px-3 py-4 text-slate-600" colSpan={visibleJobTableColumns.length}>Loading...</td></tr>
          ) : null}

          {!isLoading && jobItems.length === 0 ? (
            <tr><td className="px-3 py-4 text-slate-600" colSpan={visibleJobTableColumns.length}>No jobs found.</td></tr>
          ) : null}

          {jobItems.map((job, index) => (
            <tr key={job.id} className={getRowClassName(index)}>
              {visibleJobTableColumns.map((column) => (
                <td key={`${job.id}-${column.key}`} className={column.cellClassName}>
                  {column.render(job)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ListPageShell>
  );
}
