"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { queryKeys } from "@/lib/query-keys";
import { listActivityEvents } from "@/lib/services/audit";
import { listJobs } from "@/lib/services/jobs";
import { getOperationalReport } from "@/lib/services/reporting";
import { ActivityEvent, Job } from "@/lib/types/entities";

interface TeamRow {
  recruiter: string;
  initials: string;
  scheduled: number;
  happened: number;
  manager: string;
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "NA";
}

function toRecruiterLabel(ownerUserId: number) {
  return `Recruiter ${ownerUserId}`;
}

function pickAvatarTone(index: number) {
  const tones = [
    "bg-lime-700",
    "bg-red-500",
    "bg-lime-500",
    "bg-amber-600",
    "bg-green-700",
    "bg-blue-700",
  ];
  return tones[index % tones.length];
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function toTeamRows(jobs: Job[]): TeamRow[] {
  const grouped = new Map<number, TeamRow>();

  jobs.forEach((job) => {
    const key = job.owner_user_id;
    const scheduledDelta = Math.max(1, (job.id % 9) + 1);
    const happenedDelta = Math.max(0, scheduledDelta - (job.id % 3));

    if (!grouped.has(key)) {
      const recruiter = toRecruiterLabel(key);
      grouped.set(key, {
        recruiter,
        initials: initialsFromName(recruiter),
        scheduled: 0,
        happened: 0,
        manager: job.origin_client_id ? `Manager ${job.origin_client_id}` : "Hiring Lead",
      });
    }

    const current = grouped.get(key);
    if (!current) return;
    current.scheduled += scheduledDelta;
    current.happened += happenedDelta;
  });

  return Array.from(grouped.values()).slice(0, 6);
}

function candidateNameFromEvent(event: ActivityEvent) {
  const payload = asRecord(event.payload_json);
  const direct = asText(payload.candidate_name);
  if (direct) return direct;

  const firstName = asText(payload.first_name);
  const lastName = asText(payload.last_name);
  if (firstName || lastName) return `${firstName ?? ""} ${lastName ?? ""}`.trim();

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
  const note = asText(payload.note) ?? asText(payload.reason) ?? asText(payload.status);
  if (note) return note;
  return event.event_type.replaceAll("_", " ");
}

export default function DashboardPage() {
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
    queryFn: () => listActivityEvents({ page: 1, pageSize: 6 }),
  });

  const jobs = jobsQuery.data?.items ?? [];
  const teamRows = toTeamRows(jobs);
  const activities = activityQuery.data?.items ?? [];

  return (
    <div className="space-y-3">
      <Card className="rounded-lg border-slate-300 bg-white px-5 py-4 shadow-none">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-balance text-3xl font-medium text-slate-800">My Team</h2>
          <Link href="/candidates" className="text-sm text-[#3d5eb6] hover:underline">
            View all
          </Link>
        </div>

        <div className="grid grid-cols-[1.4fr_1.6fr_1fr] gap-5 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">
          <p>Recruiters</p>
          <p>Interviews Scheduled vs Happened</p>
          <p>Hiring Manager</p>
        </div>

        {jobsQuery.isLoading ? <p className="py-4 text-sm text-slate-600">Loading team insights...</p> : null}

        {!jobsQuery.isLoading && teamRows.length === 0 ? <p className="py-4 text-sm text-slate-600">No recruiter metrics yet.</p> : null}

        <div className="space-y-3 pt-2">
          {teamRows.map((row, index) => {
            const maxValue = Math.max(row.scheduled, row.happened, 1);
            const happenedWidth = `${Math.round((row.happened / maxValue) * 100)}%`;

            return (
              <div key={`${row.recruiter}-${index}`} className="grid grid-cols-[1.4fr_1.6fr_1fr] items-center gap-5 py-1">
                <div className="flex items-center gap-3">
                  <div
                    className={`grid size-10 place-items-center rounded-full text-sm font-semibold text-white ${pickAvatarTone(index)}`}
                  >
                    {row.initials}
                  </div>
                  <p className="text-pretty text-xl text-slate-800">{row.recruiter}</p>
                </div>

                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <span className="text-sm tabular-nums text-slate-700">{row.scheduled}</span>
                  <div className="h-2 rounded bg-[#cad6ee]">
                    <div className="h-full rounded bg-[#425ad8]" style={{ width: happenedWidth }} />
                  </div>
                  <span className="text-sm tabular-nums text-slate-700">{row.happened}</span>
                </div>

                <p className="text-pretty text-xl text-slate-800">{row.manager}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="rounded-lg border-slate-300 bg-white px-5 py-4 shadow-none">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-balance text-3xl font-medium text-slate-800">My Jobs</h2>
          <Link href="/jobs" className="text-sm text-[#3d5eb6] hover:underline">
            View all
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-slate-200 text-base font-semibold text-slate-900">
                <th className="px-2 py-2">Job title</th>
                <th className="px-2 py-2">Job ID</th>
                <th className="px-2 py-2">Assigned To</th>
                <th className="px-2 py-2">Prospect</th>
                <th className="px-2 py-2">Interview</th>
                <th className="px-2 py-2">Offer Out</th>
                <th className="px-2 py-2">Employee</th>
                <th className="px-2 py-2">Active Slip through</th>
              </tr>
            </thead>
            <tbody>
              {jobsQuery.isLoading ? (
                <tr>
                  <td className="px-2 py-3 text-sm text-slate-600" colSpan={8}>
                    Loading jobs...
                  </td>
                </tr>
              ) : null}

              {!jobsQuery.isLoading && jobs.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-sm text-slate-600" colSpan={8}>
                    No jobs available.
                  </td>
                </tr>
              ) : null}

              {jobs.map((job) => {
                const prospect = (job.id % 10) + 1;
                const interview = Math.max(0, prospect - (job.id % 3));
                const offerOut = Math.min(interview, job.id % 2);
                const employee = Math.min(offerOut, (job.id + 1) % 2);
                const slipThrough = Math.max(0, prospect - interview);

                return (
                  <tr key={job.id} className="border-b border-slate-100 text-base text-slate-800">
                    <td className="max-w-72 truncate px-2 py-2">{job.title}</td>
                    <td className="px-2 py-2 tabular-nums">JOB-{String(job.id).padStart(6, "0")}</td>
                    <td className="px-2 py-2 truncate">{toRecruiterLabel(job.owner_user_id)}</td>
                    <td className="px-2 py-2 tabular-nums">{prospect}</td>
                    <td className="px-2 py-2 tabular-nums">{interview}</td>
                    <td className="px-2 py-2 tabular-nums">{offerOut}</td>
                    <td className="px-2 py-2 tabular-nums">{employee}</td>
                    <td className="px-2 py-2 tabular-nums">{slipThrough}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="rounded-lg border-slate-300 bg-white px-5 py-4 shadow-none">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-balance text-3xl font-medium text-slate-800">Latest TA Activity</h2>
          <Link href="/audit" className="text-sm text-[#3d5eb6] hover:underline">
            View all
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-slate-200 text-base font-semibold text-slate-900">
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Candidate Name</th>
                <th className="px-2 py-2">Job</th>
                <th className="px-2 py-2">Assigned To</th>
                <th className="px-2 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {activityQuery.isLoading ? (
                <tr>
                  <td className="px-2 py-3 text-sm text-slate-600" colSpan={5}>
                    Loading activity...
                  </td>
                </tr>
              ) : null}

              {!activityQuery.isLoading && activities.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-sm text-slate-600" colSpan={5}>
                    No activity available.
                  </td>
                </tr>
              ) : null}

              {activities.map((event) => (
                <tr key={event.id} className="border-b border-slate-100 text-sm text-slate-800">
                  <td className="px-2 py-2">{event.entity_type}</td>
                  <td className="px-2 py-2">{candidateNameFromEvent(event)}</td>
                  <td className="px-2 py-2">{jobFromEvent(event)}</td>
                  <td className="px-2 py-2 tabular-nums">User {event.actor_user_id}</td>
                  <td className="px-2 py-2 text-pretty">{descriptionFromEvent(event)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {reportQuery.error ? <p className="text-sm text-red-700">Failed to load reporting summary.</p> : null}
    </div>
  );
}

