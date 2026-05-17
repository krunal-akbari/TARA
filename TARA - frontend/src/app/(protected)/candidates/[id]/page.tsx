"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BriefcaseBusiness, FileText, UserRound } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/lib/auth-store";
import { getApiErrorMessage } from "@/lib/api/http";
import { useSettingsCatalog } from "@/hooks/use-settings-catalog";
import { useUserNameMap } from "@/hooks/use-user-name-map";
import { queryKeys } from "@/lib/query-keys";
import { getCandidate, restoreCandidate, updateCandidate } from "@/lib/services/candidates";
import { getClient } from "@/lib/services/clients";
import { applyCandidateToJob, listCandidateJobApplications, listJobs, updateJobApplicationStatus } from "@/lib/services/jobs";
import { getResumeContent, getResumePreviewText, getResumeStatusPollInterval, listResumes, uploadResume } from "@/lib/services/resumes";
import { getVendor } from "@/lib/services/vendors";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, toTitleCase } from "@/lib/utils/format";
import { getRowClassName, LINE_INPUT_CLASS } from "@/lib/utils/table-styles";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CandidateTabId =
  | "details"
  | "edit"
  | "resume"
  | "notes"
  | "files"
  | "hr_notes";

type CandidateEditMeta = {
  middleName: string;
  status: string;
  groupBu: string;
  bdm: string;
  role: string;
  employeeType: string;
  source: string;
  referredBy: string;
  referredByOther: string;
  ownership: string;
  email2: string;
  workPhone: string;
  mobilePhone: string;
  otherPhone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  employmentPreference: string;
  baseSalary: string;
  desiredSalary: string;
  currentPayRate: string;
  desiredPayRate: string;
  employmentStartDate: string;
  projectStartDate: string;
  desiredLocations: string;
  willingToRelocate: "no" | "yes";
  comments: string;
  category: string;
  skills: string;
  industry: string;
  resumeText: string;
};

type HrNotesState = {
  general: string;
  status: string;
  pay: string;
  notes: string;
};

type HrNotesTabId = "general" | "status" | "pay" | "notes";

type HrInlineState = {
  alias: string;
  salutation: string;
  homePhone: string;
  fax: string;
  ssn: string;
  driverLicense: string;
  birthdate: string;
  age: string;
  race: string;
  gender: string;
  marital: string;
  disabled: boolean;
  smoker: boolean;
  militaryVeteran: boolean;
  specialDisabledVeteran: boolean;
  vietnamEraVeteran: boolean;
  otherProtectedVeteran: boolean;
  nationalGuard: boolean;
  milSepDate: string;
  i9Verified: string;
  renewDate: string;
  visa: string;
  visaExp: string;
  passport: string;
  passportExp: string;
  receiptNumber: string;
  validFrom: string;
  typeOfH1: string;
  payCurrent: string;
  payAnnual: string;
  payCompa: string;
  payLast: string;
  payLastAnnual: string;
  payAsOf: string;
  payDiff: string;
  payDiffDays: string;
  payDiffDollar: string;
  payPctChange: string;
  payFrequency: string;
  unitsPerPeriod: string;
  unitRate: string;
  periodTotal: string;
  bonusType: string;
  bonusAmount: string;
  shift: string;
  premium: string;
  lcaCounty: string;
  lcaPay: string;
  lcaJob: string;
};

/* ------------------------------------------------------------------ */
/*  HR Notes helpers                                                   */
/* ------------------------------------------------------------------ */

const HR_INLINE_PAYLOAD_PREFIX = "\n\n[HR_INLINE_DATA]";
const HR_INLINE_GENERAL_FIELDS: Array<keyof HrInlineState> = [
  "alias", "salutation", "homePhone", "fax", "ssn", "driverLicense",
  "birthdate", "age", "race", "gender", "marital", "disabled", "smoker",
];
const HR_INLINE_STATUS_FIELDS: Array<keyof HrInlineState> = [
  "militaryVeteran", "specialDisabledVeteran", "vietnamEraVeteran",
  "otherProtectedVeteran", "nationalGuard", "milSepDate", "i9Verified",
  "renewDate", "visa", "visaExp", "passport", "passportExp",
  "receiptNumber", "validFrom", "typeOfH1",
];
const HR_INLINE_PAY_FIELDS: Array<keyof HrInlineState> = [
  "payCurrent", "payAnnual", "payCompa", "payLast", "payLastAnnual",
  "payAsOf", "payDiff", "payDiffDays", "payDiffDollar", "payPctChange",
  "payFrequency", "unitsPerPeriod", "unitRate", "periodTotal",
  "bonusType", "bonusAmount", "shift", "premium", "lcaCounty", "lcaPay", "lcaJob",
];
const ALL_HR_INLINE_FIELDS: Array<keyof HrInlineState> = [
  ...HR_INLINE_GENERAL_FIELDS, ...HR_INLINE_STATUS_FIELDS, ...HR_INLINE_PAY_FIELDS,
];

function splitHrNotesPayload(raw: string | null | undefined): { text: string; inline: Partial<HrInlineState> } {
  const value = raw ?? "";
  const markerIndex = value.lastIndexOf(HR_INLINE_PAYLOAD_PREFIX);
  if (markerIndex < 0) return { text: value, inline: {} };
  const text = value.slice(0, markerIndex);
  const payload = value.slice(markerIndex + HR_INLINE_PAYLOAD_PREFIX.length);
  try {
    const parsed = JSON.parse(payload) as Partial<HrInlineState>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { text: value, inline: {} };
    return { text, inline: parsed };
  } catch {
    return { text: value, inline: {} };
  }
}

function pickHrInlineFields(source: HrInlineState | Partial<HrInlineState>, fields: Array<keyof HrInlineState>): Partial<HrInlineState> {
  const picked: Partial<HrInlineState> = {};
  for (const field of fields) {
    const fieldValue = source[field];
    if (fieldValue !== undefined) {
      (picked as Record<keyof HrInlineState, HrInlineState[keyof HrInlineState]>)[field] =
        fieldValue as HrInlineState[keyof HrInlineState];
    }
  }
  return picked;
}

