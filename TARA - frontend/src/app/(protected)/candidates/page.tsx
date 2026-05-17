"use client";

import Link from "next/link";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Binoculars, FileText, UserRound, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { ListPageShell } from "@/components/common/list-page-shell";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useListPage } from "@/hooks/use-list-page";
import { useSettingsCatalog } from "@/hooks/use-settings-catalog";
import { useUserNameMap } from "@/hooks/use-user-name-map";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/query-keys";
import { createCandidate, getCandidate, listCandidates } from "@/lib/services/candidates";
import { listClients } from "@/lib/services/clients";
import { listCandidateJobApplications } from "@/lib/services/jobs";
import { extractResumePreview, uploadResume } from "@/lib/services/resumes";
import type { Candidate } from "@/lib/types/entities";
import { listVendors } from "@/lib/services/vendors";
import { cn } from "@/lib/utils/cn";
import { toTitleCase } from "@/lib/utils/format";
import { LINE_INPUT_CLASS, getRowClassName } from "@/lib/utils/table-styles";

const EMPTY_CANDIDATE_FORM = {
  firstName: "",
  middleName: "",
  lastName: "",
  status: "new",
  groupBu: "",
  bdm: "",
  role: "",
  currentCompany: "",
  employeeType: "full_time",
  source: "manual",
  referredBy: "",
  referredByOther: "",
  ownership: "",
  email1: "",
  email2: "",
  primaryPhone: "",
  workPhone: "",
  mobilePhone: "",
  otherPhone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  country: "United States",
  employmentPreference: "",
  baseSalary: "",
  desiredSalary: "",
  currentPayRate: "",
  desiredPayRate: "",
  employmentStartDate: "",
  projectStartDate: "",
  desiredLocations: "",
  willingToRelocate: "no",
  comments: "",
  category: "",
  skills: "",
  industry: "",
  scheduleNextAction: "none",
  resumeText: "",
};

type CandidateForm = typeof EMPTY_CANDIDATE_FORM;
type CandidatePreviewTab = "details" | "notes" | "resume" | "experience";
type ToggleableCandidateColumnKey =
  | "id"
  | "firstName"
  | "lastName"
  | "status"
  | "groupBu"
  | "currentCompany"
  | "ownerUserId"
  | "dedupeFingerprint"
  | "generalNotes"
  | "statusNotes"
  | "payNotes"
  | "otherNotes"
  | "deletedAt"
  | "applications";
type CandidateTableColumn = {
  key: string;
  header: React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  defaultWidth: number;
  minWidth: number;
  toggleableKey?: ToggleableCandidateColumnKey;
  render: (_candidate: Candidate) => React.ReactNode;
};

const CANDIDATE_COLUMN_OPTIONS: Array<{ key: ToggleableCandidateColumnKey; label: string }> = [
  { key: "id", label: "ID" },
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "status", label: "Status" },
  { key: "groupBu", label: "Group (BU)" },
  { key: "currentCompany", label: "Current Company" },
  { key: "ownerUserId", label: "Owner" },
  { key: "dedupeFingerprint", label: "Dedupe Fingerprint" },
  { key: "generalNotes", label: "General Notes" },
  { key: "statusNotes", label: "Status Notes" },
  { key: "payNotes", label: "Pay Notes" },
  { key: "otherNotes", label: "Other Notes" },
  { key: "deletedAt", label: "Deleted At" },
  { key: "applications", label: "Applications" },
];

const DEFAULT_VISIBLE_CANDIDATE_COLUMNS: ToggleableCandidateColumnKey[] =
  CANDIDATE_COLUMN_OPTIONS.map((option) => option.key);
const CANDIDATE_CREATE_FORM_ID = "candidate-create-form";

const CANDIDATE_COLUMN_DIMENSIONS: Record<string, { defaultWidth: number; minWidth: number }> = {
  selection: { defaultWidth: 56, minWidth: 56 },
  id: { defaultWidth: 72, minWidth: 60 },
  firstName: { defaultWidth: 140, minWidth: 100 },
  lastName: { defaultWidth: 140, minWidth: 100 },
  status: { defaultWidth: 120, minWidth: 100 },
  groupBu: { defaultWidth: 130, minWidth: 110 },
  currentCompany: { defaultWidth: 250, minWidth: 140 },
  ownerUserId: { defaultWidth: 100, minWidth: 80 },
  dedupeFingerprint: { defaultWidth: 280, minWidth: 160 },
  generalNotes: { defaultWidth: 210, minWidth: 140 },
  statusNotes: { defaultWidth: 210, minWidth: 140 },
  payNotes: { defaultWidth: 210, minWidth: 140 },
  otherNotes: { defaultWidth: 210, minWidth: 140 },
  deletedAt: { defaultWidth: 170, minWidth: 120 },
  applications: { defaultWidth: 120, minWidth: 100 },
};

