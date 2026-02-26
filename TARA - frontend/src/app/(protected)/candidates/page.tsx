"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Binoculars, FileText, UserRound, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { ListPageShell } from "@/components/common/list-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useListPage } from "@/hooks/use-list-page";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/query-keys";
import { createCandidate, deleteCandidate, getCandidate, listCandidates, restoreCandidate } from "@/lib/services/candidates";
import { listClients } from "@/lib/services/clients";
import { extractResumePreview, uploadResume } from "@/lib/services/resumes";
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

export default function CandidatesPage() {
  const queryClient = useQueryClient();
  const list = useListPage();
  const session = useAuthStore((state) => state.session);

  const [form, setForm] = useState<CandidateForm>({ ...EMPTY_CANDIDATE_FORM });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [extractMessage, setExtractMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewCandidateId, setPreviewCandidateId] = useState<number | null>(null);
  const [previewTab, setPreviewTab] = useState<CandidatePreviewTab>("details");

  const ownerName = useMemo(() => {
    const full = `${session?.user?.first_name ?? ""} ${session?.user?.last_name ?? ""}`.trim();
    if (full) return full;
    const prefix = session?.user?.email?.split("@")[0] ?? "Current User";
    return toTitleCase(prefix);
  }, [session]);

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
      const haystack = `${item.id} ${item.first_name} ${item.last_name} ${item.email ?? ""} ${item.phone ?? ""} ${item.current_company ?? ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [data?.items, list.normalizedSearch]);

  useEffect(() => {
    if (previewCandidateId === null) return;
    if (candidateItems.some((item) => item.id === previewCandidateId)) return;
    setPreviewCandidateId(null);
    setPreviewTab("details");
  }, [candidateItems, previewCandidateId]);

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

  const previewStatusLabel = previewCandidate?.deleted_at ? "Deleted" : "Active";

  const pagination = list.getPagination(data?.total ?? 0);
  const selection = list.getSelectionHelpers(candidateItems);

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

  const deleteMutation = useMutation({
    mutationFn: deleteCandidate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all }),
    onError: (err) => setError(getApiErrorMessage(err, "Failed to delete candidate")),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreCandidate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all }),
    onError: (err) => setError(getApiErrorMessage(err, "Failed to restore candidate")),
  });

  const resetCreateForm = () => {
    setForm({ ...EMPTY_CANDIDATE_FORM });
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

  const createFormContent = (
    <div className="overflow-hidden rounded border border-slate-200 bg-white">
      <form className="grid xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]" onSubmit={onCreate}>
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
                  <label className={labelClass}>
                    First Name <span className="text-red-600">*</span>
                  </label>
                  <Input className={LINE_INPUT_CLASS} value={form.firstName} onChange={(e) => onChangeField("firstName", e.target.value)} required />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Middle Name</label>
                  <Input className={LINE_INPUT_CLASS} value={form.middleName} onChange={(e) => onChangeField("middleName", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>
                    Last Name <span className="text-red-600">*</span>
                  </label>
                  <Input className={LINE_INPUT_CLASS} value={form.lastName} onChange={(e) => onChangeField("lastName", e.target.value)} required />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>
                    Status <span className="text-red-600">*</span>
                  </label>
                  <Select className={LINE_INPUT_CLASS} value={form.status} onChange={(e) => onChangeField("status", e.target.value)}>
                    <option value="new">New</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                  </Select>
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Group (BU)</label>
                  <Input className={LINE_INPUT_CLASS} value={form.groupBu} onChange={(e) => onChangeField("groupBu", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>BDM</label>
                  <Input className={LINE_INPUT_CLASS} value={form.bdm} onChange={(e) => onChangeField("bdm", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Role</label>
                  <Input className={LINE_INPUT_CLASS} value={form.role} onChange={(e) => onChangeField("role", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Current Company</label>
                  <div>
                    <Input className={LINE_INPUT_CLASS} value={form.currentCompany} onChange={(e) => onChangeField("currentCompany", e.target.value)} />
                    <p className="mt-1 text-xs text-slate-500">
                      Exact client/vendor match will be linked automatically.
                    </p>
                  </div>
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>
                    Employee Type <span className="text-red-600">*</span>
                  </label>
                  <Select className={LINE_INPUT_CLASS} value={form.employeeType} onChange={(e) => onChangeField("employeeType", e.target.value)}>
                    <option value="full_time">Full Time</option>
                    <option value="contract">Contract</option>
                    <option value="part_time">Part Time</option>
                  </Select>
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>
                    Source <span className="text-red-600">*</span>
                  </label>
                  <Select className={LINE_INPUT_CLASS} value={form.source} onChange={(e) => onChangeField("source", e.target.value)}>
                    <option value="manual">Manual</option>
                    <option value="referral">Referral</option>
                    <option value="portal">Portal</option>
                  </Select>
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Referred By</label>
                  <Input className={LINE_INPUT_CLASS} value={form.referredBy} onChange={(e) => onChangeField("referredBy", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Referred By (Other)</label>
                  <Input className={LINE_INPUT_CLASS} value={form.referredByOther} onChange={(e) => onChangeField("referredByOther", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Ownership</label>
                  <Input className={LINE_INPUT_CLASS} value={ownerName} readOnly />
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <div className={sectionTitleClass}>Contact Information</div>
              <div className={sectionBodyClass}>
                <div className={rowClass}>
                  <label className={labelClass}>
                    Email 1 <span className="text-red-600">*</span>
                  </label>
                  <Input className={LINE_INPUT_CLASS} type="email" value={form.email1} onChange={(e) => onChangeField("email1", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Email 2</label>
                  <Input className={LINE_INPUT_CLASS} type="email" value={form.email2} onChange={(e) => onChangeField("email2", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Primary Phone</label>
                  <Input className={LINE_INPUT_CLASS} value={form.primaryPhone} onChange={(e) => onChangeField("primaryPhone", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Work Phone</label>
                  <Input className={LINE_INPUT_CLASS} value={form.workPhone} onChange={(e) => onChangeField("workPhone", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Mobile Phone</label>
                  <Input className={LINE_INPUT_CLASS} value={form.mobilePhone} onChange={(e) => onChangeField("mobilePhone", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Other Phone</label>
                  <Input className={LINE_INPUT_CLASS} value={form.otherPhone} onChange={(e) => onChangeField("otherPhone", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Address</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input className={LINE_INPUT_CLASS} placeholder="Address 1" value={form.address1} onChange={(e) => onChangeField("address1", e.target.value)} />
                    <Input className={LINE_INPUT_CLASS} placeholder="Address 2" value={form.address2} onChange={(e) => onChangeField("address2", e.target.value)} />
                    <Input className={LINE_INPUT_CLASS} placeholder="City" value={form.city} onChange={(e) => onChangeField("city", e.target.value)} />
                    <Input className={LINE_INPUT_CLASS} placeholder="State" value={form.state} onChange={(e) => onChangeField("state", e.target.value)} />
                    <Input className={LINE_INPUT_CLASS} placeholder="Zip" value={form.zip} onChange={(e) => onChangeField("zip", e.target.value)} />
                    <Input className={LINE_INPUT_CLASS} placeholder="Country" value={form.country} onChange={(e) => onChangeField("country", e.target.value)} />
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <div className={sectionTitleClass}>Comments</div>
              <div className={sectionBodyClass}>
                <div className={rowClass}>
                  <label className={labelClass}>Employment Preference</label>
                  <Input className={LINE_INPUT_CLASS} value={form.employmentPreference} onChange={(e) => onChangeField("employmentPreference", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Base Salary</label>
                  <Input className={LINE_INPUT_CLASS} value={form.baseSalary} onChange={(e) => onChangeField("baseSalary", e.target.value)} placeholder="USD / INR" />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Desired Salary</label>
                  <Input className={LINE_INPUT_CLASS} value={form.desiredSalary} onChange={(e) => onChangeField("desiredSalary", e.target.value)} placeholder="USD / INR" />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Current Pay Rate</label>
                  <Input className={LINE_INPUT_CLASS} value={form.currentPayRate} onChange={(e) => onChangeField("currentPayRate", e.target.value)} placeholder="USD / INR" />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Desired Pay Rate</label>
                  <Input className={LINE_INPUT_CLASS} value={form.desiredPayRate} onChange={(e) => onChangeField("desiredPayRate", e.target.value)} placeholder="USD / INR" />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Employment Start Date</label>
                  <Input className={LINE_INPUT_CLASS} type="date" value={form.employmentStartDate} onChange={(e) => onChangeField("employmentStartDate", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Project Start Date</label>
                  <Input className={LINE_INPUT_CLASS} type="date" value={form.projectStartDate} onChange={(e) => onChangeField("projectStartDate", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Desired Locations</label>
                  <Input className={LINE_INPUT_CLASS} value={form.desiredLocations} onChange={(e) => onChangeField("desiredLocations", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Willing To Relocate</label>
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
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Comments</label>
                  <Textarea
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
                  <label className={labelClass}>Category</label>
                  <Input className={LINE_INPUT_CLASS} value={form.category} onChange={(e) => onChangeField("category", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Skills</label>
                  <Input className={LINE_INPUT_CLASS} value={form.skills} onChange={(e) => onChangeField("skills", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Industry</label>
                  <Input className={LINE_INPUT_CLASS} value={form.industry} onChange={(e) => onChangeField("industry", e.target.value)} />
                </div>
                <div className={rowClass}>
                  <label className={labelClass}>Schedule Next Action</label>
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
                </div>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
            <Button type="button" variant="ghost" onClick={() => list.setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || uploadResumeMutation.isPending}>
              {createMutation.isPending || uploadResumeMutation.isPending ? "Creating..." : "Create Candidate"}
            </Button>
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
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={onExtractFromResume}
                disabled={!resumeFile || extractMutation.isPending}
              >
                <FileText className="mr-1 size-4" />
                {extractMutation.isPending ? "parsing resume..." : "parse resume"}
              </Button>
            </div>
            {resumeFile ? <p className="text-xs text-slate-600">Selected file: {resumeFile.name}</p> : null}
            {extractMessage ? <p className="text-xs text-emerald-700">{extractMessage}</p> : null}
            <Textarea
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
      createForm={createFormContent}
      error={<ErrorBanner message={error} />}
      pagination={pagination}
    >
      <div className={cn("grid", previewCandidateId !== null ? "xl:grid-cols-[minmax(0,1fr)_36rem]" : "grid-cols-1")}>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-300">
                <th className="w-16 px-3 py-2">
                  <input type="checkbox" checked={selection.allSelected} onChange={selection.toggleSelectAll} aria-label="Select all candidates" />
                </th>
                <th className="w-24 px-3 py-2 font-medium text-slate-900">ID</th>
                <th className="px-3 py-2 font-medium text-slate-900">Candidate Name</th>
                <th className="w-72 px-3 py-2 font-medium text-slate-900">Email</th>
                <th className="w-52 px-3 py-2 font-medium text-slate-900">Phone</th>
                <th className="w-64 px-3 py-2 font-medium text-slate-900">Current Company</th>
                <th className="w-44 px-3 py-2 font-medium text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="px-3 py-4 text-slate-600" colSpan={7}>Loading...</td></tr>
              ) : null}

              {!isLoading && candidateItems.length === 0 ? (
                <tr><td className="px-3 py-4 text-slate-600" colSpan={7}>No candidates found.</td></tr>
              ) : null}

              {candidateItems.map((candidate, index) => (
                <tr
                  key={candidate.id}
                  className={cn(
                    getRowClassName(index),
                    previewCandidateId === candidate.id && "bg-sky-100/80",
                  )}
                >
                  <td className="px-3 py-2">
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
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-800">{candidate.id}</td>
                  <td className="px-3 py-2">
                    <Link href={`/candidates/${candidate.id}`} className="font-medium text-blue-700 hover:underline">
                      {candidate.first_name} {candidate.last_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-800">{candidate.email ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-800">{candidate.phone ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-800">{candidate.current_company ?? "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Link href={`/candidates/${candidate.id}/resumes`} className="text-blue-700 hover:underline">Resumes</Link>
                      {candidate.deleted_at ? (
                        <Button variant="secondary" onClick={() => restoreMutation.mutate(candidate.id)}>Restore</Button>
                      ) : (
                        <Button variant="danger" onClick={() => deleteMutation.mutate(candidate.id)}>Delete</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {previewCandidateId !== null ? (
          <aside className="border-l border-slate-300 bg-slate-50">
            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-900">
                    <UserRound className="size-5 text-emerald-600" />
                    <p className="text-balance text-4xl font-semibold leading-none">{previewFullName}</p>
                  </div>
                  <p className="text-sm text-slate-500">Candidate ID: {previewCandidate?.id ?? previewCandidateId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/candidates/${previewCandidateId}`}
                    className="inline-flex items-center rounded-md bg-ocean px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
                  >
                    Actions
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
              <div className="flex min-h-11 items-end gap-5 overflow-x-auto">
                {previewTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewTab(tab.id)}
                    className={cn(
                      "border-b-2 pb-2 text-sm font-medium uppercase",
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
                {["Tasks", "Submissions", "Client Submissions", "Interviews", "Placements"].map((label) => (
                  <div key={label} className="rounded border border-slate-200 bg-white px-2 py-2 text-center">
                    <p className="tabular-nums text-2xl font-semibold leading-none text-slate-700">0</p>
                    <p className="mt-1 text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4">
              {previewLoading ? (
                <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading candidate preview...</div>
              ) : null}

              {!previewLoading && previewTab === "details" ? (
                <div className="rounded border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3 text-4xl font-semibold text-slate-900">Summary</div>
                  <div className="grid gap-5 px-4 py-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">First Name</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{previewCandidate?.first_name ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Last Name</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{previewCandidate?.last_name ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{previewStatusLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Group (BU)</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">-</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Email 1</p>
                      <p className="mt-1 break-all text-2xl font-semibold text-sky-700">{previewCandidate?.email ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Primary Phone</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{previewCandidate?.phone ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Current Company</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{previewCandidate?.current_company ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Owner</p>
                      <p className="mt-1 tabular-nums text-2xl font-semibold text-slate-900">{previewCandidate?.owner_user_id ?? "-"}</p>
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
                <div className="rounded border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-sm text-slate-600">Open resumes for this candidate.</p>
                  <Link
                    href={`/candidates/${previewCandidateId}/resumes`}
                    className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
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
