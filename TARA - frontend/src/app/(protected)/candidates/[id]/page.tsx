"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import { deleteCandidate, getCandidate, restoreCandidate, updateCandidate } from "@/lib/services/candidates";
import { getResumeContent, getResumePreviewText, listResumes } from "@/lib/services/resumes";
import { cn } from "@/lib/utils/cn";
import { LINE_INPUT_CLASS } from "@/lib/utils/table-styles";

type CandidateTabId =
  | "details"
  | "edit"
  | "resume"
  | "notes"
  | "experience"
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

const EMPTY_EDIT_META: CandidateEditMeta = {
  middleName: "",
  status: "active",
  groupBu: "",
  bdm: "",
  role: "",
  employeeType: "w2_h1b",
  source: "manual",
  referredBy: "",
  referredByOther: "",
  ownership: "",
  email2: "",
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
  resumeText: "",
};

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const parsedCandidateId = Number(id);
  const hasValidId = Number.isInteger(parsedCandidateId) && parsedCandidateId > 0;
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [editMeta, setEditMeta] = useState<CandidateEditMeta>(EMPTY_EDIT_META);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CandidateTabId>("details");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.candidates.detail(id),
    queryFn: () => getCandidate(id, true),
    enabled: hasValidId,
  });

  const { data: resumesData, isLoading: resumesLoading } = useQuery({
    queryKey: queryKeys.candidates.resumes(id),
    queryFn: () => listResumes(id, { page: 1, pageSize: 20 }),
    enabled: hasValidId,
  });

  useEffect(() => {
    if (!data) return;
    setFirstName(data.first_name);
    setLastName(data.last_name);
    setEmail(data.email ?? "");
    setPhone(data.phone ?? "");
    setCompany(data.current_company ?? "");
    setEditMeta((prev) => ({
      ...prev,
      ownership: data.owner_user_id ? String(data.owner_user_id) : "",
      mobilePhone: data.phone ?? "",
      status: data.deleted_at ? "deleted" : "active",
    }));
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateCandidate(id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email || undefined,
        phone: phone || undefined,
        current_company: company || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to update candidate")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCandidate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to delete candidate")),
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreCandidate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to restore candidate")),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("First Name and Last Name are required");
      return;
    }
    updateMutation.mutate();
  };

  const rowClass = "grid gap-2 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center";
  const sectionClass = "overflow-hidden rounded border border-slate-200 bg-white";
  const sectionTitleClass = "border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900";
  const sectionBodyClass = "space-y-3 px-3 py-3";
  const setMetaField = <K extends keyof CandidateEditMeta>(key: K, value: CandidateEditMeta[K]) =>
    setEditMeta((prev) => ({ ...prev, [key]: value }));

  const tabs = useMemo(
    () => [
      { id: "details" as const, label: "Details" },
      { id: "edit" as const, label: "Edit" },
      { id: "resume" as const, label: "Resume" },
      { id: "notes" as const, label: "Notes" },
      { id: "experience" as const, label: "Exp" },
      { id: "files" as const, label: "Files" },
      { id: "hr_notes" as const, label: "HR Notes" },
    ],
    [],
  );

  const statusLabel = data?.deleted_at ? "Deleted" : "Active";
  const fullName = `${firstName} ${lastName}`.trim();
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
      resumeBlob.text().then((text) => setResumePreviewText(text)).catch(() => {
        setResumePreviewText("Unable to load text preview.");
      });
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

  if (!hasValidId) {
    return <ErrorBanner message="Invalid candidate id." />;
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      {isLoading ? (
        <Card>
          <p className="text-sm text-slate-600">Loading candidate details...</p>
        </Card>
      ) : null}

      {data ? (
        <>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UserRound className="size-5 text-emerald-600" />
                  <p className="text-3xl font-semibold tabular-nums text-slate-900">{data.id}</p>
                  <p className="text-2xl text-slate-500">|</p>
                  <p className="text-balance text-4xl font-semibold leading-none text-slate-900">{fullName || "-"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip value={statusLabel} />
                  <Link
                    href={`/candidates/${id}/resumes`}
                    className="inline-flex items-center rounded-md bg-ocean px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
                  >
                    Actions
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 px-4">
              <div className="flex min-h-11 items-end gap-5 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={cn(
                      "border-b-2 pb-2 text-sm font-medium uppercase",
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

            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <div className="grid grid-cols-5 gap-2">
                {["Tasks", "Submissions", "Client Submissions", "Interviews", "Placements"].map((label) => (
                  <div key={label} className="rounded border border-slate-200 bg-white px-2 py-2 text-center">
                    <p className="tabular-nums text-2xl font-semibold leading-none text-slate-700">0</p>
                    <p className="mt-1 text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {activeTab === "details" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <Card className="overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-slate-600" />
                    <p className="text-base font-semibold text-slate-900">Resume</p>
                  </div>
                  {latestResume ? (
                    <p className="text-xs text-slate-500">{latestResume.file_name}</p>
                  ) : null}
                </div>

                <div className="max-h-[72dvh] overflow-auto bg-slate-50 px-4 py-4">
                  {resumesLoading ? (
                    <p className="text-sm text-slate-600">Loading resumes...</p>
                  ) : null}

                  {!resumesLoading && !latestResume ? (
                    <div className="rounded border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-700">No resume uploaded for this candidate yet.</p>
                      <div className="mt-3">
                        <Link
                          href={`/candidates/${id}/resumes`}
                          className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                        >
                          Upload Resume
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
                          <p>Size: {latestResume.size_bytes}</p>
                          <p className="inline-flex items-center gap-1">
                            Parse:
                            <StatusChip value={latestResume.parse_status} />
                          </p>
                        </div>
                        <div className="mt-3">
                          <Link
                            href={`/candidates/${id}/resumes`}
                            className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                          >
                            Open Resume Manager
                          </Link>
                        </div>
                      </div>

                      <div className="rounded border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">Preview</p>
                        {resumeContentLoading ? (
                          <p className="mt-2 text-sm text-slate-600">Loading resume preview...</p>
                        ) : null}

                        {!resumeContentLoading && resumePreviewTextLoading ? (
                          <p className="mt-2 text-sm text-slate-600">Extracting resume text preview...</p>
                        ) : null}

                        {!resumeContentLoading && resumePreviewUrl ? (
                          <iframe
                            title={`Resume preview for ${fullName || "candidate"}`}
                            src={resumePreviewUrl}
                            className="mt-2 h-[56dvh] w-full rounded border border-slate-200 bg-white"
                          />
                        ) : null}

                        {!resumeContentLoading && !resumePreviewUrl && resumePreviewText ? (
                          <pre className="mt-2 max-h-[56dvh] overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                            {resumePreviewText}
                          </pre>
                        ) : null}

                        {!resumeContentLoading && !resumePreviewUrl && !resumePreviewText && resumePreviewTextData?.text ? (
                          <pre className="mt-2 max-h-[56dvh] overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                            {resumePreviewTextData.text}
                          </pre>
                        ) : null}

                        {!resumeContentLoading && !resumePreviewTextLoading && !resumePreviewUrl && !resumePreviewText && !resumePreviewTextData?.text ? (
                          <div className="mt-2 space-y-2 text-sm text-slate-700">
                            <p>
                              Inline preview is not supported for this file type ({latestResume.content_type}).
                            </p>
                            <p>Use Resume Manager to download/open the file.</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>

              <div className="space-y-4">
                <Card className="space-y-3">
                  <p className="text-base font-semibold text-slate-900">Open Submissions</p>
                  <p className="text-sm text-slate-600">No open submissions for this candidate yet.</p>
                  <Button type="button" variant="ghost" className="w-full">Add Submission +</Button>
                </Card>

                <Card className="overflow-hidden p-0">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-base font-semibold text-slate-900">Detail</p>
                  </div>
                  <div className="grid gap-0 text-sm">
                    <div className="grid grid-cols-2 border-b border-slate-200 px-4 py-2"><span className="text-slate-700">First Name</span><span className="text-slate-900">{data.first_name}</span></div>
                    <div className="grid grid-cols-2 border-b border-slate-200 px-4 py-2"><span className="text-slate-700">Last Name</span><span className="text-slate-900">{data.last_name}</span></div>
                    <div className="grid grid-cols-2 border-b border-slate-200 px-4 py-2"><span className="text-slate-700">Email 1</span><span className="break-all text-sky-700">{data.email || "-"}</span></div>
                    <div className="grid grid-cols-2 border-b border-slate-200 px-4 py-2"><span className="text-slate-700">Primary Phone</span><span className="text-slate-900">{data.phone || "-"}</span></div>
                    <div className="grid grid-cols-2 border-b border-slate-200 px-4 py-2"><span className="text-slate-700">Current Company</span><span className="text-slate-900">{data.current_company || "-"}</span></div>
                    <div className="grid grid-cols-2 border-b border-slate-200 px-4 py-2"><span className="text-slate-700">Dedupe Fingerprint</span><span className="break-all text-slate-900">{data.dedupe_fingerprint || "-"}</span></div>
                    <div className="grid grid-cols-2 px-4 py-2"><span className="text-slate-700">Owner</span><span className="tabular-nums text-slate-900">{data.owner_user_id}</span></div>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {activeTab === "resume" ? (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-base font-semibold text-slate-900">Resume Files</p>
              </div>
              <div className="overflow-x-auto px-4 py-3">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="px-2 py-2">File</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Size</th>
                      <th className="px-2 py-2">Parse Status</th>
                      <th className="px-2 py-2">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumesLoading ? (
                      <tr><td className="px-2 py-3 text-slate-600" colSpan={5}>Loading...</td></tr>
                    ) : null}

                    {!resumesLoading && (resumesData?.items?.length ?? 0) === 0 ? (
                      <tr><td className="px-2 py-3 text-slate-600" colSpan={5}>No resumes found.</td></tr>
                    ) : null}

                    {(resumesData?.items ?? []).map((resume) => (
                      <tr key={resume.id} className="border-b border-slate-100">
                        <td className="px-2 py-2 text-slate-900">{resume.file_name}</td>
                        <td className="px-2 py-2 text-slate-700">{resume.content_type}</td>
                        <td className="px-2 py-2 tabular-nums text-slate-700">{resume.size_bytes}</td>
                        <td className="px-2 py-2"><StatusChip value={resume.parse_status} /></td>
                        <td className="px-2 py-2 text-slate-700">{resume.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3">
                  <Link
                    href={`/candidates/${id}/resumes`}
                    className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    Open Resume Manager
                  </Link>
                </div>
              </div>
            </Card>
          ) : null}

          {activeTab === "notes" ? (
            <Card>
              <p className="text-sm text-slate-600">No notes added yet.</p>
            </Card>
          ) : null}

          {activeTab === "experience" ? (
            <Card>
              <p className="text-sm text-slate-600">Experience timeline is not configured yet.</p>
            </Card>
          ) : null}

          {activeTab === "files" ? (
            <Card>
              <p className="text-sm text-slate-600">Files section is not configured yet.</p>
            </Card>
          ) : null}

          {activeTab === "hr_notes" ? (
            <Card>
              <p className="text-sm text-slate-600">HR Notes section is not configured yet.</p>
            </Card>
          ) : null}

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
                        <option value="active">Active</option>
                        <option value="employee">Employee</option>
                        <option value="on_hold">On Hold</option>
                        <option value="deleted">Deleted</option>
                      </Select>
                    </div>
                    <div className={rowClass}><Label>Group (BU)</Label><Input className={LINE_INPUT_CLASS} value={editMeta.groupBu} onChange={(e) => setMetaField("groupBu", e.target.value)} /></div>
                    <div className={rowClass}><Label>BDM</Label><Input className={LINE_INPUT_CLASS} value={editMeta.bdm} onChange={(e) => setMetaField("bdm", e.target.value)} /></div>
                    <div className={rowClass}><Label>Role</Label><Input className={LINE_INPUT_CLASS} value={editMeta.role} onChange={(e) => setMetaField("role", e.target.value)} /></div>
                    <div className={rowClass}><Label>Current Company</Label><Input className={LINE_INPUT_CLASS} value={company} onChange={(e) => setCompany(e.target.value)} /></div>
                    <div className={rowClass}>
                      <Label>Employee Type</Label>
                      <Select className={LINE_INPUT_CLASS} value={editMeta.employeeType} onChange={(e) => setMetaField("employeeType", e.target.value)}>
                        <option value="w2_h1b">W2 - H1B</option>
                        <option value="w2_usc">W2 - USC</option>
                        <option value="1099">1099</option>
                        <option value="corp_to_corp">Corp to Corp</option>
                      </Select>
                    </div>
                    <div className={rowClass}>
                      <Label>Source</Label>
                      <Select className={LINE_INPUT_CLASS} value={editMeta.source} onChange={(e) => setMetaField("source", e.target.value)}>
                        <option value="manual">Manual</option>
                        <option value="referral">Referral</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="portal">Portal</option>
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
                        <label className="inline-flex items-center gap-1">
                          <input type="radio" name="willing_to_relocate" checked={editMeta.willingToRelocate === "no"} onChange={() => setMetaField("willingToRelocate", "no")} />
                          No
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <input type="radio" name="willing_to_relocate" checked={editMeta.willingToRelocate === "yes"} onChange={() => setMetaField("willingToRelocate", "yes")} />
                          Yes
                        </label>
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
                    <Button type="button" variant="secondary" onClick={() => restoreMutation.mutate()}>
                      Restore
                    </Button>
                  ) : (
                    <Button type="button" variant="danger" onClick={() => deleteMutation.mutate()}>
                      Delete
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
