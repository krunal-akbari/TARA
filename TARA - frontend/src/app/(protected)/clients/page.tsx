"use client";

import Link from "next/link";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Binoculars, Building2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { ListPageShell } from "@/components/common/list-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useListPage } from "@/hooks/use-list-page";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/query-keys";
import { createClient, createClientContact, listClients } from "@/lib/services/clients";
import { listLinks } from "@/lib/services/links";
import { listVendors } from "@/lib/services/vendors";
import { toTitleCase, lineAddress } from "@/lib/utils/format";
import { LINE_INPUT_CLASS, getRowClassName } from "@/lib/utils/table-styles";

function toDisplayStatus(status: string) {
  if (status === "active") return "Active Account";
  if (status === "inactive") return "Qualified Lead";
  return toTitleCase(status);
}

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const list = useListPage();

  const ownerName = useMemo(() => {
    const full = `${session?.user?.first_name ?? ""} ${session?.user?.last_name ?? ""}`.trim();
    if (full) return full;
    const prefix = session?.user?.email?.split("@")[0] ?? "Current User";
    return toTitleCase(prefix);
  }, [session]);

  const [vendorSearch, setVendorSearch] = useState("");

  const [clientForm, setClientForm] = useState({
    name: "",
    parent_company: "",
    category: "",
    type: "end_client",
    website: "",
    year_founded: "",
    ownership: "",
    company_overview: "",
    company_description: "",
    standard_perm_fee: "",
    offices: "",
    culture_perks: "",
    main_phone: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    contact_first_name: "",
    contact_last_name: "",
    contact_email: "",
    work_number: "",
    cell_no: "",
    vendor_id: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [savingClient, setSavingClient] = useState(false);

  const normalizedVendorSearch = vendorSearch.trim();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.clients.list(list.page, true, list.normalizedSearch),
    queryFn: () =>
      listClients({
        page: list.page,
        pageSize: list.pageSize,
        includeDeleted: true,
        search: list.normalizedSearch || undefined,
      }),
  });
  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ["vendor-options-for-client-form", normalizedVendorSearch],
    queryFn: () =>
      listVendors({
        page: 1,
        pageSize: 25,
        includeDeleted: false,
        search: normalizedVendorSearch,
      }),
    enabled: list.showCreate && clientForm.type === "vendor" && normalizedVendorSearch.length > 0,
  });
  const vendorOptions = useMemo(() => vendorsData?.items ?? [], [vendorsData?.items]);

  const clientItems = useMemo(() => data?.items ?? [], [data?.items]);

  const partnerCountQueries = useQueries({
    queries: clientItems.map((client) => ({
      queryKey: queryKeys.clients.linkCount(client.id),
      queryFn: () => listLinks({ page: 1, pageSize: 1, includeDeleted: false, clientId: client.id }),
      staleTime: 30000,
    })),
  });

  const partnerCountById = useMemo(() => {
    const map = new Map<number, number>();
    clientItems.forEach((client, index) => map.set(client.id, partnerCountQueries[index]?.data?.total ?? 0));
    return map;
  }, [clientItems, partnerCountQueries]);

  const pagination = list.getPagination(data?.total ?? 0);
  const selection = list.getSelectionHelpers(clientItems);

  const resetClientForm = () => {
    setClientForm({
      name: "",
      parent_company: "",
      category: "",
      type: "end_client",
      website: "",
      year_founded: "",
      ownership: "",
      company_overview: "",
      company_description: "",
      standard_perm_fee: "",
      offices: "",
      culture_perks: "",
      main_phone: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      zip: "",
      country: "United States",
      contact_first_name: "",
      contact_last_name: "",
      contact_email: "",
      work_number: "",
      cell_no: "",
      vendor_id: "",
    });
  };

  const onCreateClient = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!clientForm.name.trim()) return setError("Client Name is required");
    if (!clientForm.category.trim()) return setError("Category is required");
    const selectedVendorId = clientForm.type === "vendor" ? Number(clientForm.vendor_id) : null;
    if (clientForm.type === "vendor" && (!selectedVendorId || Number.isNaN(selectedVendorId))) {
      return setError("Vendor is required when Type is Vendor");
    }

    setSavingClient(true);
    try {
      const created = await createClient({
        name: clientForm.name.trim(),
        status: "active",
        vendor_id: selectedVendorId,
        sector: clientForm.category.trim() || null,
        address: lineAddress([
          clientForm.address1,
          clientForm.address2,
          [clientForm.city.trim(), clientForm.state.trim(), clientForm.zip.trim()].filter(Boolean).join(" "),
          clientForm.country,
        ]),
      });

      if (clientForm.contact_first_name.trim() && clientForm.contact_last_name.trim()) {
        await createClientContact(created.id, {
          first_name: clientForm.contact_first_name.trim(),
          last_name: clientForm.contact_last_name.trim(),
          email: clientForm.contact_email.trim() || null,
          phone: clientForm.work_number.trim() || clientForm.cell_no.trim() || null,
        });
      }

      resetClientForm();
      setVendorSearch("");
      list.setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.links.all });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create client"));
    } finally {
      setSavingClient(false);
    }
  };

  const createFormContent = (
    <div className="rounded border border-slate-200 bg-white p-4">
      <form className="space-y-4" onSubmit={onCreateClient}>
        <div className="flex items-center gap-2 border-b border-sky-300 pb-2 text-lg font-semibold"><Building2 className="size-5 text-sky-600" />Add Client</div>
        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Basic Information</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
            <div><Label>Client Name *</Label><Input className={LINE_INPUT_CLASS} value={clientForm.name} onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Category *</Label><Input className={LINE_INPUT_CLASS} value={clientForm.category} onChange={(e) => setClientForm((p) => ({ ...p, category: e.target.value }))} /></div>
            <div><Label>Website</Label><Input className={LINE_INPUT_CLASS} value={clientForm.website} onChange={(e) => setClientForm((p) => ({ ...p, website: e.target.value }))} /></div>
            <div>
              <Label>Type *</Label>
              <Select
                className={LINE_INPUT_CLASS}
                value={clientForm.type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setClientForm((p) => ({ ...p, type: nextType, vendor_id: nextType === "vendor" ? p.vendor_id : "" }));
                  setVendorSearch("");
                }}
              >
                <option value="end_client">End Client</option>
                <option value="vendor">Vendor</option>
              </Select>
            </div>
            {clientForm.type === "vendor" ? (
              <div>
                <Label>Vendor *</Label>
                <Input
                  className={LINE_INPUT_CLASS}
                  value={vendorSearch}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setClientForm((p) => ({ ...p, vendor_id: "" }));
                  }}
                  placeholder="Type vendor name"
                />
                {normalizedVendorSearch.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">Start typing to search vendors.</p>
                ) : (
                  <div className="mt-1 max-h-40 overflow-auto rounded border border-slate-200 bg-white">
                    {vendorsLoading ? <p className="px-3 py-2 text-sm text-slate-500">Searching vendors...</p> : null}
                    {!vendorsLoading && vendorOptions.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">No vendors found.</p> : null}
                    {!vendorsLoading && vendorOptions.map((vendor) => (
                      <button
                        key={vendor.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setClientForm((p) => ({ ...p, vendor_id: String(vendor.id) }));
                          setVendorSearch(vendor.name);
                        }}
                      >
                        {vendor.name}
                      </button>
                    ))}
                  </div>
                )}
                {clientForm.vendor_id ? <p className="mt-1 text-xs text-emerald-700">Selected Vendor ID: {clientForm.vendor_id}</p> : null}
              </div>
            ) : null}
            <div className="sm:col-span-2"><Label>Company Description</Label><Textarea className="min-h-20 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:ring-0" value={clientForm.company_description} onChange={(e) => setClientForm((p) => ({ ...p, company_description: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Address</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <Label>Address</Label>
              <Input className={LINE_INPUT_CLASS} value={clientForm.address1} onChange={(e) => setClientForm((p) => ({ ...p, address1: e.target.value }))} />
            </div>
            <div className="sm:col-span-3">
              <Label>Address2</Label>
              <Input className={LINE_INPUT_CLASS} value={clientForm.address2} onChange={(e) => setClientForm((p) => ({ ...p, address2: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>City</Label>
              <Input className={LINE_INPUT_CLASS} value={clientForm.city} onChange={(e) => setClientForm((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>State</Label>
              <Input className={LINE_INPUT_CLASS} value={clientForm.state} onChange={(e) => setClientForm((p) => ({ ...p, state: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Zip</Label>
              <Input className={LINE_INPUT_CLASS} value={clientForm.zip} onChange={(e) => setClientForm((p) => ({ ...p, zip: e.target.value }))} />
            </div>
            <div className="sm:col-span-6">
              <Label>Country</Label>
              <Input className={LINE_INPUT_CLASS} value={clientForm.country} onChange={(e) => setClientForm((p) => ({ ...p, country: e.target.value }))} />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Contact Info</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
            <div><Label>Contact Person First Name</Label><Input className={LINE_INPUT_CLASS} value={clientForm.contact_first_name} onChange={(e) => setClientForm((p) => ({ ...p, contact_first_name: e.target.value }))} /></div>
            <div><Label>Contact Person Last Name</Label><Input className={LINE_INPUT_CLASS} value={clientForm.contact_last_name} onChange={(e) => setClientForm((p) => ({ ...p, contact_last_name: e.target.value }))} /></div>
            <div><Label>Email</Label><Input className={LINE_INPUT_CLASS} value={clientForm.contact_email} onChange={(e) => setClientForm((p) => ({ ...p, contact_email: e.target.value }))} /></div>
            <div><Label>Work Number</Label><Input className={LINE_INPUT_CLASS} value={clientForm.work_number} onChange={(e) => setClientForm((p) => ({ ...p, work_number: e.target.value }))} /></div>
            <div><Label>Cell Number</Label><Input className={LINE_INPUT_CLASS} value={clientForm.cell_no} onChange={(e) => setClientForm((p) => ({ ...p, cell_no: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Owner</div>
          <div className="grid gap-3 px-3 py-3">
            <div><Label>Owner Full Name</Label><Input className={LINE_INPUT_CLASS} value={ownerName} readOnly /></div>
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" onClick={() => list.setShowCreate(false)}>Cancel</Button><Button type="submit" disabled={savingClient}>{savingClient ? "Saving..." : "Save"}</Button></div>
      </form>
    </div>
  );

  return (
    <ListPageShell
      icon={<Building2 className="size-5 text-sky-600" />}
      title="Clients"
      search={list.search}
      onSearchChange={list.setSearch}
      includeDeleted
      onIncludeDeletedChange={() => {}}
      showIncludeDeleted={false}
      addButtonLabel="Add Client"
      showCreate={list.showCreate}
      onToggleCreate={list.toggleShowCreate}
      createForm={createFormContent}
      error={<ErrorBanner message={error} />}
      pagination={pagination}
    >
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-slate-300">
            <th className="w-16 px-3 py-2"><input type="checkbox" checked={selection.allSelected} onChange={selection.toggleSelectAll} aria-label="Select all clients" /></th>
            <th className="w-24 px-3 py-2 font-medium text-slate-900">ID</th>
            <th className="px-3 py-2 font-medium text-slate-900">Client Name</th>
            <th className="w-52 px-3 py-2 font-medium text-slate-900">Business Partners</th>
            <th className="w-64 px-3 py-2 font-medium text-slate-900">Status</th>
            <th className="w-64 px-3 py-2 font-medium text-slate-900">Type</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? <tr><td className="px-3 py-4 text-slate-600" colSpan={6}>Loading...</td></tr> : null}
          {!isLoading && clientItems.length === 0 ? <tr><td className="px-3 py-4 text-slate-600" colSpan={6}>No clients found.</td></tr> : null}
          {clientItems.map((client, index) => {
            const partnerCount = partnerCountById.get(client.id) ?? 0;
            const typeLabel = partnerCount > 0 ? "Business Partner" : "End Client";
            const statusLabel = toDisplayStatus(client.status);
            return (
              <tr key={client.id} className={getRowClassName(index)}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={list.selectedIds.has(client.id)}
                      onChange={() => selection.toggleSelectOne(client.id)}
                      aria-label={`Select client ${client.name}`}
                    />
                    <Link
                      href={`/clients/${client.id}/network`}
                      className="text-slate-500 hover:text-blue-700"
                      aria-label={`View network details for client ${client.name}`}
                    >
                      <Binoculars className="size-4" />
                    </Link>
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-800">{client.id}</td>
                <td className="px-3 py-2"><Link href={`/clients/${client.id}`} className="font-medium text-blue-700 hover:underline">{client.name}</Link></td>
                <td className="px-3 py-2 tabular-nums text-blue-700">{partnerCount}</td>
                <td className="px-3 py-2 text-slate-800">{statusLabel}</td>
                <td className="px-3 py-2 text-slate-800">{typeLabel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ListPageShell>
  );
}
