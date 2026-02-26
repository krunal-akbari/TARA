"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { PageHeader } from "@/components/common/page-header";
import { PaginationControls } from "@/components/common/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import { createTransition, currentRoute, listTransitions } from "@/lib/services/routing";
import { ROUTE_NODE_TYPES } from "@/lib/types/forms";

export default function RoutingPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [toNodeType, setToNodeType] = useState<(typeof ROUTE_NODE_TYPES)[number]>("client");
  const [toNodeId, setToNodeId] = useState("");
  const [reason, setReason] = useState("manual_override");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-route`,
  );

  const { data: current } = useQuery({
    queryKey: queryKeys.jobs.routing(jobId),
    queryFn: () => currentRoute(jobId),
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.jobs.transitions(jobId, page),
    queryFn: () => listTransitions(jobId, { page, pageSize }),
  });

  const createMutation = useMutation({
    mutationFn: (nodeId: number) =>
      createTransition(
        jobId,
        { to_node_type: toNodeType, to_node_id: nodeId, reason, notes: notes || null },
        idempotencyKey,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.routing(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.transitions(jobId, page) });
      setIdempotencyKey(typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-route`);
      setNotes("");
      setError(null);
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to create route transition")),
  });

  const currentText = useMemo(() => {
    if (!current) return "No current route yet.";
    return `${current.current_node_type}:${current.current_node_id} (seq ${current.last_transition_seq})`;
  }, [current]);

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsedNodeId = Number(toNodeId);
    if (!Number.isInteger(parsedNodeId) || parsedNodeId < 1) {
      setError("Node ID must be a positive integer");
      return;
    }

    createMutation.mutate(parsedNodeId);
  };

  return (
    <div>
      <PageHeader title="Job Routing" subtitle="Create immutable transitions and inspect current route snapshot." />

      <Card className="mb-5">
        <h2 className="text-lg font-semibold">Current Route</h2>
        <p className="mt-2 text-sm text-slate-700">{currentText}</p>
      </Card>

      <Card className="mb-5">
        <h2 className="text-lg font-semibold">Create Transition</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <div>
            <Label>Node Type</Label>
            <Select value={toNodeType} onChange={(e) => setToNodeType(e.target.value as (typeof ROUTE_NODE_TYPES)[number])}>
              {ROUTE_NODE_TYPES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Node ID</Label>
            <Input type="number" min={1} step={1} value={toNodeId} onChange={(e) => setToNodeId(e.target.value)} required />
          </div>
          <div>
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div>
            <Label>Idempotency Key</Label>
            <Input value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} required />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={createMutation.isPending}>Create Transition</Button>
          </div>
        </form>
        <ErrorBanner message={error} />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Transition Timeline</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-2 py-2">Seq</th>
                <th className="px-2 py-2">From</th>
                <th className="px-2 py-2">To</th>
                <th className="px-2 py-2">Reason</th>
                <th className="px-2 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="px-2 py-3" colSpan={5}>Loading...</td></tr>
              ) : (data?.items ?? []).map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="px-2 py-2">{item.sequence_no}</td>
                  <td className="px-2 py-2 text-xs">{item.from_node_type ? `${item.from_node_type}:${item.from_node_id}` : "-"}</td>
                  <td className="px-2 py-2 text-xs">{item.to_node_type}:{item.to_node_id}</td>
                  <td className="px-2 py-2">{item.reason}</td>
                  <td className="px-2 py-2 text-xs">{item.occurred_at}</td>
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
