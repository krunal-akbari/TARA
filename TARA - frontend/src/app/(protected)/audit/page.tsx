"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { PaginationControls } from "@/components/common/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryKeys } from "@/lib/query-keys";
import { listActivityEvents } from "@/lib/services/audit";

export default function AuditPage() {
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: [...queryKeys.audit.all, entityType, entityId, page],
    queryFn: () =>
      listActivityEvents({
        entityType: entityType || undefined,
        entityId: entityId || undefined,
        page,
        pageSize,
      }),
  });

  return (
    <div>
      <PageHeader title="Audit" subtitle="Tenant-scoped activity timeline and filters." />

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Entity Type</Label>
            <Input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="job, client, candidate" />
          </div>
          <div>
            <Label>Entity ID</Label>
            <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="uuid" />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => {
                setPage(1);
                refetch();
              }}
            >
              Apply Filters
            </Button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-2 py-2">Entity</th>
                <th className="px-2 py-2">Event</th>
                <th className="px-2 py-2">Actor</th>
                <th className="px-2 py-2">Payload</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="px-2 py-3 text-slate-600" colSpan={4}>Loading...</td></tr>
              ) : (data?.items ?? []).map((event) => (
                <tr key={event.id} className="border-b align-top">
                  <td className="px-2 py-2 text-slate-700">{event.entity_type}:{event.entity_id}</td>
                  <td className="px-2 py-2">{event.event_type}</td>
                  <td className="px-2 py-2">{event.actor_user_id}</td>
                  <td className="px-2 py-2"><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(event.payload_json)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationControls page={page} pageSize={pageSize} total={data?.total ?? 0} onPageChange={setPage} />
      </Card>
    </div>
  );
}