function buildHrNotesPayload(text: string, inline: Partial<HrInlineState>): string {
  return `${text}${HR_INLINE_PAYLOAD_PREFIX}${JSON.stringify(inline)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const EMPTY_EDIT_META: CandidateEditMeta = {
  middleName: "", status: "active", groupBu: "", bdm: "", role: "",
  employeeType: "w2_h1b", source: "manual", referredBy: "", referredByOther: "",
  ownership: "", email2: "", workPhone: "", mobilePhone: "", otherPhone: "",
  address1: "", address2: "", city: "", state: "", zip: "", country: "United States",
  employmentPreference: "", baseSalary: "", desiredSalary: "", currentPayRate: "",
  desiredPayRate: "", employmentStartDate: "", projectStartDate: "",
  desiredLocations: "", willingToRelocate: "no", comments: "", category: "",
  skills: "", industry: "", resumeText: "",
};

const APPLICATION_STATUSES = [
  "applied", "submitted", "client_submitted", "interview",
  "offer", "placed", "rejected", "on_hold", "withdrawn",
] as const;

/* ------------------------------------------------------------------ */
/*  Shared styling constants                                           */
/* ------------------------------------------------------------------ */

const sectionClass = "overflow-hidden rounded border border-slate-200 bg-white";
const sectionTitleClass = "border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900";
const sectionBodyClass = "space-y-3 px-3 py-3";
const rowClass = "grid gap-2 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center";
const kvRowClass = "grid grid-cols-2 border-b border-slate-200 px-3 py-2 text-sm";
const kvLabelClass = "text-slate-500";
const kvValueClass = "text-slate-900";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const parsedCandidateId = Number(id);
  const hasValidId = Number.isInteger(parsedCandidateId) && parsedCandidateId > 0;
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const { catalog } = useSettingsCatalog();

  /* ---- state ---- */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [editMeta, setEditMeta] = useState<CandidateEditMeta>(EMPTY_EDIT_META);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CandidateTabId>("details");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [actionsFeedback, setActionsFeedback] = useState<string | null>(null);
  const [updatingApplicationId, setUpdatingApplicationId] = useState<number | null>(null);
  const [hrNotes, setHrNotes] = useState<HrNotesState>({ general: "", status: "", pay: "", notes: "" });
  const [hrInline, setHrInline] = useState<HrInlineState>({
    alias: "", salutation: "", homePhone: "", fax: "", ssn: "", driverLicense: "",
    birthdate: "", age: "", race: "", gender: "", marital: "", disabled: false,
    smoker: false, militaryVeteran: false, specialDisabledVeteran: false,
    vietnamEraVeteran: false, otherProtectedVeteran: false, nationalGuard: false,
    milSepDate: "", i9Verified: "", renewDate: "", visa: "", visaExp: "",
    passport: "", passportExp: "", receiptNumber: "", validFrom: "", typeOfH1: "",
    payCurrent: "", payAnnual: "", payCompa: "", payLast: "", payLastAnnual: "",
    payAsOf: "", payDiff: "0.0000", payDiffDays: "0", payDiffDollar: "$0.00",
    payPctChange: "0.0", payFrequency: "Semi-monthly", unitsPerPeriod: "88.0000",
    unitRate: "", periodTotal: "", bonusType: "", bonusAmount: "0.00", shift: "",
    premium: "0.0000", lcaCounty: "", lcaPay: "", lcaJob: "",
  });
  const [hrNotesTab, setHrNotesTab] = useState<HrNotesTabId>("general");
  const [initialHrInlineSnapshot, setInitialHrInlineSnapshot] = useState<Partial<HrInlineState>>({});
  const actionsPanelRef = useRef<HTMLDivElement | null>(null);
  const normalizedJobSearch = jobSearch.trim();

  /* ---- catalog options ---- */
  const candidateStatusOptions = useMemo(() => {
    const configured = catalog.candidate_status.length > 0 ? catalog.candidate_status : ["new", "active", "on_hold"];
    if (editMeta.status && !configured.includes(editMeta.status)) return [...configured, editMeta.status];
    return configured;
  }, [catalog.candidate_status, editMeta.status]);

  const candidateEmployeeTypeOptions = useMemo(() => {
    const configured = catalog.candidate_employee_type.length > 0 ? catalog.candidate_employee_type : ["full_time", "contract", "part_time"];
    if (editMeta.employeeType && !configured.includes(editMeta.employeeType)) return [...configured, editMeta.employeeType];
    return configured;
  }, [catalog.candidate_employee_type, editMeta.employeeType]);

  const candidateSourceOptions = useMemo(() => {
    const configured = catalog.candidate_source.length > 0 ? catalog.candidate_source : ["manual", "referral", "portal"];
    if (editMeta.source && !configured.includes(editMeta.source)) return [...configured, editMeta.source];
    return configured;
  }, [catalog.candidate_source, editMeta.source]);

  const groupBuOptions = useMemo(() => {
    const configured = catalog.group_bu;
    if (editMeta.groupBu && !configured.includes(editMeta.groupBu)) return [...configured, editMeta.groupBu];
    return configured;
  }, [catalog.group_bu, editMeta.groupBu]);

  const setMetaField = <K extends keyof CandidateEditMeta>(key: K, value: CandidateEditMeta[K]) =>
    setEditMeta((prev) => ({ ...prev, [key]: value }));

  /* ---- queries ---- */
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.candidates.detail(id),
    queryFn: () => getCandidate(id, true),
    enabled: hasValidId,
  });

  const resumesQuery = useQuery({
    queryKey: queryKeys.candidates.resumes(id),
    queryFn: () => listResumes(id, { page: 1, pageSize: 20 }),
    enabled: hasValidId,
    refetchInterval: (query) => getResumeStatusPollInterval(query.state.data),
  });
  const { getUserFirstName } = useUserNameMap([data?.owner_user_id]);
  const { data: resumesData, isLoading: resumesLoading } = resumesQuery;

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: [...queryKeys.jobs.all, "candidate-actions-picker", normalizedJobSearch],
    queryFn: () => listJobs({ page: 1, pageSize: 50, search: normalizedJobSearch || undefined }),
    enabled: hasValidId && actionsOpen,
  });

  const { data: candidateApplicationsData, isLoading: candidateApplicationsLoading } = useQuery({
    queryKey: queryKeys.jobs.candidateApplications(id, 1),
    queryFn: () => listCandidateJobApplications(id, { page: 1, pageSize: 20 }),
    enabled: hasValidId,
  });

  /* ---- sync server → state ---- */
  useEffect(() => {
    if (!data) return;
    const parsedGeneral = splitHrNotesPayload(data.hr_notes_general);
    const parsedStatus = splitHrNotesPayload(data.hr_notes_status);
    const parsedPay = splitHrNotesPayload(data.hr_notes_pay);
    const parsedInline: Partial<HrInlineState> = {
      ...parsedGeneral.inline, ...parsedStatus.inline, ...parsedPay.inline,
    };
    setFirstName(data.first_name);
    setLastName(data.last_name);
    setEmail(data.email ?? "");
    setPhone(data.phone ?? "");
    setCompany(data.current_company ?? "");
    setEditMeta((prev) => ({
      ...prev,
      groupBu: data.group_bu ?? "",
      ownership: data.owner_user_id ? String(data.owner_user_id) : "",
      mobilePhone: data.phone ?? "",
      status: data.deleted_at ? "deleted" : "active",
    }));
    setHrNotes({
      general: parsedGeneral.text, status: parsedStatus.text,
      pay: parsedPay.text, notes: data.hr_notes_notes ?? "",
    });
    setHrInline((prev) => {
      const next = {
        ...prev, ...parsedInline,
        payCurrent: editMeta.currentPayRate || prev.payCurrent,
        payAnnual: editMeta.baseSalary || prev.payAnnual,
        payLast: editMeta.desiredPayRate || prev.payLast,
        payLastAnnual: editMeta.desiredSalary || prev.payLastAnnual,
        payAsOf: editMeta.projectStartDate || prev.payAsOf,
        unitRate: editMeta.currentPayRate || prev.unitRate,
        typeOfH1: editMeta.employeeType.includes("h1b") ? "Transfer" : prev.typeOfH1,
      };
      setInitialHrInlineSnapshot(pickHrInlineFields(next, ALL_HR_INLINE_FIELDS));
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when server data changes
  }, [data]);

  /* ---- mutations ---- */
  const updateMutation = useMutation({
    mutationFn: () =>
      updateCandidate(id, {
        first_name: firstName.trim(), last_name: lastName.trim(),
        email: email || undefined, phone: phone || undefined,
        group_bu: editMeta.groupBu || undefined,
        current_company: company || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to update candidate")),
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreCandidate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to restore candidate")),
  });

  const uploadResumeMutation = useMutation({
    mutationFn: (file: File) => uploadResume(id, file),
    onSuccess: () => {
      setSelectedUploadFile(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.resumes(id) });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to upload file")),
  });

  const saveHrNotesMutation = useMutation({
    mutationFn: () =>
      updateCandidate(id, {
        hr_notes_general: buildHrNotesPayload(hrNotes.general, pickHrInlineFields(hrInline, HR_INLINE_GENERAL_FIELDS)),
        hr_notes_status: buildHrNotesPayload(hrNotes.status, pickHrInlineFields(hrInline, HR_INLINE_STATUS_FIELDS)),
        hr_notes_pay: buildHrNotesPayload(hrNotes.pay, pickHrInlineFields(hrInline, HR_INLINE_PAY_FIELDS)),
        hr_notes_notes: hrNotes.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to save HR notes")),
  });

  const applyMutation = useMutation({
    mutationFn: (jobId: number) => applyCandidateToJob(jobId, { candidate_id: parsedCandidateId }),
    onSuccess: (_result, jobId) => {
      const normalizedJobId = String(jobId);
      queryClient.invalidateQueries({ queryKey: ["job-applications", normalizedJobId] });
      queryClient.invalidateQueries({ queryKey: ["candidate-job-applications", id] });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(normalizedJobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.list(1, false) });
    },
    onError: (err) => setActionsFeedback(getApiErrorMessage(err, "Failed to apply candidate to job")),
  });

  const updateApplicationStatusMutation = useMutation({
    mutationFn: (payload: { jobId: number; applicationId: number; status: string }) =>
      updateJobApplicationStatus(payload.jobId, payload.applicationId, { status: payload.status }),
    onSuccess: (_result, payload) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.candidateApplications(id, 1) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.applications(String(payload.jobId), 1) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(String(payload.jobId)) });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to update application status")),
    onSettled: () => setUpdatingApplicationId(null),
  });

  /* ---- form submit ---- */
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("First Name and Last Name are required");
      return;
    }
    updateMutation.mutate();
  };

  /* ---- derived ---- */
  const canViewHrNotes = (session?.user?.roles ?? []).some((role) => {
    const normalized = role.trim().toLowerCase();
    return normalized === "hr" || normalized === "admin";
  });

  useEffect(() => {
    if (!canViewHrNotes && activeTab === "hr_notes") setActiveTab("details");
  }, [activeTab, canViewHrNotes]);

  const tabs = useMemo(() => {
    const items: Array<{ id: CandidateTabId; label: string }> = [
      { id: "details", label: "Details" },
      { id: "edit", label: "Edit" },
      { id: "resume", label: "Resume" },
      { id: "notes", label: "Activity" },
      { id: "files", label: "Files" },
    ];
    if (canViewHrNotes) items.push({ id: "hr_notes", label: "HR" });
    return items;
  }, [canViewHrNotes]);

  const fullName = `${firstName} ${lastName}`.trim();
  const filteredJobs = useMemo(() => jobsData?.items ?? [], [jobsData]);
  const clientIds = useMemo(
    () => Array.from(new Set(filteredJobs.map((job) => job.origin_client_id).filter((v): v is number => v !== null))),
    [filteredJobs],
  );
  const vendorIds = useMemo(
    () => Array.from(new Set(filteredJobs.map((job) => job.origin_vendor_id).filter((v): v is number => v !== null))),
    [filteredJobs],
  );
  const clientNameQueries = useQueries({
    queries: clientIds.map((cid) => ({
      queryKey: queryKeys.clients.detail(cid),
      queryFn: () => getClient(cid, true),
      enabled: actionsOpen,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const vendorNameQueries = useQueries({
    queries: vendorIds.map((vid) => ({
      queryKey: queryKeys.vendors.detail(vid),
      queryFn: () => getVendor(vid, true),
      enabled: actionsOpen,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const clientNameMap = useMemo(() => {
    const entries: Array<[number, string]> = [];
    clientIds.forEach((cid, i) => { const c = clientNameQueries[i]?.data; if (c) entries.push([cid, c.name]); });
    return new Map(entries);
  }, [clientIds, clientNameQueries]);
  const vendorNameMap = useMemo(() => {
    const entries: Array<[number, string]> = [];
    vendorIds.forEach((vid, i) => { const v = vendorNameQueries[i]?.data; if (v) entries.push([vid, v.name]); });
    return new Map(entries);
  }, [vendorIds, vendorNameQueries]);
  const selectedJob = useMemo(
    () => (jobsData?.items ?? []).find((job) => job.id === selectedJobId) ?? null,
    [jobsData, selectedJobId],
  );

  const initialHrNotes = useMemo(
    () => ({
      general: splitHrNotesPayload(data?.hr_notes_general).text,
      status: splitHrNotesPayload(data?.hr_notes_status).text,
      pay: splitHrNotesPayload(data?.hr_notes_pay).text,
      notes: data?.hr_notes_notes ?? "",
    }),
    [data?.hr_notes_general, data?.hr_notes_status, data?.hr_notes_pay, data?.hr_notes_notes],
  );
  const isHrNotesDirty = useMemo(() => {
    const textChanged = hrNotes.general !== initialHrNotes.general
      || hrNotes.status !== initialHrNotes.status
      || hrNotes.pay !== initialHrNotes.pay
      || hrNotes.notes !== initialHrNotes.notes;
    if (textChanged) return true;
    return ALL_HR_INLINE_FIELDS.some((field) => hrInline[field] !== initialHrInlineSnapshot[field]);
  }, [hrNotes, initialHrNotes, hrInline, initialHrInlineSnapshot]);

  const applicationStatusCounts = useMemo(() => {
    return (candidateApplicationsData?.items ?? []).reduce<Record<string, number>>((counts, app) => {
      const s = app.status.trim().toLowerCase();
      counts[s] = (counts[s] ?? 0) + 1;
      return counts;
    }, {});
  }, [candidateApplicationsData?.items]);

  const submissionsCount = candidateApplicationsData?.total ?? 0;
  const clientSubmissionsCount = applicationStatusCounts.client_submitted ?? 0;
  const interviewsCount = applicationStatusCounts.interview ?? 0;
  const placementsCount = applicationStatusCounts.placed ?? 0;
  const headerStats = useMemo(
    () => [
      { label: "Tasks", value: 0 },
      { label: "Submissions", value: submissionsCount },
      { label: "Client Submissions", value: clientSubmissionsCount },
      { label: "Interviews", value: interviewsCount },
      { label: "Placements", value: placementsCount },
    ],
    [clientSubmissionsCount, interviewsCount, placementsCount, submissionsCount],
  );

  const seniorityYears = useMemo(() => {
    if (!editMeta.employmentStartDate) return "-";
    const start = new Date(editMeta.employmentStartDate);
    if (Number.isNaN(start.getTime())) return "-";
    const years = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return years < 0 ? "-" : `${years.toFixed(1)} Years`;
  }, [editMeta.employmentStartDate]);

  /* ---- resume preview ---- */
  const latestResume = resumesData?.items?.[0];
  const latestResumeType = (latestResume?.content_type ?? "").toLowerCase();
  const supportsDirectPreview = latestResumeType.startsWith("text/") || latestResumeType.includes("pdf");
  const [resumePreviewUrl, setResumePreviewUrl] = useState<string | null>(null);
  const [resumePreviewText, setResumePreviewText] = useState<string | null>(null);

  const { data: resumeBlob, isLoading: resumeContentLoading } = useQuery({
    queryKey: ["candidate-resume-content", id, latestResume?.id],
    queryFn: () => getResumeContent(id, latestResume!.id),
    enabled: hasValidId && !!latestResume,
  });

  const { data: resumePreviewTextData, isLoading: resumePreviewTextLoading } = useQuery({
    queryKey: ["candidate-resume-preview-text", id, latestResume?.id],
    queryFn: () => getResumePreviewText(id, latestResume!.id),
    enabled: hasValidId && !!latestResume && !supportsDirectPreview,
  });

  useEffect(() => {
    if (!resumeBlob || !latestResume) {
      setResumePreviewUrl(null);
      setResumePreviewText(null);
      return;
    }
    const contentType = latestResume.content_type.toLowerCase();
    if (contentType.startsWith("text/")) {
      resumeBlob.text().then((t) => setResumePreviewText(t)).catch(() => setResumePreviewText("Unable to load text preview."));
      setResumePreviewUrl(null);
      return;
    }
    if (contentType.includes("pdf")) {
      const objectUrl = URL.createObjectURL(resumeBlob);
      setResumePreviewUrl(objectUrl);
      setResumePreviewText(null);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setResumePreviewUrl(null);
    setResumePreviewText(null);
    return;
  }, [resumeBlob, latestResume]);

  /* ---- actions panel close-on-outside-click ---- */
  useEffect(() => {
    if (!actionsOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!actionsPanelRef.current) return;
      const target = event.target as Node | null;
      if (target && !actionsPanelRef.current.contains(target)) setActionsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setActionsOpen(false); };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [actionsOpen]);

  const onApplyToJob = async () => {
    if (!selectedJob) { setActionsFeedback("Select one job first."); return; }
    setActionsFeedback(null);
    try {
      await applyMutation.mutateAsync(selectedJob.id);
      setActionsFeedback(`Applied to ${selectedJob.title}.`);
      setActionsOpen(false);
    } catch { /* Error text set in onError handler */ }
  };

  const statusLabel = data?.deleted_at ? "Deleted" : toTitleCase(editMeta.status);

  /* ---- guard ---- */
  if (!hasValidId) return <ErrorBanner message="Invalid candidate id." />;

  /* ================================================================== */
  /*  RENDER                                                             */
  /* ================================================================== */

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {isLoading ? (
        <Card><p className="text-sm text-slate-600">Loading candidate details...</p></Card>
      ) : null}

      {data ? (
        <>
          {/* ======================== HEADER CARD ======================== */}
          <Card className="overflow-visible p-0">
            {/* ---- title row ---- */}
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UserRound className="size-5 text-emerald-600" />
                  <p className="text-3xl font-semibold tabular-nums text-slate-900">{data.id}</p>
                  <p className="text-2xl text-slate-300">|</p>
                  <p className="text-balance text-3xl font-semibold leading-none text-slate-900">{fullName || "-"}</p>
                  <StatusChip value={statusLabel} />
                </div>
                <div ref={actionsPanelRef} className="relative flex items-center gap-2">
                  <Button type="button" variant="secondary" onClick={() => setActionsOpen((prev) => !prev)}>
                    Actions
                  </Button>

                  {actionsOpen ? (
                    <div className="absolute right-0 top-full z-20 mt-2 w-[26rem] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
                      <p className="text-sm font-semibold text-slate-900">Apply Candidate To Job</p>
                      <p className="mt-1 text-xs text-slate-500">Only one job can be assigned here at a time.</p>
                      <div className="mt-3">
                        <Input
                          placeholder="Search job name"
                          value={jobSearch}
                          onChange={(event) => { setJobSearch(event.target.value); setSelectedJobId(null); setActionsFeedback(null); }}
                        />
                      </div>
                      <div className="mt-2 max-h-56 overflow-auto rounded border border-slate-200">
                        {jobsLoading ? <p className="px-3 py-2 text-sm text-slate-600">Loading jobs...</p> : null}
                        {!jobsLoading && filteredJobs.length === 0 ? <p className="px-3 py-2 text-sm text-slate-600">No jobs match your search.</p> : null}
                        {!jobsLoading ? filteredJobs.map((job) => (
                          <button
                            key={job.id}
                            type="button"
                            onClick={() => { setSelectedJobId(job.id); setActionsFeedback(null); }}
                            className={cn(
                              "flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0",
                              selectedJobId === job.id ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50",
                            )}
                          >
                            <span className="min-w-0 pr-3">
                              <span className="block truncate font-medium">{job.title}</span>
                              <span className="block truncate text-xs text-slate-500">
                                {(() => {
                                  const parts: string[] = [];
                                  if (job.origin_client_id) parts.push(`Client: ${clientNameMap.get(job.origin_client_id) ?? `#${job.origin_client_id}`}`);
                                  if (job.origin_vendor_id) parts.push(`Business Partner: ${vendorNameMap.get(job.origin_vendor_id) ?? `#${job.origin_vendor_id}`}`);
                                  return parts.length > 0 ? parts.join(" | ") : "No host assigned";
                                })()}
                              </span>
                            </span>
                          </button>
                        )) : null}
                      </div>
                      {actionsFeedback ? <p className="mt-2 text-xs text-slate-600">{actionsFeedback}</p> : null}
                      <div className="mt-3 flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setActionsOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={onApplyToJob} disabled={!selectedJobId || applyMutation.isPending}>
                          {applyMutation.isPending ? "Applying..." : "Apply To Job"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* ---- quick info row ---- */}
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <div><p className="text-xs font-medium text-slate-500">Email</p><p className="mt-0.5 break-all text-slate-900">{data.email || "-"}</p></div>
                <div><p className="text-xs font-medium text-slate-500">Phone</p><p className="mt-0.5 text-slate-900">{data.phone || "-"}</p></div>
                <div><p className="text-xs font-medium text-slate-500">Company</p><p className="mt-0.5 text-slate-900">{data.current_company || "-"}</p></div>
                <div><p className="text-xs font-medium text-slate-500">Group (BU)</p><p className="mt-0.5 text-slate-900">{data.group_bu || "-"}</p></div>
                <div><p className="text-xs font-medium text-slate-500">Owner</p><p className="mt-0.5 text-slate-900">{getUserFirstName(data.owner_user_id)}</p></div>
              </div>
            </div>

            {/* ---- tabs ---- */}
            <div className="overflow-x-auto border-b border-slate-200">
              <div className="flex min-w-max items-center gap-4 px-4 py-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={cn(
                      "border-b-2 px-1 py-1 text-sm font-medium",
                      activeTab === tab.id
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-600 hover:text-slate-900",
                    )}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ---- stats bar (except HR tab) ---- */}
            {activeTab !== "hr_notes" ? (
              <div className="bg-white px-4 py-3">
                <div className="grid grid-cols-5 gap-2">
                  {headerStats.map((stat) => (
                    <div key={stat.label} className="rounded border border-slate-200 bg-slate-50 px-2 py-2 text-center">
                      <p className="tabular-nums text-2xl font-semibold leading-none text-slate-700">{stat.value}</p>
                      <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          {/* ====================== DETAILS TAB ====================== */}
          {activeTab === "details" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              {/* -- Resume preview panel -- */}
              <Card className="overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-900">Resume</p>
                  </div>
                  {latestResume ? <p className="text-xs text-slate-500">{latestResume.file_name}</p> : null}
                </div>

                <div className="max-h-[72dvh] overflow-auto bg-slate-50 px-4 py-4">
                  {resumesLoading ? <p className="text-sm text-slate-600">Loading resumes...</p> : null}

                  {!resumesLoading && !latestResume ? (
                    <div className="rounded border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-700">No resume uploaded for this candidate yet.</p>
                      <div className="mt-3">
                        <Link href={`/candidates/${id}/resumes`} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
                          Upload Resume <ArrowUpRight className="size-3.5" />
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  {!resumesLoading && latestResume ? (
                    <div className="space-y-3">
                      <div className="rounded border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase text-slate-500">Latest Resume</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{latestResume.file_name}</p>
                        <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                          <p>Type: {latestResume.content_type}</p>
                          <p>Size: {formatFileSize(latestResume.size_bytes)}</p>
                          <p className="inline-flex items-center gap-1">Parse: <StatusChip value={latestResume.parse_status} /></p>
                        </div>
                        <div className="mt-3">
                          <Link href={`/candidates/${id}/resumes`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                            Open Resume Manager <ArrowUpRight className="size-3.5" />
                          </Link>
                        </div>
                      </div>

                      <div className="rounded border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">Preview</p>
                        {resumeContentLoading ? <p className="mt-2 text-sm text-slate-600">Loading resume preview...</p> : null}
                        {!resumeContentLoading && resumePreviewTextLoading ? <p className="mt-2 text-sm text-slate-600">Extracting resume text preview...</p> : null}
                        {!resumeContentLoading && resumePreviewUrl ? (
                          <iframe title={`Resume preview for ${fullName || "candidate"}`} src={resumePreviewUrl} className="mt-2 h-[56dvh] w-full rounded border border-slate-200 bg-white" />
                        ) : null}
                        {!resumeContentLoading && !resumePreviewUrl && resumePreviewText ? (
                          <pre className="mt-2 max-h-[56dvh] overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">{resumePreviewText}</pre>
                        ) : null}
                        {!resumeContentLoading && !resumePreviewUrl && !resumePreviewText && resumePreviewTextData?.text ? (
                          <pre className="mt-2 max-h-[56dvh] overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">{resumePreviewTextData.text}</pre>
                        ) : null}
                        {!resumeContentLoading && !resumePreviewTextLoading && !resumePreviewUrl && !resumePreviewText && !resumePreviewTextData?.text ? (
                          <div className="mt-2 space-y-2 text-sm text-slate-700">
                            <p>Inline preview is not supported for this file type ({latestResume.content_type}).</p>
                            <p>Use Resume Manager to download/open the file.</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>

              {/* -- Right column -- */}
              <div className="space-y-4">
                {/* Open Submissions */}
                <Card className="overflow-hidden p-0">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <BriefcaseBusiness className="size-4 text-slate-600" />
                      <p className="text-sm font-semibold text-slate-900">Open Submissions</p>
                    </div>
                  </div>
                  <div className="px-3 py-3">
                    {candidateApplicationsLoading ? <p className="text-sm text-slate-600">Loading submissions...</p> : null}
                    {!candidateApplicationsLoading && (candidateApplicationsData?.items?.length ?? 0) === 0 ? (
                      <p className="text-sm text-slate-600">No open submissions for this candidate yet.</p>
                    ) : null}
                    {!candidateApplicationsLoading && (candidateApplicationsData?.items?.length ?? 0) > 0 ? (
                      <div className="space-y-2">
                        {(candidateApplicationsData?.items ?? []).map((application) => {
                          const normalizedCurrentStatus = application.status.trim().toLowerCase();
                          const statusOptions = APPLICATION_STATUSES.includes(normalizedCurrentStatus as (typeof APPLICATION_STATUSES)[number])
                            ? APPLICATION_STATUSES
                            : [normalizedCurrentStatus, ...APPLICATION_STATUSES];
                          return (
                            <div key={application.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                              <p className="font-medium text-slate-900">{application.job_title}</p>
                              <p className="mt-1 text-xs text-slate-500">Job ID #{application.job_id}</p>
                              <div className="mt-2">
                                <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</Label>
                                <Select
                                  className="mt-1 h-8 text-xs"
                                  value={normalizedCurrentStatus}
                                  disabled={updateApplicationStatusMutation.isPending && updatingApplicationId === application.id}
                                  onChange={(event) => {
                                    const nextStatus = event.target.value;
                                    if (nextStatus === normalizedCurrentStatus) return;
                                    setUpdatingApplicationId(application.id);
                                    updateApplicationStatusMutation.mutate({ jobId: application.job_id, applicationId: application.id, status: nextStatus });
                                  }}
                                >
                                  {statusOptions.map((opt) => <option key={opt} value={opt}>{opt.replaceAll("_", " ")}</option>)}
                                </Select>
                              </div>
                              <Link href={`/jobs/${application.job_id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
                                Open Job <ArrowUpRight className="size-3" />
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => { setActionsOpen(true); setActionsFeedback(null); }}>
                      {(candidateApplicationsData?.items?.length ?? 0) > 0 ? "Apply To Another Job +" : "Apply To Job +"}
                    </Button>
                  </div>
                </Card>

                {/* Detail card */}
                <Card className="overflow-hidden p-0">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Detail</div>
                  <div className="grid gap-0 text-sm">
                    <div className={kvRowClass}><span className={kvLabelClass}>First Name</span><span className={kvValueClass}>{data.first_name}</span></div>
                    <div className={kvRowClass}><span className={kvLabelClass}>Last Name</span><span className={kvValueClass}>{data.last_name}</span></div>
                    <div className={kvRowClass}><span className={kvLabelClass}>Email</span><span className="break-all text-sky-700">{data.email || "-"}</span></div>
                    <div className={kvRowClass}><span className={kvLabelClass}>Phone</span><span className={kvValueClass}>{data.phone || "-"}</span></div>
                    <div className={kvRowClass}><span className={kvLabelClass}>Company</span><span className={kvValueClass}>{data.current_company || "-"}</span></div>
                    <div className={kvRowClass}><span className={kvLabelClass}>Group (BU)</span><span className={kvValueClass}>{data.group_bu || "-"}</span></div>
                    <div className={kvRowClass}><span className={kvLabelClass}>Fingerprint</span><span className="break-all text-slate-900">{data.dedupe_fingerprint || "-"}</span></div>
                    <div className="grid grid-cols-2 px-3 py-2 text-sm"><span className={kvLabelClass}>Owner</span><span className="text-slate-900">{getUserFirstName(data.owner_user_id)}</span></div>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* ====================== RESUME TAB ====================== */}
          {activeTab === "resume" ? (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Resume Files</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="px-3 py-2 font-medium">File</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Size</th>
                      <th className="px-3 py-2 font-medium">Parse Status</th>
                      <th className="px-3 py-2 font-medium">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumesLoading ? <tr><td className="px-3 py-3 text-slate-600" colSpan={5}>Loading...</td></tr> : null}
                    {!resumesLoading && (resumesData?.items?.length ?? 0) === 0 ? <tr><td className="px-3 py-3 text-slate-600" colSpan={5}>No resumes found.</td></tr> : null}
                    {(resumesData?.items ?? []).map((resume, idx) => (
                      <tr key={resume.id} className={getRowClassName(idx)}>
                        <td className="px-3 py-2 text-slate-900">{resume.file_name}</td>
                        <td className="px-3 py-2 text-slate-700">{resume.content_type}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-700">{formatFileSize(resume.size_bytes)}</td>
                        <td className="px-3 py-2"><StatusChip value={resume.parse_status} /></td>
                        <td className="px-3 py-2 text-slate-700">{formatDateTime(resume.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-200 px-3 py-2">
                <Link href={`/candidates/${id}/resumes`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                  Open Resume Manager <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </Card>
          ) : null}

          {/* ====================== ACTIVITY TAB ====================== */}
          {activeTab === "notes" ? (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Activity</div>
              {candidateApplicationsLoading ? <p className="px-3 py-3 text-sm text-slate-600">Loading activity...</p> : null}
              {!candidateApplicationsLoading && (candidateApplicationsData?.items?.length ?? 0) === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-600">No activity yet.</p>
              ) : null}
              {!candidateApplicationsLoading && (candidateApplicationsData?.items?.length ?? 0) > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-600">
                        <th className="px-3 py-2 font-medium">When</th>
                        <th className="px-3 py-2 font-medium">Job</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(candidateApplicationsData?.items ?? []).map((item, idx) => (
                        <tr key={item.id} className={getRowClassName(idx)}>
                          <td className="px-3 py-2 text-slate-700">{formatDateTime(item.created_at)}</td>
                          <td className="px-3 py-2">
                            <Link href={`/jobs/${item.job_id}`} className="font-medium text-blue-700 hover:underline">{item.job_title}</Link>
                          </td>
                          <td className="px-3 py-2"><StatusChip value={item.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Card>
          ) : null}

          {/* ====================== FILES TAB ====================== */}
          {activeTab === "files" ? (
            <div className="space-y-4">
              {/* upload */}
              <Card className="overflow-hidden p-0">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Upload File</div>
                <div className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setSelectedUploadFile(event.target.files?.[0] ?? null)}
                      className="text-sm text-slate-700 file:mr-2 file:rounded file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                    />
                    <Button type="button" onClick={() => selectedUploadFile && uploadResumeMutation.mutate(selectedUploadFile)} disabled={!selectedUploadFile || uploadResumeMutation.isPending}>
                      {uploadResumeMutation.isPending ? "Uploading..." : "Add File"}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* file list */}
              <Card className="overflow-hidden p-0">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                  Uploaded Files <span className="font-normal text-slate-500">({resumesData?.total ?? 0})</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-600">
                        <th className="px-3 py-2 font-medium">File</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Size</th>
                        <th className="px-3 py-2 font-medium">Uploaded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumesLoading ? <tr><td className="px-3 py-3 text-slate-600" colSpan={4}>Loading files...</td></tr> : null}
                      {!resumesLoading && (resumesData?.items?.length ?? 0) === 0 ? <tr><td className="px-3 py-3 text-slate-600" colSpan={4}>No files uploaded yet.</td></tr> : null}
                      {(resumesData?.items ?? []).map((resume, idx) => (
                        <tr key={resume.id} className={getRowClassName(idx)}>
                          <td className="px-3 py-2 text-slate-900">{resume.file_name}</td>
                          <td className="px-3 py-2 text-slate-700">{resume.content_type}</td>
                          <td className="px-3 py-2 tabular-nums text-slate-700">{formatFileSize(resume.size_bytes)}</td>
                          <td className="px-3 py-2 text-slate-700">{formatDateTime(resume.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-200 px-3 py-2">
                  <Link href={`/candidates/${id}/resumes`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                    Open Resume Manager <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </Card>
            </div>
          ) : null}

          {/* ====================== HR NOTES TAB ====================== */}
          {activeTab === "hr_notes" && canViewHrNotes ? (
            <Card className="overflow-hidden p-0">
              <div className="space-y-4 px-4 py-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <p className="text-sm font-semibold uppercase text-slate-800">HR</p>
                  <Button type="button" onClick={() => saveHrNotesMutation.mutate()} disabled={!isHrNotesDirty || saveHrNotesMutation.isPending}>
                    {saveHrNotesMutation.isPending ? "Saving..." : "Save HR"}
                  </Button>
                </div>
                <div className="flex min-h-10 items-end gap-5 overflow-x-auto border-b border-slate-200">
                  {([
                    { id: "general" as const, label: "General" },
                    { id: "status" as const, label: "Status" },
                    { id: "pay" as const, label: "Pay" },
                    { id: "notes" as const, label: "Notes" },
                  ]).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={cn(
                        "border-b-2 pb-2 text-sm font-medium uppercase",
                        hrNotesTab === tab.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-900",
                      )}
                      onClick={() => setHrNotesTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* HR > General */}
                {hrNotesTab === "general" ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase text-slate-800">General</h3>
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
                      <div className="space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Employee</p>
                          <div className="mt-2 grid grid-cols-4 gap-3 text-sm">
                            <div><p className="text-xs font-semibold text-slate-600">Employee #</p><p className="tabular-nums font-medium text-slate-900">{data.id}</p></div>
                            <div><p className="text-xs font-semibold text-slate-600">First</p><p className="font-medium text-slate-900">{firstName || "-"}</p></div>
                            <div><p className="text-xs font-semibold text-slate-600">Middle</p><p className="font-medium text-slate-900">{editMeta.middleName || "-"}</p></div>
                            <div><p className="text-xs font-semibold text-slate-600">Last</p><p className="font-medium text-slate-900">{lastName || "-"}</p></div>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Alias</Label><Input className="mt-1 h-9" value={hrInline.alias} onChange={(e) => setHrInline((p) => ({ ...p, alias: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Salutation</Label><Input className="mt-1 h-9" value={hrInline.salutation} onChange={(e) => setHrInline((p) => ({ ...p, salutation: e.target.value }))} /></div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Address</p>
                          <p className="mt-1 text-sm text-slate-900">{editMeta.address1 || "-"}</p>
                          <p className="text-sm text-slate-900">{editMeta.address2 || "-"}</p>
                          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                            <p><span className="font-semibold text-slate-700">City:</span> {editMeta.city || "-"}</p>
                            <p><span className="font-semibold text-slate-700">State:</span> {editMeta.state || "-"}</p>
                            <p><span className="font-semibold text-slate-700">ZIP:</span> {editMeta.zip || "-"}</p>
                          </div>
                          <p className="mt-1 text-sm"><span className="font-semibold text-slate-700">Country:</span> {editMeta.country || "-"}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Home</Label><Input className="mt-1 h-9" value={hrInline.homePhone} onChange={(e) => setHrInline((p) => ({ ...p, homePhone: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Work</Label><Input className="mt-1 h-9" value={editMeta.workPhone || ""} readOnly /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Cell/Pager</Label><Input className="mt-1 h-9" value={phone || ""} readOnly /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Fax</Label><Input className="mt-1 h-9" value={hrInline.fax} onChange={(e) => setHrInline((p) => ({ ...p, fax: e.target.value }))} /></div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Personal</p>
                          <div className="mt-2 grid gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2"><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">SSN</Label><Input className="mt-1 h-9" value={hrInline.ssn} onChange={(e) => setHrInline((p) => ({ ...p, ssn: e.target.value }))} /></div>
                            <div className="sm:col-span-2"><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Driver License #</Label><Input className="mt-1 h-9" value={hrInline.driverLicense} onChange={(e) => setHrInline((p) => ({ ...p, driverLicense: e.target.value }))} /></div>
                            <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Birthdate</Label><Input type="date" className="mt-1 h-9" value={hrInline.birthdate} onChange={(e) => setHrInline((p) => ({ ...p, birthdate: e.target.value }))} /></div>
                            <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Age</Label><Input className="mt-1 h-9" value={hrInline.age} onChange={(e) => setHrInline((p) => ({ ...p, age: e.target.value }))} /></div>
                            <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Race</Label><Input className="mt-1 h-9" value={hrInline.race} onChange={(e) => setHrInline((p) => ({ ...p, race: e.target.value }))} /></div>
                            <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Gender</Label><Input className="mt-1 h-9" value={hrInline.gender} onChange={(e) => setHrInline((p) => ({ ...p, gender: e.target.value }))} /></div>
                            <div className="sm:col-span-2"><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Marital</Label><Input className="mt-1 h-9" value={hrInline.marital} onChange={(e) => setHrInline((p) => ({ ...p, marital: e.target.value }))} /></div>
                            <div className="sm:col-span-2 grid grid-cols-2 gap-3 pt-1">
                              <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800"><input type="checkbox" checked={hrInline.disabled} onChange={(e) => setHrInline((p) => ({ ...p, disabled: e.target.checked }))} />Disabled</label>
                              <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800"><input type="checkbox" checked={hrInline.smoker} onChange={(e) => setHrInline((p) => ({ ...p, smoker: e.target.checked }))} />Smoker</label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Textarea className="min-h-32 text-sm" value={hrNotes.general} onChange={(e) => setHrNotes((p) => ({ ...p, general: e.target.value }))} placeholder="General HR notes..." />
                  </section>
                ) : null}

                {/* HR > Status */}
                {hrNotesTab === "status" ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase text-slate-800">Status</h3>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Hire &amp; Seniority</p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Original Hire</Label><Input className="mt-1 h-9" value={editMeta.employmentStartDate || ""} readOnly /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Last Hired</Label><Input className="mt-1 h-9" value={editMeta.projectStartDate || editMeta.employmentStartDate || ""} readOnly /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Adjusted Seniority</Label><Input className="mt-1 h-9" value={editMeta.employmentStartDate || ""} readOnly /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tenure</Label><Input className="mt-1 h-9" value={seniorityYears} readOnly /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Recruiter</Label><Input className="mt-1 h-9" value={editMeta.bdm || ""} readOnly /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Source</Label><Input className="mt-1 h-9" value={editMeta.source || ""} readOnly /></div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Military Experience</p>
                        <div className="mt-2 grid gap-2">
                          <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-2 text-sm"><input type="checkbox" checked={hrInline.militaryVeteran} onChange={(e) => setHrInline((p) => ({ ...p, militaryVeteran: e.target.checked }))} />Military Veteran</label>
                          <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-2 text-sm"><input type="checkbox" checked={hrInline.specialDisabledVeteran} onChange={(e) => setHrInline((p) => ({ ...p, specialDisabledVeteran: e.target.checked }))} />Special Disabled Veteran</label>
                          <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-2 text-sm"><input type="checkbox" checked={hrInline.vietnamEraVeteran} onChange={(e) => setHrInline((p) => ({ ...p, vietnamEraVeteran: e.target.checked }))} />Vietnam Era Veteran</label>
                          <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-2 text-sm"><input type="checkbox" checked={hrInline.otherProtectedVeteran} onChange={(e) => setHrInline((p) => ({ ...p, otherProtectedVeteran: e.target.checked }))} />Other Protected Veteran</label>
                          <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-2 text-sm"><input type="checkbox" checked={hrInline.nationalGuard} onChange={(e) => setHrInline((p) => ({ ...p, nationalGuard: e.target.checked }))} />National Guard</label>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Military Separation Date</Label><Input className="mt-1 h-9" value={hrInline.milSepDate} onChange={(e) => setHrInline((p) => ({ ...p, milSepDate: e.target.value }))} /></div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Citizenship</p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">I-9 Verified</Label><Input className="mt-1 h-9" value={hrInline.i9Verified} onChange={(e) => setHrInline((p) => ({ ...p, i9Verified: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Renew Date</Label><Input className="mt-1 h-9" value={hrInline.renewDate} onChange={(e) => setHrInline((p) => ({ ...p, renewDate: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Citizen Of</Label><Input className="mt-1 h-9" value={editMeta.country || ""} readOnly /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Visa #</Label><Input className="mt-1 h-9" value={hrInline.visa} onChange={(e) => setHrInline((p) => ({ ...p, visa: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Visa Expiry</Label><Input className="mt-1 h-9" value={hrInline.visaExp} onChange={(e) => setHrInline((p) => ({ ...p, visaExp: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Passport</Label><Input className="mt-1 h-9" value={hrInline.passport} onChange={(e) => setHrInline((p) => ({ ...p, passport: e.target.value }))} /></div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Miscellaneous</p>
                        <div className="mt-2 grid gap-3">
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Receipt #</Label><Input className="mt-1 h-9" value={hrInline.receiptNumber} onChange={(e) => setHrInline((p) => ({ ...p, receiptNumber: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Valid From</Label><Input className="mt-1 h-9" value={hrInline.validFrom} onChange={(e) => setHrInline((p) => ({ ...p, validFrom: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Type Of H1</Label><Input className="mt-1 h-9" value={hrInline.typeOfH1} onChange={(e) => setHrInline((p) => ({ ...p, typeOfH1: e.target.value }))} /></div>
                        </div>
                      </div>
                    </div>
                    <Textarea className="min-h-32 text-sm" value={hrNotes.status} onChange={(e) => setHrNotes((p) => ({ ...p, status: e.target.value }))} placeholder="Status notes..." />
                  </section>
                ) : null}

                {/* HR > Pay */}
                {hrNotesTab === "pay" ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase text-slate-800">Pay</h3>
                    <div className="grid gap-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Compensation Snapshot</p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-3">
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Pay</Label><Input className="mt-1 h-9" value={hrInline.payCurrent} onChange={(e) => setHrInline((p) => ({ ...p, payCurrent: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Annual</Label><Input className="mt-1 h-9" value={hrInline.payAnnual} onChange={(e) => setHrInline((p) => ({ ...p, payAnnual: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Compa</Label><Input className="mt-1 h-9" value={hrInline.payCompa} onChange={(e) => setHrInline((p) => ({ ...p, payCompa: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Last Pay</Label><Input className="mt-1 h-9" value={hrInline.payLast} onChange={(e) => setHrInline((p) => ({ ...p, payLast: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Last Annual</Label><Input className="mt-1 h-9" value={hrInline.payLastAnnual} onChange={(e) => setHrInline((p) => ({ ...p, payLastAnnual: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">As Of</Label><Input className="mt-1 h-9" value={hrInline.payAsOf} onChange={(e) => setHrInline((p) => ({ ...p, payAsOf: e.target.value }))} /></div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Change Metrics</p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-4">
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Diff</Label><Input className="mt-1 h-9" value={hrInline.payDiff} onChange={(e) => setHrInline((p) => ({ ...p, payDiff: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Days</Label><Input className="mt-1 h-9" value={hrInline.payDiffDays} onChange={(e) => setHrInline((p) => ({ ...p, payDiffDays: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Diff $</Label><Input className="mt-1 h-9" value={hrInline.payDiffDollar} onChange={(e) => setHrInline((p) => ({ ...p, payDiffDollar: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">% Change</Label><Input className="mt-1 h-9" value={hrInline.payPctChange} onChange={(e) => setHrInline((p) => ({ ...p, payPctChange: e.target.value }))} /></div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Rate &amp; Period</p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-4">
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Pay Frequency</Label><Input className="mt-1 h-9" value={hrInline.payFrequency} onChange={(e) => setHrInline((p) => ({ ...p, payFrequency: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Units / Period</Label><Input className="mt-1 h-9" value={hrInline.unitsPerPeriod} onChange={(e) => setHrInline((p) => ({ ...p, unitsPerPeriod: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Unit Rate</Label><Input className="mt-1 h-9" value={hrInline.unitRate} onChange={(e) => setHrInline((p) => ({ ...p, unitRate: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Period Total</Label><Input className="mt-1 h-9" value={hrInline.periodTotal} onChange={(e) => setHrInline((p) => ({ ...p, periodTotal: e.target.value }))} /></div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Bonus &amp; LCA</p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-4">
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Bonus Type</Label><Input className="mt-1 h-9" value={hrInline.bonusType} onChange={(e) => setHrInline((p) => ({ ...p, bonusType: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</Label><Input className="mt-1 h-9" value={hrInline.bonusAmount} onChange={(e) => setHrInline((p) => ({ ...p, bonusAmount: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Shift</Label><Input className="mt-1 h-9" value={hrInline.shift} onChange={(e) => setHrInline((p) => ({ ...p, shift: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Premium</Label><Input className="mt-1 h-9" value={hrInline.premium} onChange={(e) => setHrInline((p) => ({ ...p, premium: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">LCA County</Label><Input className="mt-1 h-9" value={hrInline.lcaCounty} onChange={(e) => setHrInline((p) => ({ ...p, lcaCounty: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">LCA Pay</Label><Input className="mt-1 h-9" value={hrInline.lcaPay} onChange={(e) => setHrInline((p) => ({ ...p, lcaPay: e.target.value }))} /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">LCA State</Label><Input className="mt-1 h-9" value={editMeta.state || ""} readOnly /></div>
                          <div><Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">LCA Job #</Label><Input className="mt-1 h-9" value={hrInline.lcaJob} onChange={(e) => setHrInline((p) => ({ ...p, lcaJob: e.target.value }))} /></div>
                        </div>
                      </div>
                    </div>
                    <Textarea className="min-h-32 text-sm" value={hrNotes.pay} onChange={(e) => setHrNotes((p) => ({ ...p, pay: e.target.value }))} placeholder="Pay notes..." />
                  </section>
                ) : null}

                {/* HR > Notes */}
                {hrNotesTab === "notes" ? (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase text-slate-800">Notes</h3>
                    <Textarea className="min-h-44 text-sm" value={hrNotes.notes} onChange={(e) => setHrNotes((p) => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." />
                  </section>
                ) : null}
              </div>
            </Card>
          ) : null}

          {/* ====================== EDIT TAB ====================== */}
          {activeTab === "edit" ? (
            <Card className="overflow-hidden p-0">
              <form className="space-y-4 p-4" onSubmit={onSubmit}>
                <section className={sectionClass}>
                  <div className={sectionTitleClass}>Candidate</div>
                  <div className={sectionBodyClass}>
                    <div className={rowClass}><Label>First Name</Label><Input className={LINE_INPUT_CLASS} value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
                    <div className={rowClass}><Label>Middle Name</Label><Input className={LINE_INPUT_CLASS} value={editMeta.middleName} onChange={(e) => setMetaField("middleName", e.target.value)} /></div>
                    <div className={rowClass}><Label>Last Name</Label><Input className={LINE_INPUT_CLASS} value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
                    <div className={rowClass}>
                      <Label>Status</Label>
                      <Select className={LINE_INPUT_CLASS} value={editMeta.status} onChange={(e) => setMetaField("status", e.target.value)}>
                        {candidateStatusOptions.map((opt) => <option key={opt} value={opt}>{toTitleCase(opt.replace(/_/g, " "))}</option>)}
                      </Select>
                    </div>
                    <div className={rowClass}>
                      <Label>Group (BU)</Label>
                      <Select className={LINE_INPUT_CLASS} value={editMeta.groupBu} onChange={(e) => setMetaField("groupBu", e.target.value)}>
                        <option value="">{groupBuOptions.length > 0 ? "Select Group (BU)" : "No Group (BU) configured"}</option>
                        {groupBuOptions.map((opt) => <option key={opt} value={opt}>{toTitleCase(opt.replace(/_/g, " "))}</option>)}
                      </Select>
                    </div>
                    <div className={rowClass}><Label>BDM</Label><Input className={LINE_INPUT_CLASS} value={editMeta.bdm} onChange={(e) => setMetaField("bdm", e.target.value)} /></div>
                    <div className={rowClass}><Label>Role</Label><Input className={LINE_INPUT_CLASS} value={editMeta.role} onChange={(e) => setMetaField("role", e.target.value)} /></div>
                    <div className={rowClass}><Label>Current Company</Label><Input className={LINE_INPUT_CLASS} value={company} onChange={(e) => setCompany(e.target.value)} /></div>
                    <div className={rowClass}>
                      <Label>Employee Type</Label>
                      <Select className={LINE_INPUT_CLASS} value={editMeta.employeeType} onChange={(e) => setMetaField("employeeType", e.target.value)}>
                        {candidateEmployeeTypeOptions.map((opt) => <option key={opt} value={opt}>{toTitleCase(opt.replace(/_/g, " "))}</option>)}
                      </Select>
                    </div>
                    <div className={rowClass}>
                      <Label>Source</Label>
                      <Select className={LINE_INPUT_CLASS} value={editMeta.source} onChange={(e) => setMetaField("source", e.target.value)}>
                        {candidateSourceOptions.map((opt) => <option key={opt} value={opt}>{toTitleCase(opt.replace(/_/g, " "))}</option>)}
                      </Select>
                    </div>
                    <div className={rowClass}><Label>Referred By</Label><Input className={LINE_INPUT_CLASS} value={editMeta.referredBy} onChange={(e) => setMetaField("referredBy", e.target.value)} /></div>
                    <div className={rowClass}><Label>Referred By (Other)</Label><Input className={LINE_INPUT_CLASS} value={editMeta.referredByOther} onChange={(e) => setMetaField("referredByOther", e.target.value)} /></div>
                    <div className={rowClass}><Label>Ownership</Label><Input className={LINE_INPUT_CLASS} value={editMeta.ownership} onChange={(e) => setMetaField("ownership", e.target.value)} /></div>
                  </div>
                </section>

                <section className={sectionClass}>
                  <div className={sectionTitleClass}>Contact Information</div>
                  <div className={sectionBodyClass}>
                    <div className={rowClass}><Label>Email 1</Label><Input className={LINE_INPUT_CLASS} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                    <div className={rowClass}><Label>Email 2</Label><Input className={LINE_INPUT_CLASS} type="email" value={editMeta.email2} onChange={(e) => setMetaField("email2", e.target.value)} /></div>
                    <div className={rowClass}><Label>Primary Phone</Label><Input className={LINE_INPUT_CLASS} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                    <div className={rowClass}><Label>Work Phone</Label><Input className={LINE_INPUT_CLASS} value={editMeta.workPhone} onChange={(e) => setMetaField("workPhone", e.target.value)} /></div>
                    <div className={rowClass}><Label>Mobile Phone</Label><Input className={LINE_INPUT_CLASS} value={editMeta.mobilePhone} onChange={(e) => setMetaField("mobilePhone", e.target.value)} /></div>
                    <div className={rowClass}><Label>Other Phone</Label><Input className={LINE_INPUT_CLASS} value={editMeta.otherPhone} onChange={(e) => setMetaField("otherPhone", e.target.value)} /></div>
                    <div className={rowClass}>
                      <Label>Address</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input className={LINE_INPUT_CLASS} placeholder="Address" value={editMeta.address1} onChange={(e) => setMetaField("address1", e.target.value)} />
                        <Input className={LINE_INPUT_CLASS} placeholder="Address2" value={editMeta.address2} onChange={(e) => setMetaField("address2", e.target.value)} />
                        <Input className={LINE_INPUT_CLASS} placeholder="City" value={editMeta.city} onChange={(e) => setMetaField("city", e.target.value)} />
                        <Input className={LINE_INPUT_CLASS} placeholder="State" value={editMeta.state} onChange={(e) => setMetaField("state", e.target.value)} />
                        <Input className={LINE_INPUT_CLASS} placeholder="Zip" value={editMeta.zip} onChange={(e) => setMetaField("zip", e.target.value)} />
                        <Input className={LINE_INPUT_CLASS} placeholder="Country" value={editMeta.country} onChange={(e) => setMetaField("country", e.target.value)} />
                      </div>
                    </div>
                  </div>
                </section>

                <section className={sectionClass}>
                  <div className={sectionTitleClass}>Comments</div>
                  <div className={sectionBodyClass}>
                    <div className={rowClass}><Label>Employment Preference</Label><Input className={LINE_INPUT_CLASS} value={editMeta.employmentPreference} onChange={(e) => setMetaField("employmentPreference", e.target.value)} /></div>
                    <div className={rowClass}><Label>Base Salary</Label><Input className={LINE_INPUT_CLASS} value={editMeta.baseSalary} onChange={(e) => setMetaField("baseSalary", e.target.value)} placeholder="USD / INR" /></div>
                    <div className={rowClass}><Label>Desired Salary</Label><Input className={LINE_INPUT_CLASS} value={editMeta.desiredSalary} onChange={(e) => setMetaField("desiredSalary", e.target.value)} placeholder="USD / INR" /></div>
                    <div className={rowClass}><Label>Current Pay Rate</Label><Input className={LINE_INPUT_CLASS} value={editMeta.currentPayRate} onChange={(e) => setMetaField("currentPayRate", e.target.value)} placeholder="USD / INR" /></div>
                    <div className={rowClass}><Label>Desired Pay Rate</Label><Input className={LINE_INPUT_CLASS} value={editMeta.desiredPayRate} onChange={(e) => setMetaField("desiredPayRate", e.target.value)} placeholder="USD / INR" /></div>
                    <div className={rowClass}><Label>Employment Start Date</Label><Input className={LINE_INPUT_CLASS} type="date" value={editMeta.employmentStartDate} onChange={(e) => setMetaField("employmentStartDate", e.target.value)} /></div>
                    <div className={rowClass}><Label>Project Start Date</Label><Input className={LINE_INPUT_CLASS} type="date" value={editMeta.projectStartDate} onChange={(e) => setMetaField("projectStartDate", e.target.value)} /></div>
                    <div className={rowClass}><Label>Desired Locations</Label><Input className={LINE_INPUT_CLASS} value={editMeta.desiredLocations} onChange={(e) => setMetaField("desiredLocations", e.target.value)} /></div>
                    <div className={rowClass}>
                      <Label>Willing to Relocate</Label>
                      <div className="flex items-center gap-4 text-sm">
                        <label className="inline-flex items-center gap-1"><input type="radio" name="willing_to_relocate" checked={editMeta.willingToRelocate === "no"} onChange={() => setMetaField("willingToRelocate", "no")} />No</label>
                        <label className="inline-flex items-center gap-1"><input type="radio" name="willing_to_relocate" checked={editMeta.willingToRelocate === "yes"} onChange={() => setMetaField("willingToRelocate", "yes")} />Yes</label>
                      </div>
                    </div>
                    <div className={rowClass}>
                      <Label>Comments</Label>
                      <Textarea className="min-h-20 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 py-1 shadow-none focus-visible:ring-0" value={editMeta.comments} onChange={(e) => setMetaField("comments", e.target.value)} />
                    </div>
                  </div>
                </section>

                <section className={sectionClass}>
                  <div className={sectionTitleClass}>Category &amp; Skills</div>
                  <div className={sectionBodyClass}>
                    <div className={rowClass}><Label>Category</Label><Input className={LINE_INPUT_CLASS} value={editMeta.category} onChange={(e) => setMetaField("category", e.target.value)} /></div>
                    <div className={rowClass}><Label>Skills</Label><Input className={LINE_INPUT_CLASS} value={editMeta.skills} onChange={(e) => setMetaField("skills", e.target.value)} /></div>
                    <div className={rowClass}><Label>Industry</Label><Input className={LINE_INPUT_CLASS} value={editMeta.industry} onChange={(e) => setMetaField("industry", e.target.value)} /></div>
                    <div className={rowClass}>
                      <Label>Resume</Label>
                      <Textarea className="min-h-44 text-sm" value={editMeta.resumeText} onChange={(e) => setMetaField("resumeText", e.target.value)} placeholder="Resume notes / parsed resume text..." />
                    </div>
                  </div>
                </section>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  {data.deleted_at ? (
                    <Button type="button" variant="secondary" onClick={() => restoreMutation.mutate()} disabled={restoreMutation.isPending}>Restore</Button>
                  ) : null}
                </div>
              </form>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
