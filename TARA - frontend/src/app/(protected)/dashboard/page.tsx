"use client";

import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Handshake,
  LayoutDashboard,
  TrendingUp,
  Users,
  UsersRound,
} from "lucide-react";
import { useMemo } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { StatusChip } from "@/components/common/status-chip";
import { Card } from "@/components/ui/card";
import { useUserNameMap } from "@/hooks/use-user-name-map";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/query-keys";
import { formatId, toTitleCase } from "@/lib/utils/format";
import { getRowClassName } from "@/lib/utils/table-styles";
import { listActivityEvents } from "@/lib/services/audit";
import { listJobApplications, listJobs } from "@/lib/services/jobs";
import { getOperationalReport } from "@/lib/services/reporting";
import { ActivityEvent, Job } from "@/lib/types/entities";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface JobMetrics {
  prospect: number;
  interview: number;
  offerOut: number;
  employee: number;
  slipThrough: number;
}

interface TeamRow {
  recruiter: string;
  initials: string;
  scheduled: number;
  happened: number;
  manager: string;
}

function initialsFromName(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "NA";
}

const AVATAR_TONES = [
  "bg-emerald-600", "bg-sky-600", "bg-amber-600",
  "bg-rose-600", "bg-violet-600", "bg-teal-600",
];

function asText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function toTeamRows(
  jobs: Job[],
  metricsByJobId: Map<number, JobMetrics>,
  getUserFirstName: (_userId: number | null | undefined) => string,
): TeamRow[] {
  const grouped = new Map<number, TeamRow>();
  jobs.forEach((job) => {
    const key = job.owner_user_id;
    const metrics = metricsByJobId.get(job.id);
    if (!grouped.has(key)) {
      const recruiter = getUserFirstName(key);
      grouped.set(key, {
        recruiter,
        initials: initialsFromName(recruiter),
        scheduled: 0,
        happened: 0,
        manager: job.origin_client_id ? formatId(job.origin_client_id, "Manager") : "Hiring Lead",
      });
    }
    const current = grouped.get(key)!;
    current.scheduled += metrics?.prospect ?? 0;
    current.happened += metrics?.interview ?? 0;
  });
  return Array.from(grouped.values()).slice(0, 6);
}

function candidateNameFromEvent(event: ActivityEvent) {
  const payload = asRecord(event.payload_json);
  const direct = asText(payload.candidate_name);
  if (direct) return direct;
  const first = asText(payload.first_name);
  const last = asText(payload.last_name);
  if (first || last) return `${first ?? ""} ${last ?? ""}`.trim();
  if (event.entity_type === "candidate") return `Candidate ${event.entity_id}`;
  return "-";
}

function jobFromEvent(event: ActivityEvent) {
  const payload = asRecord(event.payload_json);
  const title = asText(payload.job_title);
  if (title) return title;
  const jobId = asText(payload.job_id);
  if (jobId) return `JOB-${jobId}`;
  if (event.entity_type === "job") return `JOB-${event.entity_id}`;
  return "-";
}

