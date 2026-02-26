"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { ContactManager } from "@/components/common/contact-manager";
import { ErrorBanner } from "@/components/common/error-banner";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import { createLink, deleteLink, listLinks, restoreLink, updateLink } from "@/lib/services/links";
import {
  createVendorContact,
  deleteVendor,
  deleteVendorContact,
  getVendor,
  listVendorContacts,
  restoreVendor,
  updateVendor,
  updateVendorContact,
} from "@/lib/services/vendors";
import { cn } from "@/lib/utils/cn";
import { toTitleCase } from "@/lib/utils/format";

type VendorTabId = "overview" | "edit" | "links" | "contacts";

function toLabel(value: string) {
  return toTitleCase(value.replaceAll("_", " "));
}

function VendorLinkManager({ vendorId }: { vendorId: number }) {
  const queryClient = useQueryClient();
  const [linkClientId, setLinkClientId] = useState("");
  const [linkStatus, setLinkStatus] = useState("active");
  const [includeDeletedLinks, setIncludeDeletedLinks] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const { data: linksData, isLoading: isLoadingLinks } = useQuery({
    queryKey: queryKeys.vendors.links(vendorId, includeDeletedLinks),
    queryFn: () =>
      listLinks({
        page: 1,
        pageSize: 100,
        includeDeleted: includeDeletedLinks,
        vendorId,
      }),
  });

  const createLinkMutation = useMutation({
    mutationFn: (payload: { client_id: number; status: string }) =>
      createLink({
        client_id: payload.client_id,
        vendor_id: vendorId,
        status: payload.status,
      }),
    onSuccess: () => {
      setLinkClientId("");
      setLinkStatus("active");
      setLinkError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.links(vendorId, includeDeletedLinks) });
    },
    onError: (err) => setLinkError(getApiErrorMessage(err, "Failed to create link")),
  });

  const updateLinkMutation = useMutation({
    mutationFn: ({ linkId, status }: { linkId: number; status: string }) => updateLink(linkId, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vendors.links(vendorId, includeDeletedLinks) }),
    onError: (err) => setLinkError(getApiErrorMessage(err, "Failed to update link")),
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: number) => deleteLink(linkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vendors.links(vendorId, includeDeletedLinks) }),
    onError: (err) => setLinkError(getApiErrorMessage(err, "Failed to delete link")),
  });

  const restoreLinkMutation = useMutation({
    mutationFn: (linkId: number) => restoreLink(linkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vendors.links(vendorId, includeDeletedLinks) }),
    onError: (err) => setLinkError(getApiErrorMessage(err, "Failed to restore link")),
  });

  const onCreateLink = (event: FormEvent) => {
    event.preventDefault();
    setLinkError(null);

    const parsedClientId = Number(linkClientId);
    if (!Number.isInteger(parsedClientId) || parsedClientId < 1) {
      setLinkError("Client ID must be a positive integer");
      return;
    }

    createLinkMutation.mutate({
      client_id: parsedClientId,
      status: linkStatus,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Vendor Links</h2>
        <p className="mt-1 text-sm text-slate-600">Map this vendor to clients and manage link state.</p>
      </div>

      <form className="grid gap-3 rounded border border-slate-200 p-3 sm:grid-cols-3" onSubmit={onCreateLink}>
        <div>
          <Label>Client ID</Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={linkClientId}
            onChange={(e) => setLinkClientId(e.target.value)}
            placeholder="Required client ID"
            required
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={linkStatus} onChange={(e) => setLinkStatus(e.target.value)}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={createLinkMutation.isPending}>
            Create Link
          </Button>
        </div>
      </form>

      <ErrorBanner message={linkError} />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeDeletedLinks}
          onChange={(e) => setIncludeDeletedLinks(e.target.checked)}
        />
        Include deleted links
      </label>

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b text-left text-slate-500">
              <th className="px-2 py-2">Link ID</th>
              <th className="px-2 py-2">Client ID</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingLinks ? (
              <tr><td className="px-2 py-3 text-slate-600" colSpan={4}>Loading vendor links...</td></tr>
            ) : null}

            {!isLoadingLinks && (linksData?.items ?? []).length === 0 ? (
              <tr><td className="px-2 py-3 text-slate-600" colSpan={4}>No links found for this vendor.</td></tr>
            ) : null}

            {(linksData?.items ?? []).map((link) => (
              <tr key={link.id} className="border-b">
                <td className="px-2 py-2 tabular-nums">{link.id}</td>
                <td className="px-2 py-2 tabular-nums">{link.client_id}</td>
                <td className="px-2 py-2">{link.status}</td>
                <td className="px-2 py-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => updateLinkMutation.mutate({ linkId: link.id, status: "active" })}
                    >
                      Set Active
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => updateLinkMutation.mutate({ linkId: link.id, status: "inactive" })}
                    >
                      Set Inactive
                    </Button>
                    {link.deleted_at ? (
                      <Button type="button" variant="secondary" onClick={() => restoreLinkMutation.mutate(link.id)}>
                        Restore
                      </Button>
                    ) : (
                      <Button type="button" variant="danger" onClick={() => deleteLinkMutation.mutate(link.id)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function VendorDetailPage() {
  const NAME_MAX = 255;
  const ADDRESS_MAX = 512;
  const SECTOR_MAX = 128;

  const params = useParams<{ id: string }>();
  const id = params.id;
  const parsedVendorId = Number(id);
  const hasValidId = Number.isInteger(parsedVendorId) && parsedVendorId > 0;
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [sector, setSector] = useState("");
  const [statusValue, setStatusValue] = useState<"active" | "inactive">("active");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<VendorTabId>("overview");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.vendors.detail(id),
    queryFn: () => getVendor(id, true),
    enabled: hasValidId,
  });

  const { data: contactList = [] } = useQuery({
    queryKey: queryKeys.vendors.contacts(id),
    queryFn: () => listVendorContacts(id),
    enabled: hasValidId,
  });

  const { data: activeLinksCount = 0 } = useQuery({
    queryKey: [...queryKeys.vendors.links(id, false), "count"],
    queryFn: async () => {
      const response = await listLinks({
        page: 1,
        pageSize: 1,
        includeDeleted: false,
        vendorId: parsedVendorId,
      });
      return response.total;
    },
    enabled: hasValidId,
  });

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setAddress(data.address ?? "");
    setSector(data.sector ?? "");
    setStatusValue(data.status === "inactive" ? "inactive" : "active");
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (payload: { name: string; status: string; address: string | null; sector: string | null }) =>
      updateVendor(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to update vendor")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteVendor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vendors.detail(id) }),
    onError: (err) => setError(getApiErrorMessage(err, "Failed to delete vendor")),
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreVendor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vendors.detail(id) }),
    onError: (err) => setError(getApiErrorMessage(err, "Failed to restore vendor")),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    updateMutation.mutate({
      name: trimmedName,
      status: statusValue,
      address: address.trim() ? address.trim() : null,
      sector: sector.trim() ? sector.trim() : null,
    });
  };

  const contactService = useMemo(
    () => ({
      list: () => listVendorContacts(id),
      create: (payload: { first_name: string; last_name: string; email: string | null; phone: string | null }) =>
        createVendorContact(id, payload),
      update: (
        contactId: number,
        payload: { first_name: string; last_name: string; email: string | null; phone: string | null },
      ) => updateVendorContact(id, contactId, payload),
      delete: (contactId: number) => deleteVendorContact(id, contactId),
    }),
    [id],
  );

  const tabs = useMemo(
    () => [
      { id: "overview" as const, label: "Overview" },
      { id: "edit" as const, label: "Edit" },
      { id: "links" as const, label: `Links (${activeLinksCount})` },
      { id: "contacts" as const, label: `Contacts (${contactList.length})` },
    ],
    [activeLinksCount, contactList.length],
  );

  const overviewStatus = data?.deleted_at ? "Deleted" : data ? toLabel(data.status) : "-";

  if (!hasValidId) {
    return <ErrorBanner message="Invalid vendor id." />;
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      {isLoading ? (
        <Card>
          <p className="text-sm text-slate-600">Loading vendor details...</p>
        </Card>
      ) : null}

      {data ? (
        <>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Building2 className="size-5 text-sky-700" />
                  <p className="text-3xl font-semibold tabular-nums text-slate-900">{data.id}</p>
                  <p className="text-2xl text-slate-500">|</p>
                  <p className="text-balance text-3xl font-semibold text-slate-900">{data.name}</p>
                </div>
                <StatusChip value={overviewStatus} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <p className="text-xs font-medium text-slate-500">ID</p>
                  <p className="mt-1 tabular-nums text-slate-900">{data.id}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Vendor Name</p>
                  <p className="mt-1 text-slate-900">{data.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Status</p>
                  <p className="mt-1 text-slate-900">{overviewStatus}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Category</p>
                  <p className="mt-1 text-slate-900">{data.sector || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Owner</p>
                  <p className="mt-1 tabular-nums text-slate-900">{data.owner_user_id}</p>
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
            <Card className="overflow-hidden p-0">
              <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Vendor Overview</div>
              <div className="grid gap-0 text-sm">
                <div className="grid grid-cols-2 border-b border-slate-200 px-3 py-2"><span className="text-slate-700">Address</span><span className="text-slate-900">{data.address || "-"}</span></div>
                <div className="grid grid-cols-2 border-b border-slate-200 px-3 py-2"><span className="text-slate-700">Sector</span><span className="text-slate-900">{data.sector || "-"}</span></div>
                <div className="grid grid-cols-2 border-b border-slate-200 px-3 py-2"><span className="text-slate-700">Linked Clients</span><span className="tabular-nums text-slate-900">{activeLinksCount}</span></div>
                <div className="grid grid-cols-2 border-b border-slate-200 px-3 py-2"><span className="text-slate-700">Contacts</span><span className="tabular-nums text-slate-900">{contactList.length}</span></div>
                <div className="grid grid-cols-2 px-3 py-2"><span className="text-slate-700">Deleted At</span><span className="text-slate-900">{data.deleted_at || "-"}</span></div>
              </div>
            </Card>
          ) : null}

          {activeTab === "edit" ? (
            <Card>
              <form className="grid gap-3 sm:max-w-2xl sm:grid-cols-2" onSubmit={onSubmit}>
                <div>
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={NAME_MAX}
                    placeholder="Vendor name"
                    required
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value === "inactive" ? "inactive" : "active")}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </div>
                <div>
                  <Label>Address</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    maxLength={ADDRESS_MAX}
                    placeholder="Street / postal address"
                  />
                </div>
                <div>
                  <Label>Sector</Label>
                  <Input
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    maxLength={SECTOR_MAX}
                    placeholder="Industry sector"
                  />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={updateMutation.isPending}>Save</Button>
                  {data.deleted_at ? (
                    <Button type="button" variant="secondary" onClick={() => restoreMutation.mutate()}>Restore</Button>
                  ) : (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => {
                        if (!window.confirm(`Delete vendor "${data.name}"?`)) return;
                        deleteMutation.mutate();
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          ) : null}

          {activeTab === "links" ? (
            <Card>
              <VendorLinkManager vendorId={parsedVendorId} />
            </Card>
          ) : null}

          {activeTab === "contacts" ? (
            <Card>
              <ContactManager
                queryKey={queryKeys.vendors.contacts(id)}
                service={contactService}
                title="Vendor Contacts"
              />
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
