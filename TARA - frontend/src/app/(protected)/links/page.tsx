"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { PageHeader } from "@/components/common/page-header";
import { PaginationControls } from "@/components/common/pagination-controls";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api/http";
import { formatId } from "@/lib/utils/format";
import { queryKeys } from "@/lib/query-keys";
import { createLink, listLinks, restoreLink, updateLink } from "@/lib/services/links";

export default function LinksPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [filterClientId, setFilterClientId] = useState("");
  const [filterVendorId, setFilterVendorId] = useState("");

  const [clientId, setClientId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [status, setStatus] = useState("active");
  const [priority, setPriority] = useState(100);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.links.all, page, includeDeleted, filterClientId, filterVendorId],
    queryFn: () => {
      const parsedFilterClientId = filterClientId ? Number(filterClientId) : undefined;
      const parsedFilterVendorId = filterVendorId ? Number(filterVendorId) : undefined;

      return listLinks({
        page,
        pageSize,
        includeDeleted,
        clientId: parsedFilterClientId,
        vendorId: parsedFilterVendorId,
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: createLink,
    onSuccess: () => {
      setClientId("");
      setVendorId("");
      queryClient.invalidateQueries({ queryKey: queryKeys.links.all });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to create link")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, priority }: { id: number; status: string; priority: number }) =>
      updateLink(id, { status, priority }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.links.all }),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreLink,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.links.all }),
  });

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsedClientId = Number(clientId);
    const parsedVendorId = Number(vendorId);
    if (!Number.isInteger(parsedClientId) || parsedClientId < 1) {
      setError("Client ID must be a positive integer");
      return;
    }
    if (!Number.isInteger(parsedVendorId) || parsedVendorId < 1) {
      setError("Vendor ID must be a positive integer");
      return;
    }

    createMutation.mutate({
      client_id: parsedClientId,
      vendor_id: parsedVendorId,
      status,
      priority,
    });
  };

  return (
    <div>
      <PageHeader title="Client-Vendor Links" subtitle="Manage partner mappings and priority." />

      <Card className="mb-5">
        <h2 className="text-lg font-semibold">New Link</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-4" onSubmit={onCreate}>
          <div>
            <Label>Client ID</Label>
            <Input type="number" min={1} step={1} value={clientId} onChange={(e) => setClientId(e.target.value)} required />
          </div>
          <div>
            <Label>Vendor ID</Label>
            <Input type="number" min={1} step={1} value={vendorId} onChange={(e) => setVendorId(e.target.value)} required />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Input type="number" min={1} max={1000} value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          </div>
          <div className="sm:col-span-4">
            <Button type="submit" disabled={createMutation.isPending}>Create Link</Button>
          </div>
        </form>
        <ErrorBanner message={error} />
      </Card>

      <Card>
        <div className="mb-3 grid gap-3 sm:grid-cols-4">
          <div>
            <Label>Filter Client ID</Label>
            <Input type="number" min={1} step={1} value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)} />
          </div>
          <div>
            <Label>Filter Vendor ID</Label>
            <Input type="number" min={1} step={1} value={filterVendorId} onChange={(e) => setFilterVendorId(e.target.value)} />
          </div>
          <label className="mt-8 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
            Include deleted
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-2 py-2">Client</th>
                <th className="px-2 py-2">Vendor</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Priority</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="px-2 py-3" colSpan={5}>Loading...</td></tr>
              ) : (data?.items ?? []).map((link) => (
                <tr key={link.id} className="border-b">
                  <td className="px-2 py-2 text-xs">{formatId(link.client_id, "Client")}</td>
                  <td className="px-2 py-2 text-xs">{formatId(link.vendor_id, "Vendor")}</td>
                  <td className="px-2 py-2"><StatusChip value={link.status} /></td>
                  <td className="px-2 py-2">{link.priority}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" onClick={() => updateMutation.mutate({ id: link.id, status: "active", priority: link.priority })}>Set Active</Button>
                      <Button variant="ghost" onClick={() => updateMutation.mutate({ id: link.id, status: "inactive", priority: link.priority })}>Set Inactive</Button>
                      {link.deleted_at ? (
                        <Button variant="secondary" onClick={() => restoreMutation.mutate(link.id)}>Restore</Button>
                      ) : null}
                    </div>
                  </td>
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