function descriptionFromEvent(event: ActivityEvent) {
  const payload = asRecord(event.payload_json);
  return asText(payload.note) ?? asText(payload.reason) ?? asText(payload.status) ?? event.event_type.replaceAll("_", " ");
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  color,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  href: string;
  color: string;
  delay?: number;
}) {
  return (
    <Link href={href} className="group animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-md">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${color}`}>
            <Icon className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="tabular-nums text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs font-medium text-slate-500">{label}</p>
          </div>
          <ArrowUpRight className="ml-auto size-4 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const session = useAuthStore((s) => s.session);
  const userName = session?.user?.first_name ?? session?.user?.email?.split("@")[0] ?? "there";

  const reportQuery = useQuery({
    queryKey: queryKeys.reporting.operational,
    queryFn: getOperationalReport,
  });

  const jobsQuery = useQuery({
    queryKey: [...queryKeys.jobs.all, "dashboard"],
    queryFn: () => listJobs({ page: 1, pageSize: 6, includeDeleted: false }),
  });

  const activityQuery = useQuery({
    queryKey: [...queryKeys.audit.all, "dashboard"],
    queryFn: () => listActivityEvents({ page: 1, pageSize: 8 }),
  });

  const jobs = useMemo(() => jobsQuery.data?.items ?? [], [jobsQuery.data?.items]);
  const jobOwnerIds = useMemo(() => jobs.map((job) => job.owner_user_id), [jobs]);
  const { getUserFirstName } = useUserNameMap(jobOwnerIds);

  const jobApplicationsQueries = useQueries({
    queries: jobs.map((job) => ({
      queryKey: queryKeys.jobs.applications(job.id, 1),
      queryFn: () => listJobApplications(job.id, { page: 1, pageSize: 200 }),
      staleTime: 30_000,
      enabled: jobs.length > 0,
    })),
  });

  const metricsByJobId = useMemo(() => {
    const map = new Map<number, JobMetrics>();
    jobs.forEach((job, index) => {
      const applications = jobApplicationsQueries[index]?.data?.items ?? [];
      const counts = { interview: 0, offerOut: 0, employee: 0 };
      applications.forEach((app) => {
        const s = app.status.trim().toLowerCase();
        if (["interview", "interview_scheduled", "interviewed"].includes(s)) counts.interview += 1;
        else if (["offer", "offered", "offer_out"].includes(s)) counts.offerOut += 1;
        else if (["employee", "hired", "placement", "placed"].includes(s)) counts.employee += 1;
      });
      const prospect = job.applications_count ?? applications.length;
      map.set(job.id, {
        prospect,
        interview: counts.interview,
        offerOut: counts.offerOut,
        employee: counts.employee,
        slipThrough: Math.max(0, prospect - counts.interview - counts.offerOut - counts.employee),
      });
    });
    return map;
  }, [jobApplicationsQueries, jobs]);

  const teamRows = toTeamRows(jobs, metricsByJobId, getUserFirstName);
  const activities = activityQuery.data?.items ?? [];
  const report = reportQuery.data;

  const reasonBreakdown = useMemo(() => {
    if (!report?.route_reason_breakdown) return [];
    return Object.entries(report.route_reason_breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [report?.route_reason_breakdown]);

  return (
    <div className="space-y-4">
      {/* ==================== GREETING ==================== */}
      <div className="flex items-center gap-3 animate-fade-in">
        <LayoutDashboard className="size-6 text-slate-600" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back, {userName}</h1>
          <p className="text-sm text-slate-500">Here is an overview of your recruitment pipeline.</p>
        </div>
      </div>

      {reportQuery.error ? <ErrorBanner message="Failed to load reporting summary." /> : null}

      {/* ==================== STAT CARDS ==================== */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={BriefcaseBusiness} label="Total Jobs" value={report?.jobs_total ?? "—"} href="/jobs" color="bg-sky-600" delay={0} />
        <StatCard icon={Building2} label="Clients" value={report?.clients_total ?? "—"} href="/clients" color="bg-blue-600" delay={60} />
        <StatCard icon={Building2} label="Business Partners" value={report?.vendors_total ?? "—"} href="/vendors" color="bg-indigo-600" delay={120} />
        <StatCard icon={UsersRound} label="Candidates" value={report?.candidates_total ?? "—"} href="/candidates" color="bg-emerald-600" delay={180} />
        <StatCard icon={Handshake} label="Active Links" value={report?.active_links_total ?? "—"} href="/links" color="bg-amber-600" delay={240} />
        <StatCard icon={TrendingUp} label="Transitions" value={report?.route_transitions_total ?? "—"} href="/audit" color="bg-rose-600" delay={300} />
      </div>

      {/* ==================== MY TEAM ==================== */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-slate-600" />
            <p className="text-sm font-semibold text-slate-900">My Team</p>
          </div>
          <Link href="/candidates" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
            View all <ArrowUpRight className="size-3" />
          </Link>
        </div>

        {jobsQuery.isLoading ? <p className="px-4 py-4 text-sm text-slate-600">Loading team insights...</p> : null}
        {!jobsQuery.isLoading && teamRows.length === 0 ? <p className="px-4 py-4 text-sm text-slate-600">No recruiter metrics yet.</p> : null}

        {teamRows.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {teamRows.map((row, index) => {
              const maxValue = Math.max(row.scheduled, row.happened, 1);
              const happenedPct = Math.round((row.happened / maxValue) * 100);
              return (
                <div key={`${row.recruiter}-${index}`} className="grid grid-cols-[1.4fr_1.6fr_1fr] items-center gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${AVATAR_TONES[index % AVATAR_TONES.length]}`}>
                      {row.initials}
                    </div>
                    <p className="truncate text-sm font-medium text-slate-900">{row.recruiter}</p>
                  </div>
                  <div className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2">
                    <span className="text-right text-xs tabular-nums text-slate-600">{row.scheduled}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-ocean transition-all" style={{ width: `${happenedPct}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-slate-600">{row.happened}</span>
                  </div>
                  <p className="truncate text-sm text-slate-700">{row.manager}</p>
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>

      {/* ==================== MY JOBS + ROUTE REASONS ==================== */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Jobs table */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="size-4 text-slate-600" />
              <p className="text-sm font-semibold text-slate-900">My Jobs</p>
            </div>
            <Link href="/jobs" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
              View all <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-3 py-2 font-medium">Job Title</th>
                  <th className="px-3 py-2 font-medium">Assigned To</th>
                  <th className="px-3 py-2 font-medium text-center">Prospect</th>
                  <th className="px-3 py-2 font-medium text-center">Interview</th>
                  <th className="px-3 py-2 font-medium text-center">Offer</th>
                  <th className="px-3 py-2 font-medium text-center">Placed</th>
                  <th className="px-3 py-2 font-medium text-center">Slip</th>
                </tr>
              </thead>
              <tbody>
                {jobsQuery.isLoading ? <tr><td className="px-3 py-3 text-slate-600" colSpan={7}>Loading jobs...</td></tr> : null}
                {!jobsQuery.isLoading && jobs.length === 0 ? <tr><td className="px-3 py-3 text-slate-600" colSpan={7}>No jobs available.</td></tr> : null}
                {jobs.map((job, idx) => {
                  const m = metricsByJobId.get(job.id) ?? { prospect: 0, interview: 0, offerOut: 0, employee: 0, slipThrough: 0 };
                  return (
                    <tr key={job.id} className={getRowClassName(idx)}>
                      <td className="max-w-52 truncate px-3 py-2">
                        <Link href={`/jobs/${job.id}`} className="font-medium text-blue-700 hover:underline">{job.title}</Link>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{getUserFirstName(job.owner_user_id)}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-slate-900">{m.prospect}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-slate-900">{m.interview}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-slate-900">{m.offerOut}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-slate-900">{m.employee}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-slate-900">{m.slipThrough}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Route reason breakdown */}
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-slate-600" />
              <p className="text-sm font-semibold text-slate-900">Top Route Reasons</p>
            </div>
          </div>
          <div className="px-4 py-3">
            {reportQuery.isLoading ? <p className="text-sm text-slate-600">Loading...</p> : null}
            {!reportQuery.isLoading && reasonBreakdown.length === 0 ? <p className="text-sm text-slate-600">No route transitions recorded yet.</p> : null}
            {reasonBreakdown.length > 0 ? (
              <div className="space-y-3">
                {reasonBreakdown.map(([reason, count]) => {
                  const maxCount = reasonBreakdown[0][1];
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={reason}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-medium text-slate-900">{toTitleCase(reason)}</span>
                        <span className="ml-2 shrink-0 tabular-nums text-slate-600">{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-ocean transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {/* ==================== LATEST ACTIVITY ==================== */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
          <p className="text-sm font-semibold text-slate-900">Latest TA Activity</p>
          <Link href="/audit" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
            View all <ArrowUpRight className="size-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Candidate</th>
                <th className="px-3 py-2 font-medium">Job</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {activityQuery.isLoading ? <tr><td className="px-3 py-3 text-slate-600" colSpan={5}>Loading activity...</td></tr> : null}
              {!activityQuery.isLoading && activities.length === 0 ? <tr><td className="px-3 py-3 text-slate-600" colSpan={5}>No activity available.</td></tr> : null}
              {activities.map((event, idx) => (
                <tr key={event.id} className={getRowClassName(idx)}>
                  <td className="px-3 py-2">
                    <StatusChip value={event.entity_type} />
                  </td>
                  <td className="px-3 py-2 text-slate-900">{candidateNameFromEvent(event)}</td>
                  <td className="px-3 py-2 text-slate-900">{jobFromEvent(event)}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{formatId(event.actor_user_id, "User")}</td>
                  <td className="max-w-56 truncate px-3 py-2 text-slate-700">{descriptionFromEvent(event)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