export default function CandidatesPage() {
  const queryClient = useQueryClient();
  const list = useListPage();
  const session = useAuthStore((state) => state.session);
  const { catalog, defaults } = useSettingsCatalog();
  const resizeStateRef = useRef<{ key: string; startX: number; startWidth: number; minWidth: number } | null>(null);

  const [form, setForm] = useState<CandidateForm>({ ...EMPTY_CANDIDATE_FORM });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [extractMessage, setExtractMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewCandidateId, setPreviewCandidateId] = useState<number | null>(null);
  const [previewTab, setPreviewTab] = useState<CandidatePreviewTab>("details");
  const [visibleColumnKeys] = useState<ToggleableCandidateColumnKey[]>(
    DEFAULT_VISIBLE_CANDIDATE_COLUMNS,
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      Object.entries(CANDIDATE_COLUMN_DIMENSIONS).map(([key, value]) => [key, value.defaultWidth]),
    ),
  );
  const [activeResizeKey, setActiveResizeKey] = useState<string | null>(null);

  const ownerName = useMemo(() => {
    const full = `${session?.user?.first_name ?? ""} ${session?.user?.last_name ?? ""}`.trim();
    if (full) return full;
    const prefix = session?.user?.email?.split("@")[0] ?? "Current User";
    return toTitleCase(prefix);
  }, [session]);

  const candidateStatusOptions = useMemo(
    () => (catalog.candidate_status.length > 0 ? catalog.candidate_status : ["new", "active", "on_hold"]),
    [catalog.candidate_status],
  );
  const candidateEmployeeTypeOptions = useMemo(
    () => (catalog.candidate_employee_type.length > 0 ? catalog.candidate_employee_type : ["full_time", "contract", "part_time"]),
    [catalog.candidate_employee_type],
  );
  const candidateSourceOptions = useMemo(
    () => (catalog.candidate_source.length > 0 ? catalog.candidate_source : ["manual", "referral", "portal"]),
    [catalog.candidate_source],
  );
  const groupBuOptions = useMemo(
    () => catalog.group_bu,
    [catalog.group_bu],
  );
  const defaultCreateForm = useMemo<CandidateForm>(
    () => ({
      ...EMPTY_CANDIDATE_FORM,
      status: defaults.candidate_status || candidateStatusOptions[0] || EMPTY_CANDIDATE_FORM.status,
      groupBu: defaults.group_bu || "",
      bdm: defaults.bdm || "",
      role: defaults.candidate_role || "",
      employeeType:
        defaults.candidate_employee_type || candidateEmployeeTypeOptions[0] || EMPTY_CANDIDATE_FORM.employeeType,
      source: defaults.candidate_source || candidateSourceOptions[0] || EMPTY_CANDIDATE_FORM.source,
    }),
    [
      candidateEmployeeTypeOptions,
      candidateSourceOptions,
      candidateStatusOptions,
      defaults.bdm,
      defaults.candidate_employee_type,
      defaults.candidate_role,
      defaults.candidate_source,
      defaults.candidate_status,
      defaults.group_bu,
    ],
  );

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.candidates.list(list.page, list.includeDeleted),
    queryFn: () => listCandidates({ page: list.page, pageSize: list.pageSize, includeDeleted: list.includeDeleted }),
  });

  const { data: previewCandidate, isLoading: previewLoading } = useQuery({
    queryKey: queryKeys.candidates.detail(previewCandidateId ?? "drawer"),
    queryFn: () => getCandidate(previewCandidateId ?? 0, true),
    enabled: previewCandidateId !== null,
  });

  const candidateItems = useMemo(() => {
    const items = data?.items ?? [];
    const search = list.normalizedSearch.toLowerCase();
    if (!search) return items;
    return items.filter((item) => {
      const haystack = `${item.id} ${item.first_name} ${item.last_name} ${item.email ?? ""} ${item.phone ?? ""} ${item.group_bu ?? ""} ${item.current_company ?? ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [data?.items, list.normalizedSearch]);
  const candidateOwnerIds = useMemo(() => candidateItems.map((candidate) => candidate.owner_user_id), [candidateItems]);
  const { getUserFirstName } = useUserNameMap(candidateOwnerIds);

  useEffect(() => {
    if (previewCandidateId === null) return;
    if (candidateItems.some((item) => item.id === previewCandidateId)) return;
    setPreviewCandidateId(null);
    setPreviewTab("details");
  }, [candidateItems, previewCandidateId]);

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

  useEffect(() => {
    setForm((prev) => {
      const next = { ...prev };
      let changed = false;

      if (prev.status === EMPTY_CANDIDATE_FORM.status) {
        next.status = defaultCreateForm.status;
        changed = true;
      }
      if (prev.groupBu === "") {
        next.groupBu = defaultCreateForm.groupBu;
        changed = true;
      }
      if (prev.bdm === "") {
        next.bdm = defaultCreateForm.bdm;
        changed = true;
      }
      if (prev.role === "") {
        next.role = defaultCreateForm.role;
        changed = true;
      }
      if (prev.employeeType === EMPTY_CANDIDATE_FORM.employeeType) {
        next.employeeType = defaultCreateForm.employeeType;
        changed = true;
      }
      if (prev.source === EMPTY_CANDIDATE_FORM.source) {
        next.source = defaultCreateForm.source;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [defaultCreateForm]);

  const selectedCandidateFromList = useMemo(
    () => candidateItems.find((item) => item.id === previewCandidateId) ?? null,
    [candidateItems, previewCandidateId],
  );

  const previewFullName = useMemo(() => {
    const first = previewCandidate?.first_name ?? selectedCandidateFromList?.first_name ?? "";
    const last = previewCandidate?.last_name ?? selectedCandidateFromList?.last_name ?? "";
    const full = `${first} ${last}`.trim();
    return full || "Candidate";
  }, [previewCandidate?.first_name, previewCandidate?.last_name, selectedCandidateFromList?.first_name, selectedCandidateFromList?.last_name]);

  const pagination = list.getPagination(data?.total ?? 0);
  const selection = list.getSelectionHelpers(candidateItems);
  const visibleColumnKeySet = useMemo(() => new Set(visibleColumnKeys), [visibleColumnKeys]);
  const isApplicationsColumnVisible = visibleColumnKeySet.has("applications");
  const applicationCountQueries = useQueries({
    queries: isApplicationsColumnVisible
      ? candidateItems.map((candidate) => ({
          queryKey: queryKeys.jobs.candidateApplications(candidate.id, 1),
          queryFn: () => listCandidateJobApplications(candidate.id, { page: 1, pageSize: 1 }),
          staleTime: 60_000,
        }))
      : [],
  });
  const applicationCounts = useMemo(() => {
    const counts = new Map<number, number>();

    candidateItems.forEach((candidate, index) => {
      const total = applicationCountQueries[index]?.data?.total;
      if (typeof total === "number") {
        counts.set(candidate.id, total);
      }
    });

    return counts;
  }, [applicationCountQueries, candidateItems]);
  const applicationQueryStateByCandidateId = useMemo(() => {
    const queryStates = new Map<number, (typeof applicationCountQueries)[number]>();

    candidateItems.forEach((candidate, index) => {
      const queryState = applicationCountQueries[index];
      if (queryState) {
        queryStates.set(candidate.id, queryState);
      }
    });

    return queryStates;
  }, [applicationCountQueries, candidateItems]);

  const renderCompactText = (value: string | null | undefined, emptyValue = "-") =>
    value ? (
      <span className="block w-full truncate" title={value}>
        {value}
      </span>
    ) : (
      emptyValue
    );
  const getColumnWidth = (column: CandidateTableColumn) =>
    columnWidths[column.key] ?? column.defaultWidth;
  const startColumnResize = (event: React.MouseEvent<HTMLDivElement>, column: CandidateTableColumn) => {
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

  const candidateTableColumns: CandidateTableColumn[] = [
    {
      key: "selection",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.selection.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.selection.minWidth,
      header: (
        <input
          type="checkbox"
          checked={selection.allSelected}
          onChange={selection.toggleSelectAll}
          aria-label="Select all candidates"
        />
      ),
      headerClassName: "w-16 px-3 py-2",
      cellClassName: "px-3 py-2",
      render: (candidate) => (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={list.selectedIds.has(candidate.id)}
            onChange={() => selection.toggleSelectOne(candidate.id)}
            aria-label={`Select candidate ${candidate.first_name} ${candidate.last_name}`}
          />
          <button
            type="button"
            onClick={() => {
              setPreviewCandidateId(candidate.id);
              setPreviewTab("details");
            }}
            className={cn(
              "text-slate-500 hover:text-blue-700",
              previewCandidateId === candidate.id && "text-blue-700",
            )}
            aria-label={`Open preview for candidate ${candidate.first_name} ${candidate.last_name}`}
          >
            <Binoculars className="size-4" />
          </button>
        </div>
      ),
    },
    {
      key: "id",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.id.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.id.minWidth,
      toggleableKey: "id",
      header: "ID",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 tabular-nums text-slate-800",
      render: (candidate) => candidate.id,
    },
    {
      key: "firstName",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.firstName.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.firstName.minWidth,
      toggleableKey: "firstName",
      header: "First Name",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2",
      render: (candidate) => (
        <Link href={`/candidates/${candidate.id}`} className="font-medium text-blue-700 hover:underline">
          {candidate.first_name}
        </Link>
      ),
    },
    {
      key: "lastName",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.lastName.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.lastName.minWidth,
      toggleableKey: "lastName",
      header: "Last Name",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2",
      render: (candidate) => (
        <Link href={`/candidates/${candidate.id}`} className="font-medium text-blue-700 hover:underline">
          {candidate.last_name}
        </Link>
      ),
    },
    {
      key: "status",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.status.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.status.minWidth,
      toggleableKey: "status",
      header: "Status",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2",
      render: (candidate) => <StatusChip value={candidate.deleted_at ? "deleted" : "active"} />,
    },
    {
      key: "groupBu",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.groupBu.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.groupBu.minWidth,
      toggleableKey: "groupBu",
      header: "Group (BU)",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      render: (candidate) => candidate.group_bu ?? "-",
    },
    {
      key: "currentCompany",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.currentCompany.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.currentCompany.minWidth,
      toggleableKey: "currentCompany",
      header: "Current Company",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      render: (candidate) => renderCompactText(candidate.current_company),
    },
    {
      key: "ownerUserId",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.ownerUserId.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.ownerUserId.minWidth,
      toggleableKey: "ownerUserId",
      header: "Owner",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      render: (candidate) => getUserFirstName(candidate.owner_user_id),
    },
    {
      key: "dedupeFingerprint",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.dedupeFingerprint.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.dedupeFingerprint.minWidth,
      toggleableKey: "dedupeFingerprint",
      header: "Dedupe Fingerprint",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      render: (candidate) => renderCompactText(candidate.dedupe_fingerprint),
    },
    {
      key: "generalNotes",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.generalNotes.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.generalNotes.minWidth,
      toggleableKey: "generalNotes",
      header: "General Notes",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      render: (candidate) => renderCompactText(candidate.hr_notes_general),
    },
    {
      key: "statusNotes",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.statusNotes.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.statusNotes.minWidth,
      toggleableKey: "statusNotes",
      header: "Status Notes",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      render: (candidate) => renderCompactText(candidate.hr_notes_status),
    },
    {
      key: "payNotes",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.payNotes.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.payNotes.minWidth,
      toggleableKey: "payNotes",
      header: "Pay Notes",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      render: (candidate) => renderCompactText(candidate.hr_notes_pay),
    },
    {
      key: "otherNotes",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.otherNotes.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.otherNotes.minWidth,
      toggleableKey: "otherNotes",
      header: "Other Notes",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      render: (candidate) => renderCompactText(candidate.hr_notes_notes),
    },
    {
      key: "deletedAt",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.deletedAt.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.deletedAt.minWidth,
      toggleableKey: "deletedAt",
      header: "Deleted At",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      render: (candidate) => renderCompactText(candidate.deleted_at),
    },
    {
      key: "applications",
      defaultWidth: CANDIDATE_COLUMN_DIMENSIONS.applications.defaultWidth,
      minWidth: CANDIDATE_COLUMN_DIMENSIONS.applications.minWidth,
      toggleableKey: "applications",
      header: "Applications",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      render: (candidate) => {
        const query = applicationQueryStateByCandidateId.get(candidate.id);
        if (query?.isLoading) return "...";
        if (query?.isError) return "-";
        return applicationCounts.get(candidate.id) ?? 0;
      },
    },
  ];
  const visibleCandidateTableColumns = candidateTableColumns.filter(
    (column) => !column.toggleableKey || visibleColumnKeySet.has(column.toggleableKey),
  );
  const visibleTableMinWidth = visibleCandidateTableColumns.reduce(
    (total, column) => total + getColumnWidth(column),
    0,
  );

  const createMutation = useMutation({
    mutationFn: createCandidate,
    onError: (err) => setError(getApiErrorMessage(err, "Failed to create candidate")),
  });

  const uploadResumeMutation = useMutation({
    mutationFn: ({ candidateId, file }: { candidateId: number; file: File }) =>
      uploadResume(candidateId, file),
    onError: (err) => setError(getApiErrorMessage(err, "Resume upload failed")),
  });

  const extractMutation = useMutation({
    mutationFn: extractResumePreview,
    onError: (err) => setError(getApiErrorMessage(err, "Failed to extract details from resume")),
  });

  const resetCreateForm = () => {
    setForm({ ...defaultCreateForm });
    setResumeFile(null);
    setExtractMessage(null);
  };

  const onResumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setResumeFile(file);
    setExtractMessage(null);
  };

  const onExtractFromResume = async () => {
    if (!resumeFile) {
      setError("Please select a resume file first.");
      return;
    }

    setError(null);
    try {
      const extracted = await extractMutation.mutateAsync(resumeFile);
      setForm((prev) => ({
        ...prev,
        firstName: extracted.first_name || prev.firstName,
        lastName: extracted.last_name || prev.lastName,
        email1: extracted.email || prev.email1,
        primaryPhone: extracted.phone || prev.primaryPhone,
        currentCompany: extracted.current_company || prev.currentCompany,
      }));

      const filledFields = [
        extracted.first_name ? "First Name" : null,
        extracted.last_name ? "Last Name" : null,
        extracted.email ? "Email 1" : null,
        extracted.phone ? "Primary Phone" : null,
        extracted.current_company ? "Current Company" : null,
      ].filter(Boolean);

      setExtractMessage(
        filledFields.length > 0
          ? `Auto-filled: ${filledFields.join(", ")}`
          : "No candidate fields could be extracted from this resume.",
      );
    } catch {
      // Error message is already handled by mutation onError.
    }
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setExtractMessage(null);

    if (!form.firstName.trim()) return setError("First Name is required");
    if (!form.lastName.trim()) return setError("Last Name is required");
    if (!resumeFile) return setError("Resume upload is required");

    try {
      let matchedCompanyName: string | undefined;
      const normalizedCompany = form.currentCompany.trim();

      if (normalizedCompany) {
        const [clientResult, vendorResult] = await Promise.all([
          listClients({
            page: 1,
            pageSize: 50,
            includeDeleted: false,
            search: normalizedCompany,
          }),
          listVendors({
            page: 1,
            pageSize: 50,
            includeDeleted: false,
            search: normalizedCompany,
          }),
        ]);

        const exactClient = clientResult.items.find(
          (item) => item.name.trim().toLowerCase() === normalizedCompany.toLowerCase(),
        );
        const exactVendor = vendorResult.items.find(
          (item) => item.name.trim().toLowerCase() === normalizedCompany.toLowerCase(),
        );

        matchedCompanyName = exactClient?.name ?? exactVendor?.name;
      }

      const created = await createMutation.mutateAsync({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email1 || undefined,
        phone: form.primaryPhone || undefined,
        group_bu: form.groupBu.trim() || undefined,
        current_company: matchedCompanyName,
      });

      try {
        await uploadResumeMutation.mutateAsync({ candidateId: created.id, file: resumeFile });
      } catch (uploadErr) {
        setError(
          `Candidate created (ID ${created.id}), but resume upload failed: ${getApiErrorMessage(uploadErr, "Upload failed")}`,
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
        return;
      }

      resetCreateForm();
      list.setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.resumes(created.id) });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create candidate"));
    }
  };

  const onChangeField = <K extends keyof CandidateForm>(field: K, value: CandidateForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const rowClass = "grid gap-2 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center";
  const labelClass = "text-xs font-medium text-slate-700";
  const sectionClass = "overflow-hidden rounded border border-slate-200 bg-white";
  const sectionTitleClass = "border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900";
  const sectionBodyClass = "space-y-3 px-3 py-3";
  const previewTabs: Array<{ id: CandidatePreviewTab; label: string }> = [
    { id: "details", label: "Details" },
    { id: "notes", label: "Notes (0)" },
    { id: "resume", label: "Resume" },
    { id: "experience", label: "Experience" },
  ];

  const kvRowClass = "grid grid-cols-2 border-b border-slate-200 px-3 py-2 text-sm";
  const kvLabelClass = "text-slate-500";
  const kvValueClass = "text-slate-900";

  const createFormContent = (
    <div className="overflow-hidden rounded border border-slate-200 bg-white">
      <form
        id={CANDIDATE_CREATE_FORM_ID}
        className="grid xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]"
        onSubmit={onCreate}
      >
        <div className="border-b border-slate-200 xl:border-b-0 xl:border-r xl:border-slate-200">
          <div className="flex items-center gap-2 border-b border-emerald-300 px-4 py-3 text-lg font-semibold text-slate-900">
            <UserRound className="size-5 text-emerald-600" />
            <span className="text-balance">Add Candidate</span>
          </div>

          <div className="space-y-4 p-4">
            <section className={sectionClass}>
              <div className={sectionTitleClass}>Candidate</div>
              <div className={sectionBodyClass}>
                <div className={rowClass}>
                  <label htmlFor="cand-first-name" className={labelClass}>
                    First Name <span className="text-red-600">*</span>
                  </label>
                  <Input id="cand-first-name" className={LINE_INPUT_CLASS} value={form.firstName} onChange={(e) => onChangeField("firstName", e.target.value)} required />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-middle-name" className={labelClass}>Middle Name</label>
                  <Input id="cand-middle-name" className={LINE_INPUT_CLASS} value={form.middleName} onChange={(e) => onChangeField("middleName", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-last-name" className={labelClass}>
                    Last Name <span className="text-red-600">*</span>
                  </label>
                  <Input id="cand-last-name" className={LINE_INPUT_CLASS} value={form.lastName} onChange={(e) => onChangeField("lastName", e.target.value)} required />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-status" className={labelClass}>
                    Status <span className="text-red-600">*</span>
                  </label>
                  <Select id="cand-status" className={LINE_INPUT_CLASS} value={form.status} onChange={(e) => onChangeField("status", e.target.value)}>
                    {candidateStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {toTitleCase(option.replace(/_/g, " "))}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-group-bu" className={labelClass}>Group (BU)</label>
                  <Select id="cand-group-bu" className={LINE_INPUT_CLASS} value={form.groupBu} onChange={(e) => onChangeField("groupBu", e.target.value)}>
                    <option value="">{groupBuOptions.length > 0 ? "Select Group (BU)" : "No Group (BU) configured"}</option>
                    {groupBuOptions.map((option) => (
                      <option key={option} value={option}>
                        {toTitleCase(option.replace(/_/g, " "))}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-bdm" className={labelClass}>BDM</label>
                  <Input id="cand-bdm" className={LINE_INPUT_CLASS} value={form.bdm} onChange={(e) => onChangeField("bdm", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-role" className={labelClass}>Role</label>
                  <Input id="cand-role" className={LINE_INPUT_CLASS} value={form.role} onChange={(e) => onChangeField("role", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-current-company" className={labelClass}>Current Company</label>
                  <div>
                    <Input id="cand-current-company" className={LINE_INPUT_CLASS} value={form.currentCompany} onChange={(e) => onChangeField("currentCompany", e.target.value)} />
                  </div>
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-employee-type" className={labelClass}>
                    Employee Type <span className="text-red-600">*</span>
                  </label>
                  <Select id="cand-employee-type" className={LINE_INPUT_CLASS} value={form.employeeType} onChange={(e) => onChangeField("employeeType", e.target.value)}>
                    {candidateEmployeeTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {toTitleCase(option.replace(/_/g, " "))}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-source" className={labelClass}>
                    Source <span className="text-red-600">*</span>
                  </label>
                  <Select id="cand-source" className={LINE_INPUT_CLASS} value={form.source} onChange={(e) => onChangeField("source", e.target.value)}>
                    {candidateSourceOptions.map((option) => (
                      <option key={option} value={option}>
                        {toTitleCase(option.replace(/_/g, " "))}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-referred-by" className={labelClass}>Referred By</label>
                  <Input id="cand-referred-by" className={LINE_INPUT_CLASS} value={form.referredBy} onChange={(e) => onChangeField("referredBy", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-referred-by-other" className={labelClass}>Referred By (Other)</label>
                  <Input id="cand-referred-by-other" className={LINE_INPUT_CLASS} value={form.referredByOther} onChange={(e) => onChangeField("referredByOther", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-ownership" className={labelClass}>Ownership</label>
                  <Input id="cand-ownership" className={LINE_INPUT_CLASS} value={ownerName} readOnly />
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <div className={sectionTitleClass}>Contact Information</div>
              <div className={sectionBodyClass}>
                <div className={rowClass}>
                  <label htmlFor="cand-email-1" className={labelClass}>
                    Email 1 <span className="text-red-600">*</span>
                  </label>
                  <Input id="cand-email-1" className={LINE_INPUT_CLASS} type="email" value={form.email1} onChange={(e) => onChangeField("email1", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-email-2" className={labelClass}>Email 2</label>
                  <Input id="cand-email-2" className={LINE_INPUT_CLASS} type="email" value={form.email2} onChange={(e) => onChangeField("email2", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-primary-phone" className={labelClass}>Primary Phone</label>
                  <Input id="cand-primary-phone" className={LINE_INPUT_CLASS} value={form.primaryPhone} onChange={(e) => onChangeField("primaryPhone", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-work-phone" className={labelClass}>Work Phone</label>
                  <Input id="cand-work-phone" className={LINE_INPUT_CLASS} value={form.workPhone} onChange={(e) => onChangeField("workPhone", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-mobile-phone" className={labelClass}>Mobile Phone</label>
                  <Input id="cand-mobile-phone" className={LINE_INPUT_CLASS} value={form.mobilePhone} onChange={(e) => onChangeField("mobilePhone", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-other-phone" className={labelClass}>Other Phone</label>
                  <Input id="cand-other-phone" className={LINE_INPUT_CLASS} value={form.otherPhone} onChange={(e) => onChangeField("otherPhone", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-address-1" className={labelClass}>Address</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input id="cand-address-1" className={LINE_INPUT_CLASS} placeholder="Address 1" value={form.address1} onChange={(e) => onChangeField("address1", e.target.value)} />
                    <Input id="cand-address-2" className={LINE_INPUT_CLASS} placeholder="Address 2" value={form.address2} onChange={(e) => onChangeField("address2", e.target.value)} />
                    <Input id="cand-city" className={LINE_INPUT_CLASS} placeholder="City" value={form.city} onChange={(e) => onChangeField("city", e.target.value)} />
                    <Input id="cand-state" className={LINE_INPUT_CLASS} placeholder="State" value={form.state} onChange={(e) => onChangeField("state", e.target.value)} />
                    <Input id="cand-zip" className={LINE_INPUT_CLASS} placeholder="Zip" value={form.zip} onChange={(e) => onChangeField("zip", e.target.value)} />
                    <Input id="cand-country" className={LINE_INPUT_CLASS} placeholder="Country" value={form.country} onChange={(e) => onChangeField("country", e.target.value)} />
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <div className={sectionTitleClass}>Comments</div>
              <div className={sectionBodyClass}>
                <div className={rowClass}>
                  <label htmlFor="cand-employment-preference" className={labelClass}>Employment Preference</label>
                  <Input id="cand-employment-preference" className={LINE_INPUT_CLASS} value={form.employmentPreference} onChange={(e) => onChangeField("employmentPreference", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-base-salary" className={labelClass}>Base Salary</label>
                  <Input id="cand-base-salary" className={LINE_INPUT_CLASS} value={form.baseSalary} onChange={(e) => onChangeField("baseSalary", e.target.value)} placeholder="USD / INR" />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-desired-salary" className={labelClass}>Desired Salary</label>
                  <Input id="cand-desired-salary" className={LINE_INPUT_CLASS} value={form.desiredSalary} onChange={(e) => onChangeField("desiredSalary", e.target.value)} placeholder="USD / INR" />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-current-pay-rate" className={labelClass}>Current Pay Rate</label>
                  <Input id="cand-current-pay-rate" className={LINE_INPUT_CLASS} value={form.currentPayRate} onChange={(e) => onChangeField("currentPayRate", e.target.value)} placeholder="USD / INR" />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-desired-pay-rate" className={labelClass}>Desired Pay Rate</label>
                  <Input id="cand-desired-pay-rate" className={LINE_INPUT_CLASS} value={form.desiredPayRate} onChange={(e) => onChangeField("desiredPayRate", e.target.value)} placeholder="USD / INR" />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-employment-start-date" className={labelClass}>Employment Start Date</label>
                  <Input id="cand-employment-start-date" className={LINE_INPUT_CLASS} type="date" value={form.employmentStartDate} onChange={(e) => onChangeField("employmentStartDate", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-project-start-date" className={labelClass}>Project Start Date</label>
                  <Input id="cand-project-start-date" className={LINE_INPUT_CLASS} type="date" value={form.projectStartDate} onChange={(e) => onChangeField("projectStartDate", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-desired-locations" className={labelClass}>Desired Locations</label>
                  <Input id="cand-desired-locations" className={LINE_INPUT_CLASS} value={form.desiredLocations} onChange={(e) => onChangeField("desiredLocations", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <fieldset>
                    <legend className="text-sm font-medium text-slate-700">Willing to Relocate</legend>
                    <div className="flex items-center gap-4 text-sm">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="willing-to-relocate"
                          checked={form.willingToRelocate === "no"}
                          onChange={() => onChangeField("willingToRelocate", "no")}
                        />
                        No
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="willing-to-relocate"
                          checked={form.willingToRelocate === "yes"}
                          onChange={() => onChangeField("willingToRelocate", "yes")}
                        />
                        Yes
                      </label>
                    </div>
                  </fieldset>
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-comments" className={labelClass}>Comments</label>
                  <Textarea
                    id="cand-comments"
                    className="min-h-20 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 py-1 shadow-none focus-visible:ring-0"
                    value={form.comments}
                    onChange={(e) => onChangeField("comments", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <div className={sectionTitleClass}>Category &amp; Skills</div>
              <div className={sectionBodyClass}>
                <div className={rowClass}>
                  <label htmlFor="cand-category" className={labelClass}>Category</label>
                  <Input id="cand-category" className={LINE_INPUT_CLASS} value={form.category} onChange={(e) => onChangeField("category", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-skills" className={labelClass}>Skills</label>
                  <Input id="cand-skills" className={LINE_INPUT_CLASS} value={form.skills} onChange={(e) => onChangeField("skills", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label htmlFor="cand-industry" className={labelClass}>Industry</label>
                  <Input id="cand-industry" className={LINE_INPUT_CLASS} value={form.industry} onChange={(e) => onChangeField("industry", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <fieldset>
                    <legend className="text-sm font-medium text-slate-700">Schedule Next Action</legend>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="schedule-next-action"
                          checked={form.scheduleNextAction === "none"}
                          onChange={() => onChangeField("scheduleNextAction", "none")}
                        />
                        None
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="schedule-next-action"
                          checked={form.scheduleNextAction === "submission"}
                          onChange={() => onChangeField("scheduleNextAction", "submission")}
                        />
                        Add Submission
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="schedule-next-action"
                          checked={form.scheduleNextAction === "client_submission"}
                          onChange={() => onChangeField("scheduleNextAction", "client_submission")}
                        />
                        Add Client Submission
                      </label>
                    </div>
                  </fieldset>
                </div>
              </div>
            </section>
          </div>

        </div>
        <aside className="bg-slate-50 p-4">
          <div className="mb-3 border-b border-slate-200 pb-2">
            <p className="text-sm font-semibold text-slate-900">RESUME</p>
          </div>
          <p className="mb-3 text-sm text-slate-600">
            Looking to parse a resume? Drag and drop a file below or paste resume text in the editor.
          </p>
          <div className="space-y-3 rounded border border-slate-200 bg-white p-3">
            <Input type="file" accept=".pdf,.docx,.txt" onChange={onResumeChange} />
            <div className="flex justify-end gap-2">
              <Button
                type="submit"
                variant="secondary"
                disabled={createMutation.isPending || uploadResumeMutation.isPending}
              >
                Add Candidate
              </Button>
              <Button
                type="button"
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={onExtractFromResume}
                disabled={!resumeFile || extractMutation.isPending}
              >
                <FileText className="mr-1 size-4" />
                {extractMutation.isPending ? "Parsing..." : "Parse"}
              </Button>
            </div>
            {resumeFile ? <p className="text-xs text-slate-600">Selected file: {resumeFile.name}</p> : null}
            {extractMessage ? <p className="text-xs text-emerald-700">{extractMessage}</p> : null}
            <Textarea
              id="cand-resume-text"
              className="min-h-44 text-sm"
              value={form.resumeText}
              onChange={(e) => onChangeField("resumeText", e.target.value)}
              placeholder="Paste resume text here for reference..."
            />
          </div>
        </aside>
      </form>
    </div>
  );

  return (
    <ListPageShell
      icon={<UserRound className="size-5 text-sky-600" />}
      title="Candidates"
      search={list.search}
      onSearchChange={list.setSearch}
      includeDeleted={list.includeDeleted}
      onIncludeDeletedChange={list.setIncludeDeleted}
      showIncludeDeleted={false}
      addButtonLabel="Add Candidate"
      showCreate={list.showCreate}
      onToggleCreate={list.toggleShowCreate}
      createSubmitButton={{
        formId: CANDIDATE_CREATE_FORM_ID,
        label: "Create Candidate",
        pendingLabel: "Creating...",
        isPending: createMutation.isPending || uploadResumeMutation.isPending,
      }}
      createForm={createFormContent}
      error={<ErrorBanner message={error} onDismiss={() => setError(null)} />}
      pagination={pagination}
    >
      <div className={cn("grid", previewCandidateId !== null ? "xl:grid-cols-[minmax(0,1fr)_36rem]" : "grid-cols-1")}>
        <div className="overflow-x-auto">
          <table
            className="w-full table-fixed border-collapse text-left text-sm"
            style={{ minWidth: `${visibleTableMinWidth}px` }}
          >
            <colgroup>
              {visibleCandidateTableColumns.map((column) => (
                <col key={column.key} style={{ width: `${getColumnWidth(column)}px` }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-300">
                {visibleCandidateTableColumns.map((column) => (
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
                <tr><td className="px-3 py-4 text-slate-600" colSpan={visibleCandidateTableColumns.length}>Loading...</td></tr>
              ) : null}

              {!isLoading && candidateItems.length === 0 ? (
                <tr><td className="px-3 py-4 text-slate-600" colSpan={visibleCandidateTableColumns.length}>No candidates found.</td></tr>
              ) : null}

              {candidateItems.map((candidate, index) => (
                <tr
                  key={candidate.id}
                  className={cn(
                    getRowClassName(index),
                    previewCandidateId === candidate.id && "bg-sky-100/80",
                  )}
                >
                  {visibleCandidateTableColumns.map((column) => (
                    <td key={`${candidate.id}-${column.key}`} className={column.cellClassName}>
                      {column.render(candidate)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {previewCandidateId !== null ? (
          <aside className="border-l border-slate-300 bg-slate-50">
            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-slate-900">
                    <UserRound className="size-5 shrink-0 text-emerald-600" />
                    <p className="truncate text-lg font-semibold leading-tight">{previewFullName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500">ID: {previewCandidate?.id ?? previewCandidateId}</p>
                    <StatusChip value={previewCandidate?.deleted_at ? "deleted" : "active"} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/candidates/${previewCandidateId}`}
                    className="inline-flex items-center rounded-md bg-ocean px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
                  >
                    Open
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    className="size-8 p-0"
                    onClick={() => setPreviewCandidateId(null)}
                    aria-label="Close candidate preview"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 bg-white px-4">
              <div className="flex min-h-10 items-end gap-5 overflow-x-auto">
                {previewTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewTab(tab.id)}
                    className={cn(
                      "border-b-2 pb-2 text-xs font-medium uppercase",
                      previewTab === tab.id
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <div className="grid grid-cols-5 gap-2">
                {["Tasks", "Submissions", "Client Sub.", "Interviews", "Placements"].map((label) => (
                  <div key={label} className="rounded border border-slate-200 bg-slate-50 px-2 py-2 text-center">
                    <p className="tabular-nums text-lg font-bold leading-none text-slate-700">0</p>
                    <p className="mt-1 text-[10px] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4">
              {previewLoading ? (
                <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading candidate preview...</div>
              ) : null}

              {!previewLoading && previewTab === "details" ? (
                <div className="overflow-hidden rounded border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Summary</div>
                  <div>
                    <div className={kvRowClass}>
                      <span className={kvLabelClass}>First Name</span>
                      <span className={kvValueClass}>{previewCandidate?.first_name ?? "-"}</span>
                    </div>
                    <div className={kvRowClass}>
                      <span className={kvLabelClass}>Last Name</span>
                      <span className={kvValueClass}>{previewCandidate?.last_name ?? "-"}</span>
                    </div>
                    <div className={kvRowClass}>
                      <span className={kvLabelClass}>Status</span>
                      <span><StatusChip value={previewCandidate?.deleted_at ? "deleted" : "active"} /></span>
                    </div>
                    <div className={kvRowClass}>
                      <span className={kvLabelClass}>Group (BU)</span>
                      <span className={kvValueClass}>{previewCandidate?.group_bu ?? "-"}</span>
                    </div>
                    <div className={kvRowClass}>
                      <span className={kvLabelClass}>Email</span>
                      <span className="text-blue-700">{previewCandidate?.email ?? "-"}</span>
                    </div>
                    <div className={kvRowClass}>
                      <span className={kvLabelClass}>Phone</span>
                      <span className={kvValueClass}>{previewCandidate?.phone ?? "-"}</span>
                    </div>
                    <div className={kvRowClass}>
                      <span className={kvLabelClass}>Current Company</span>
                      <span className={kvValueClass}>{previewCandidate?.current_company ?? "-"}</span>
                    </div>
                    <div className="grid grid-cols-2 px-3 py-2 text-sm">
                      <span className={kvLabelClass}>Owner</span>
                      <span className={kvValueClass}>{getUserFirstName(previewCandidate?.owner_user_id)}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {!previewLoading && previewTab === "notes" ? (
                <div className="rounded border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-600">No notes available yet.</p>
                </div>
              ) : null}

              {!previewLoading && previewTab === "resume" ? (
                <div className="space-y-3 rounded border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-600">View and manage resumes for this candidate.</p>
                  <Link
                    href={`/candidates/${previewCandidateId}/resumes`}
                    className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <FileText className="mr-1.5 size-4" />
                    Open Resume Page
                  </Link>
                </div>
              ) : null}

              {!previewLoading && previewTab === "experience" ? (
                <div className="rounded border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-600">Experience details are not configured yet.</p>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </ListPageShell>
  );
}
