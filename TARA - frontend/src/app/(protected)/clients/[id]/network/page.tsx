"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueries, useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, Building2, Link2, UsersRound } from "lucide-react";
import { useMemo } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { StatusChip } from "@/components/common/status-chip";
import { Card } from "@/components/ui/card";
import { queryKeys } from "@/lib/query-keys";
import { getClient, listClientContacts } from "@/lib/services/clients";
import { listJobs } from "@/lib/services/jobs";
import { listLinks } from "@/lib/services/links";
import { getVendor } from "@/lib/services/vendors";
import { ClientVendorLink, Job, Vendor } from "@/lib/types/entities";
import { toTitleCase } from "@/lib/utils/format";

const JOBS_PAGE_SIZE = 100;
const LINKS_PAGE_SIZE = 100;

function toLabel(value: string) {
  return toTitleCase(value.replaceAll("_", " "));
}

function toPriorityLabel(priority: number) {
  if (priority <= 100) return "Hot";
  if (priority <= 500) return "Warm";
  return "Cold";
}

export default function ClientNetworkPage() {
  const params = useParams<{ id: string }>();
  const rawId = params.id;
  const clientId = Number(rawId);
  const hasValidId = Number.isInteger(clientId) && clientId > 0;

  const { data: client, isLoading: isClientLoading, error: clientError } = useQuery({
    queryKey: queryKeys.clients.detail(rawId),
    queryFn: () => getClient(rawId, true),
    enabled: hasValidId,
  });

  const { data: contacts = [], isLoading: isContactsLoading, error: contactsError } = useQuery({
    queryKey: queryKeys.clients.contacts(rawId),
    queryFn: () => listClientContacts(rawId),
    enabled: hasValidId,
  });

  const { data: linksData, isLoading: isLinksLoading, error: linksError } = useQuery({
    queryKey: [...queryKeys.links.all, "client-network", clientId],
    queryFn: async () => {
      const aggregated: ClientVendorLink[] = [];
      let page = 1;
      let total = 0;

      while (true) {
        const response = await listLinks({
          page,
          pageSize: LINKS_PAGE_SIZE,
          includeDeleted: true,
          clientId,
        });
        if (page === 1) total = response.total;
        if (response.items.length === 0) break;
        aggregated.push(...response.items);
        if (aggregated.length >= total) break;
        page += 1;
      }

      return { items: aggregated, total: aggregated.length };
    },
    enabled: hasValidId,
  });

  const linkItems = useMemo(() => linksData?.items ?? [], [linksData?.items]);

  const vendorIds = useMemo(() => {
    const values = new Set<number>();
    for (const link of linkItems) values.add(link.vendor_id);
    return [...values];
  }, [linkItems]);

  const vendorQueries = useQueries({
    queries: vendorIds.map((vendorId) => ({
      queryKey: queryKeys.vendors.detail(vendorId),
      queryFn: () => getVendor(vendorId, true),
      staleTime: 60000,
    })),
  });

  const vendorById = useMemo(() => {
    const map = new Map<number, Vendor>();
    vendorIds.forEach((vendorId, index) => {
      const vendor = vendorQueries[index]?.data;
      if (vendor) map.set(vendorId, vendor);
    });
    return map;
  }, [vendorIds, vendorQueries]);

  const { data: allJobs = [], isLoading: isJobsLoading, error: jobsError } = useQuery({
    queryKey: [...queryKeys.jobs.all, "client-network", clientId],
    queryFn: async () => {
      const aggregated: Job[] = [];
      let page = 1;
      let total = 0;

      while (true) {
        const response = await listJobs({
          page,
          pageSize: JOBS_PAGE_SIZE,
          includeDeleted: true,
        });
        if (page === 1) total = response.total;
        if (response.items.length === 0) break;
        aggregated.push(...response.items);
        if (aggregated.length >= total) break;
        page += 1;
      }

      return aggregated;
    },
    enabled: hasValidId,
  });

  const relatedJobs = useMemo(() => {
    if (!hasValidId) return [];
    const connectedVendors = new Set(vendorIds);
    return allJobs
      .filter((job) => {
        if (job.origin_client_id === clientId) return true;
        if (job.origin_vendor_id && connectedVendors.has(job.origin_vendor_id)) return true;
        return false;
      })
      .sort((a, b) => b.id - a.id);
  }, [allJobs, clientId, hasValidId, vendorIds]);

  const directJobsCount = useMemo(
    () => relatedJobs.filter((job) => job.origin_client_id === clientId).length,
    [relatedJobs, clientId],
  );
  const vendorJobsCount = relatedJobs.length - directJobsCount;
  const activeLinksCount = linkItems.filter((link) => link.status === "active" && !link.deleted_at).length;
  const deletedLinksCount = linkItems.filter((link) => Boolean(link.deleted_at)).length;

  const jobsByChannel = useMemo(() => {
    const map = new Map<string, number>();
    for (const job of relatedJobs) {
      const key = job.intake_channel || "unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [relatedJobs]);

  if (!hasValidId) {
    return (
      <div>
        <ErrorBanner message="Invalid client id." />
      </div>
    );
  }

  return (
    <div>
      <ErrorBanner message={clientError ? "Failed to load client details." : null} />
      <ErrorBanner message={linksError ? "Failed to load vendor connections." : null} />
      <ErrorBanner message={jobsError ? "Failed to load jobs history." : null} />
      <ErrorBanner message={contactsError ? "Failed to load contact details." : null} />

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Vendor Connections</p>
          <p className="mt-1 text-balance text-2xl font-semibold tabular-nums text-slate-900">{linkItems.length}</p>
          <p className="mt-1 text-xs text-slate-600">Active: <span className="tabular-nums">{activeLinksCount}</span> | Deleted: <span className="tabular-nums">{deletedLinksCount}</span></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Jobs Posted</p>
          <p className="mt-1 text-balance text-2xl font-semibold tabular-nums text-slate-900">{relatedJobs.length}</p>
          <p className="mt-1 text-xs text-slate-600">Direct: <span className="tabular-nums">{directJobsCount}</span> | Via Vendors: <span className="tabular-nums">{vendorJobsCount}</span></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Client Status</p>
          <div className="mt-1">{client ? <StatusChip value={toLabel(client.status)} /> : <span className="text-sm text-slate-500">-</span>}</div>
          <p className="mt-2 text-xs text-slate-600 text-pretty">{client?.sector ? `Sector: ${client.sector}` : "Sector not provided"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Contact Count</p>
          <p className="mt-1 text-balance text-2xl font-semibold tabular-nums text-slate-900">{contacts.length}</p>
          <p className="mt-1 text-xs text-slate-600">Owner ID: <span className="tabular-nums">{client?.owner_user_id ?? "-"}</span></p>
        </Card>
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Link2 className="size-4 text-sky-700" />
            <h2 className="text-balance text-lg font-semibold text-slate-900">Connected Vendors</h2>
          </div>
          {isLinksLoading ? <p className="text-sm text-slate-600">Loading vendor connections...</p> : null}
          {!isLinksLoading && linkItems.length === 0 ? (
            <p className="text-pretty text-sm text-slate-600">
              No vendor connections found for this client.{" "}
              <Link href="/links" className="font-medium text-blue-700 hover:underline">Create or manage links</Link>.
            </p>
          ) : null}
          {!isLinksLoading && linkItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="px-2 py-2">Vendor</th>
                    <th className="px-2 py-2">Link Status</th>
                    <th className="px-2 py-2">Priority</th>
                    <th className="px-2 py-2">Vendor Status</th>
                  </tr>
                </thead>
                <tbody>
                  {linkItems.map((link) => {
                    const vendor = vendorById.get(link.vendor_id);
                    const linkStatus = link.deleted_at ? "Deleted" : toLabel(link.status);
                    return (
                      <tr key={link.id} className="border-b">
                        <td className="px-2 py-2">
                          <div className="font-medium text-slate-900">
                            {vendor ? (
                              <Link href={`/vendors/${vendor.id}`} className="text-blue-700 hover:underline">
                                {vendor.name}
                              </Link>
                            ) : (
                              <span>Vendor #{link.vendor_id}</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{vendor?.sector || "-"}</div>
                        </td>
                        <td className="px-2 py-2"><StatusChip value={linkStatus} /></td>
                        <td className="px-2 py-2 text-slate-800">{toPriorityLabel(link.priority)}</td>
                        <td className="px-2 py-2">{vendor ? <StatusChip value={toLabel(vendor.status)} /> : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <UsersRound className="size-4 text-sky-700" />
            <h2 className="text-balance text-lg font-semibold text-slate-900">Contact Details</h2>
          </div>
          {isContactsLoading ? <p className="text-sm text-slate-600">Loading contacts...</p> : null}
          {!isContactsLoading && contacts.length === 0 ? (
            <p className="text-pretty text-sm text-slate-600">
              No contacts found.{" "}
              <Link href={`/clients/${rawId}`} className="font-medium text-blue-700 hover:underline">Add contact details</Link>.
            </p>
          ) : null}
          {!isContactsLoading && contacts.length > 0 ? (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="rounded border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">{contact.first_name} {contact.last_name}</p>
                  <p className="text-xs text-slate-600">{contact.email || "-"}</p>
                  <p className="text-xs text-slate-600">{contact.phone || "-"}</p>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </section>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <BriefcaseBusiness className="size-4 text-sky-700" />
          <h2 className="text-balance text-lg font-semibold text-slate-900">Jobs Posted So Far</h2>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {jobsByChannel.length > 0 ? jobsByChannel.map(([channel, count]) => (
            <span key={channel} className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-800">
              {toLabel(channel)}: <span className="tabular-nums">{count}</span>
            </span>
          )) : <span className="text-sm text-slate-600">No channel data yet.</span>}
        </div>

        {isJobsLoading || isClientLoading ? <p className="text-sm text-slate-600">Loading jobs history...</p> : null}
        {!isJobsLoading && relatedJobs.length === 0 ? (
          <p className="text-pretty text-sm text-slate-600">
            No jobs found for this client or its linked vendors.{" "}
            <Link href="/jobs" className="font-medium text-blue-700 hover:underline">Create a job</Link>.
          </p>
        ) : null}
        {!isJobsLoading && relatedJobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-2 py-2">Job ID</th>
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Intake Channel</th>
                  <th className="px-2 py-2">Posted Through</th>
                </tr>
              </thead>
              <tbody>
                {relatedJobs.map((job) => {
                  const postedThrough = job.origin_vendor_id
                    ? vendorById.get(job.origin_vendor_id)?.name || `Vendor #${job.origin_vendor_id}`
                    : "Direct Client";
                  return (
                    <tr key={job.id} className="border-b">
                      <td className="px-2 py-2 tabular-nums text-slate-800">{job.id}</td>
                      <td className="px-2 py-2 font-medium text-slate-900">
                        <Link href={`/jobs/${job.id}`} className="text-blue-700 hover:underline">{job.title}</Link>
                      </td>
                      <td className="px-2 py-2"><StatusChip value={toLabel(job.status)} /></td>
                      <td className="px-2 py-2 text-slate-700">{toLabel(job.intake_channel)}</td>
                      <td className="px-2 py-2 text-slate-700">{postedThrough}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <div className="mt-5 flex gap-2">
        <Link href={`/clients/${rawId}`} className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
          <Building2 className="mr-2 size-4" />
          Open Client Detail
        </Link>
        <Link href="/clients" className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
          Back to Clients
        </Link>
      </div>
    </div>
  );
}
