"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Binoculars, BriefcaseBusiness } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { ListPageShell } from "@/components/common/list-page-shell";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useListPage } from "@/hooks/use-list-page";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/query-keys";
import { listClients } from "@/lib/services/clients";
import { createJob, deleteJob, listJobs, restoreJob } from "@/lib/services/jobs";
import { listVendors } from "@/lib/services/vendors";
import { JOB_INTAKE_CHANNELS } from "@/lib/types/forms";
import { toTitleCase } from "@/lib/utils/format";
import { LINE_INPUT_CLASS, getRowClassName } from "@/lib/utils/table-styles";

export default function JobsPage() {
  const queryClient = useQueryClient();
  const list = useListPage();
  const session = useAuthStore((s) => s.session);
  const ownerName = useMemo(() => {
    const full = `${session?.user?.first_name ?? ""} ${session?.user?.last_name ?? ""}`.trim();
    if (full) return full;
    const prefix = session?.user?.email?.split("@")[0] ?? "Current User";
    return toTitleCase(prefix);
  }, [session]);

  const [form, setForm] = useState({
    title: "",
    status: "draft",
    groupBu: "",
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

  const resetCreateForm = () => {
    setForm({
      title: "",
      status: "draft",
      groupBu: "",
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
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.jobs.list(list.page, list.includeDeleted),
    queryFn: () => listJobs({ page: list.page, pageSize: list.pageSize, includeDeleted: list.includeDeleted }),
  });

  const jobItems = useMemo(() => {
    const items = data?.items ?? [];
    const search = list.normalizedSearch.toLowerCase();
    if (!search) return items;
    return items.filter((item) => {
      const haystack = `${item.id} ${item.title} ${item.status} ${item.intake_channel}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [data?.items, list.normalizedSearch]);

  const pagination = list.getPagination(data?.total ?? 0);
  const selection = list.getSelectionHelpers(jobItems);

  const createMutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      resetCreateForm();
      list.setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to create job")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
    onError: (err) => setError(getApiErrorMessage(err, "Failed to delete job")),
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
      let matchedClientId: number | null = null;
      let matchedVendorId: number | null = null;

      const normalizedClientName = form.originClientName.trim();
      const normalizedVendorName = form.originVendorName.trim();

      if (normalizedClientName || normalizedVendorName) {
        const [clientResult, vendorResult] = await Promise.all([
          normalizedClientName
            ? listClients({
                page: 1,
                pageSize: 50,
                includeDeleted: false,
                search: normalizedClientName,
              })
            : Promise.resolve(null),
          normalizedVendorName
            ? listVendors({
                page: 1,
                pageSize: 50,
                includeDeleted: false,
                search: normalizedVendorName,
              })
            : Promise.resolve(null),
        ]);

        if (clientResult) {
          const exactClient = clientResult.items.find(
            (item) => item.name.trim().toLowerCase() === normalizedClientName.toLowerCase(),
          );
          matchedClientId = exactClient?.id ?? null;
        }

        if (vendorResult) {
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
            <div><Label>Job Title *</Label><Input className={LINE_INPUT_CLASS} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div>
              <Label>Status *</Label>
              <Select className={LINE_INPUT_CLASS} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="closed">Closed</option>
              </Select>
            </div>
            <div><Label>Group (BU)</Label><Input className={LINE_INPUT_CLASS} value={form.groupBu} onChange={(e) => setForm((p) => ({ ...p, groupBu: e.target.value }))} /></div>
            <div>
              <Label>Job Type *</Label>
              <Select className={LINE_INPUT_CLASS} value={form.jobType} onChange={(e) => setForm((p) => ({ ...p, jobType: e.target.value }))}>
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
              <Label>Priority</Label>
              <Select className={LINE_INPUT_CLASS} value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </Select>
            </div>
            <div><Label>Client Company</Label><Input className={LINE_INPUT_CLASS} value={form.originClientName} onChange={(e) => setForm((p) => ({ ...p, originClientName: e.target.value }))} placeholder="Type client name" /></div>
            <div><Label>Business Partner</Label><Input className={LINE_INPUT_CLASS} value={form.originVendorName} onChange={(e) => setForm((p) => ({ ...p, originVendorName: e.target.value }))} placeholder="Type vendor name" /></div>
            <div><Label>Start Date</Label><Input className={LINE_INPUT_CLASS} type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} /></div>
            <div><Label>Owner</Label><Input className={LINE_INPUT_CLASS} value={ownerName} readOnly /></div>
            <div className="sm:col-span-2"><Label>Assigned To</Label><Input className={LINE_INPUT_CLASS} value={form.assignedTo} onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Compensation Information</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
            <div><Label>Salary Low</Label><Input className={LINE_INPUT_CLASS} value={form.salaryLow} onChange={(e) => setForm((p) => ({ ...p, salaryLow: e.target.value }))} /></div>
            <div><Label>Salary High</Label><Input className={LINE_INPUT_CLASS} value={form.salaryHigh} onChange={(e) => setForm((p) => ({ ...p, salaryHigh: e.target.value }))} /></div>
            <div><Label>Perm Fee (%)</Label><Input className={LINE_INPUT_CLASS} value={form.permFee} onChange={(e) => setForm((p) => ({ ...p, permFee: e.target.value }))} /></div>
            <div><Label>Benefits</Label><Input className={LINE_INPUT_CLASS} value={form.benefits} onChange={(e) => setForm((p) => ({ ...p, benefits: e.target.value }))} /></div>
            <div><Label>Expected Value</Label><Input className={LINE_INPUT_CLASS} value={form.expectedValue} onChange={(e) => setForm((p) => ({ ...p, expectedValue: e.target.value }))} /></div>
            <div><Label>Bonus Package</Label><Input className={LINE_INPUT_CLASS} value={form.bonusPackage} onChange={(e) => setForm((p) => ({ ...p, bonusPackage: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Skills / Experience</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
            <div><Label>Category</Label><Input className={LINE_INPUT_CLASS} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} /></div>
            <div><Label>Required Skills</Label><Input className={LINE_INPUT_CLASS} value={form.requiredSkills} onChange={(e) => setForm((p) => ({ ...p, requiredSkills: e.target.value }))} /></div>
            <div className="sm:col-span-2"><Label>Additional Skills / Keywords</Label><Textarea className="min-h-20 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:ring-0" value={form.additionalSkills} onChange={(e) => setForm((p) => ({ ...p, additionalSkills: e.target.value }))} /></div>
            <div><Label>Industry</Label><Input className={LINE_INPUT_CLASS} value={form.industry} onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))} /></div>
            <div><Label>Minimum Experience (Years)</Label><Input className={LINE_INPUT_CLASS} value={form.minExperience} onChange={(e) => setForm((p) => ({ ...p, minExperience: e.target.value }))} /></div>
            <div><Label>Degree Requirements</Label><Input className={LINE_INPUT_CLASS} value={form.degreeRequirements} onChange={(e) => setForm((p) => ({ ...p, degreeRequirements: e.target.value }))} /></div>
            <div><Label>Certification Requirements</Label><Input className={LINE_INPUT_CLASS} value={form.certificationRequirements} onChange={(e) => setForm((p) => ({ ...p, certificationRequirements: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Job Description</div>
          <div className="grid gap-3 px-3 py-3">
            <div><Label>Job Description</Label><Textarea className="min-h-28 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:ring-0" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Published Description</Label><Textarea className="min-h-28 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:ring-0" value={form.publishedDescription} onChange={(e) => setForm((p) => ({ ...p, publishedDescription: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Job Location</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-4">
            <div className="sm:col-span-4"><Label>Address</Label><Input className={LINE_INPUT_CLASS} value={form.locationAddress} onChange={(e) => setForm((p) => ({ ...p, locationAddress: e.target.value }))} /></div>
            <div><Label>City</Label><Input className={LINE_INPUT_CLASS} value={form.locationCity} onChange={(e) => setForm((p) => ({ ...p, locationCity: e.target.value }))} /></div>
            <div><Label>State / Province</Label><Input className={LINE_INPUT_CLASS} value={form.locationState} onChange={(e) => setForm((p) => ({ ...p, locationState: e.target.value }))} /></div>
            <div><Label>Zip/Postal Code</Label><Input className={LINE_INPUT_CLASS} value={form.locationZip} onChange={(e) => setForm((p) => ({ ...p, locationZip: e.target.value }))} /></div>
            <div><Label>Country</Label><Input className={LINE_INPUT_CLASS} value={form.locationCountry} onChange={(e) => setForm((p) => ({ ...p, locationCountry: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Email Notification</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
            <div><Label>Internal User</Label><Input className={LINE_INPUT_CLASS} value={form.internalUser} onChange={(e) => setForm((p) => ({ ...p, internalUser: e.target.value }))} /></div>
            <div><Label>Distribution List</Label><Input className={LINE_INPUT_CLASS} value={form.distributionList} onChange={(e) => setForm((p) => ({ ...p, distributionList: e.target.value }))} /></div>
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
      createForm={createFormContent}
      error={<ErrorBanner message={error} />}
      pagination={pagination}
    >
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-slate-300">
            <th className="w-16 px-3 py-2">
              <input type="checkbox" checked={selection.allSelected} onChange={selection.toggleSelectAll} aria-label="Select all jobs" />
            </th>
            <th className="w-24 px-3 py-2 font-medium text-slate-900">ID</th>
            <th className="px-3 py-2 font-medium text-slate-900">Job Title</th>
            <th className="w-40 px-3 py-2 font-medium text-slate-900">Status</th>
            <th className="w-52 px-3 py-2 font-medium text-slate-900">Channel</th>
            <th className="w-36 px-3 py-2 font-medium text-slate-900">Origin Client</th>
            <th className="w-36 px-3 py-2 font-medium text-slate-900">Origin Vendor</th>
            <th className="w-44 px-3 py-2 font-medium text-slate-900">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td className="px-3 py-4 text-slate-600" colSpan={8}>Loading...</td></tr>
          ) : null}

          {!isLoading && jobItems.length === 0 ? (
            <tr><td className="px-3 py-4 text-slate-600" colSpan={8}>No jobs found.</td></tr>
          ) : null}

          {jobItems.map((job, index) => (
            <tr key={job.id} className={getRowClassName(index)}>
              <td className="px-3 py-2">
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
              </td>
              <td className="px-3 py-2 tabular-nums text-slate-800">{job.id}</td>
              <td className="px-3 py-2">
                <Link href={`/jobs/${job.id}`} className="font-medium text-blue-700 hover:underline">
                  {job.title}
                </Link>
              </td>
              <td className="px-3 py-2"><StatusChip value={job.status} /></td>
              <td className="px-3 py-2 text-slate-800">{job.intake_channel}</td>
              <td className="px-3 py-2 tabular-nums text-slate-800">{job.origin_client_id ?? "-"}</td>
              <td className="px-3 py-2 tabular-nums text-slate-800">{job.origin_vendor_id ?? "-"}</td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  <Link href={`/jobs/${job.id}/routing`} className="text-blue-700 hover:underline">Routing</Link>
                  {job.deleted_at ? (
                    <Button variant="secondary" onClick={() => restoreMutation.mutate(job.id)}>Restore</Button>
                  ) : (
                    <Button variant="danger" onClick={() => deleteMutation.mutate(job.id)}>Delete</Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ListPageShell>
  );
}
