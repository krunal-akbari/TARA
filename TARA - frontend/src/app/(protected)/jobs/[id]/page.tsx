"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsCatalog } from "@/hooks/use-settings-catalog";
import { useUserNameMap } from "@/hooks/use-user-name-map";
import { getApiErrorMessage } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import { getJob, listJobApplications, restoreJob, updateJob } from "@/lib/services/jobs";
import { JOB_INTAKE_CHANNELS } from "@/lib/types/forms";
import { cn } from "@/lib/utils/cn";
import { formatDate, toTitleCase } from "@/lib/utils/format";

type JobTabId = "overview" | "edit" | "applicants";

function toLabel(value: string) {
  return toTitleCase(value.replaceAll("_", " "));
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const parsedJobId = Number(id);
  const hasValidId = Number.isInteger(parsedJobId) && parsedJobId > 0;
  const queryClient = useQueryClient();
  const { catalog } = useSettingsCatalog();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [channel, setChannel] = useState("direct_client");
  const [groupBu, setGroupBu] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<JobTabId>("overview");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.jobs.detail(id),
    queryFn: () => getJob(id, true),
    enabled: hasValidId,
  });
  const { getUserFirstName } = useUserNameMap([data?.owner_user_id]);

  const { data: applicationsData, isLoading: applicationsLoading } = useQuery({
    queryKey: queryKeys.jobs.applications(id, 1),
    queryFn: () => listJobApplications(id, { page: 1, pageSize: 100 }),
    enabled: hasValidId,
  });

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setDescription(data.description);
    setStatus(data.status);
    setChannel(data.intake_channel);
    setGroupBu(data.group_bu ?? "");
  }, [data]);

  const groupBuOptions = useMemo(() => {
    const configured = catalog.group_bu;
    if (groupBu && !configured.includes(groupBu)) return [...configured, groupBu];
    return configured;
  }, [catalog.group_bu, groupBu]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#applied-candidates") {
      setActiveTab("applicants");
    }
  }, []);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateJob(id, {
        title: title.trim(),
        description,
        status,
        intake_channel: channel,
        group_bu: groupBu || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to update job")),
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreJob(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(id) }),
    onError: (err) => setError(getApiErrorMessage(err, "Failed to restore job")),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    updateMutation.mutate();
  };

  const tabs = useMemo(
    () => [
      { id: "overview" as const, label: "Overview" },
      { id: "edit" as const, label: "Edit" },
      { id: "applicants" as const, label: "Applicants" },
    ],
    [],
  );

  const statusLabel = data?.deleted_at ? "Deleted" : data ? toLabel(data.status) : "-";
  const applicantsCount = applicationsData?.total ?? data?.applications_count ?? 0;

  if (!hasValidId) {
    return <ErrorBanner message="Invalid job id." />;
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      {isLoading ? (
        <Card>
          <p className="text-sm text-slate-600">Loading job details...</p>
        </Card>
      ) : null}

      {data ? (
        <>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <BriefcaseBusiness className="size-5 text-sky-700" />
                  <p className="text-3xl font-semibold tabular-nums text-slate-900">{data.id}</p>
                  <p className="text-2xl text-slate-500">|</p>
                  <p className="text-balance text-3xl font-semibold text-slate-900">{data.title}</p>
                </div>
                <StatusChip value={statusLabel} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                <div>
                  <p className="text-xs font-medium text-slate-500">ID</p>
                  <p className="mt-1 tabular-nums text-slate-900">{data.id}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Job Title</p>
                  <p className="mt-1 text-slate-900">{data.title}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Status</p>
                  <p className="mt-1 text-slate-900">{statusLabel}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Intake Channel</p>
                  <p className="mt-1 text-slate-900">{toLabel(data.intake_channel)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Origin Client</p>
                  <p className="mt-1 tabular-nums text-slate-900">{data.origin_client_id ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Origin Business Partner</p>
                  <p className="mt-1 tabular-nums text-slate-900">{data.origin_vendor_id ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Applicants</p>
                  <p className="mt-1 tabular-nums text-slate-900">{applicantsCount}</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border-b border-slate-200">
              <div className="flex min-w-max items-center gap-4 px-4 py-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={cn(
                      "border-b-2 px-1 py-1 text-sm",
                      activeTab === tab.id
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-slate-700 hover:text-slate-900",
                    )}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {activeTab === "overview" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="overflow-hidden p-0">
                <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Job Overview</div>
                <div className="grid gap-0 text-sm">
                  <div className="grid grid-cols-2 border-b border-slate-200 px-3 py-2"><span className="text-slate-700">BDA</span><span className="text-slate-900">{getUserFirstName(data.owner_user_id)}</span></div>
                  <div className="grid grid-cols-2 border-b border-slate-200 px-3 py-2"><span className="text-slate-700">Group (BU)</span><span className="text-slate-900">{data.group_bu ? toLabel(data.group_bu) : "-"}</span></div>
                  <div className="grid grid-cols-2 border-b border-slate-200 px-3 py-2"><span className="text-slate-700">Deleted At</span><span className="text-slate-900">{formatDate(data.deleted_at)}</span></div>
                  <div className="grid grid-cols-2 px-3 py-2"><span className="text-slate-700">Applied Candidates</span><span className="tabular-nums text-slate-900">{applicantsCount}</span></div>
                </div>
              </Card>

              <Card className="overflow-hidden p-0">
                <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Description</div>
                <p className="px-3 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {data.description || "No description provided."}
                </p>
              </Card>

            </div>
          ) : null}

          {activeTab === "applicants" ? (
            <Card id="applied-candidates" className="overflow-hidden p-0">
              <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Applicants</div>
              {applicationsLoading ? (
                <p className="px-3 py-3 text-sm text-slate-600">Loading applicants...</p>
              ) : null}
              {!applicationsLoading && (applicationsData?.items?.length ?? 0) === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-600">No candidates applied to this job yet.</p>
              ) : null}
              {!applicationsLoading && (applicationsData?.items?.length ?? 0) > 0 ? (
                <div className="divide-y divide-slate-200">
                  {(applicationsData?.items ?? []).map((application) => (
                    <div key={application.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <Link href={`/candidates/${application.candidate_id}`} className="font-medium text-blue-700 hover:underline">
                        {application.candidate_name}
                      </Link>
                      <span className="text-xs uppercase tracking-wide text-slate-500">{application.status}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ) : null}

          {activeTab === "edit" ? (
            <Card>
              <form className="grid gap-3 sm:max-w-2xl" onSubmit={onSubmit}>
                <div>
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="closed">Closed</option>
                  </Select>
                </div>
                <div>
                  <Label>Intake Channel</Label>
                  <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                    {JOB_INTAKE_CHANNELS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Group (BU)</Label>
                  <Select value={groupBu} onChange={(e) => setGroupBu(e.target.value)}>
                    <option value="">{groupBuOptions.length > 0 ? "Select Group (BU)" : "No Group (BU) configured"}</option>
                    {groupBuOptions.map((item) => (
                      <option key={item} value={item}>{toLabel(item)}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={updateMutation.isPending}>Save</Button>
                  {data.deleted_at ? (
                    <Button type="button" variant="secondary" onClick={() => restoreMutation.mutate()}>Restore</Button>
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
