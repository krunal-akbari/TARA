"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Binoculars, Building2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { ListPageShell } from "@/components/common/list-page-shell";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useListPage } from "@/hooks/use-list-page";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/query-keys";
import { listClients } from "@/lib/services/clients";
import { createVendor, createVendorContact, deleteVendor, listVendors, restoreVendor } from "@/lib/services/vendors";
import { toTitleCase, lineAddress } from "@/lib/utils/format";
import { LINE_INPUT_CLASS, getRowClassName } from "@/lib/utils/table-styles";

export default function VendorsPage() {
  const NAME_MAX = 255;
  const ADDRESS_MAX = 512;
  const SECTOR_MAX = 128;

  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const list = useListPage();
  const { setIncludeDeleted } = list;
  useEffect(() => {
    setIncludeDeleted(true);
  }, [setIncludeDeleted]);

  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    title: "",
    client_name: "",
    email1: "",
    email2: "",
    direct_phone: "",
    mobile_phone: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    desired_categories: "",
    desired_skills: "",
    comments: "",
  });

  const [error, setError] = useState<string | null>(null);
  const ownerName = useMemo(() => {
    const full = `${session?.user?.first_name ?? ""} ${session?.user?.last_name ?? ""}`.trim();
    if (full) return full;
    const prefix = session?.user?.email?.split("@")[0] ?? "Current User";
    return toTitleCase(prefix);
  }, [session]);
  const vendorNamePreview = useMemo(
    () => [form.first_name.trim(), form.middle_name.trim(), form.last_name.trim()].filter(Boolean).join(" "),
    [form.first_name, form.middle_name, form.last_name],
  );

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.vendors.list(list.page, true, list.normalizedSearch),
    queryFn: () =>
      listVendors({
        page: list.page,
        pageSize: list.pageSize,
        includeDeleted: true,
        search: list.normalizedSearch || undefined,
      }),
  });

  const vendorItems = useMemo(() => data?.items ?? [], [data?.items]);
  const pagination = list.getPagination(data?.total ?? 0);
  const selection = list.getSelectionHelpers(vendorItems);

  const createVendorMutation = useMutation({ mutationFn: createVendor });

  const deleteMutation = useMutation({
    mutationFn: deleteVendor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all }),
    onError: (err) => setError(getApiErrorMessage(err, "Failed to delete vendor")),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreVendor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all }),
    onError: (err) => setError(getApiErrorMessage(err, "Failed to restore vendor")),
  });

  const resetCreateForm = () => {
    setForm({
      first_name: "",
      middle_name: "",
      last_name: "",
      title: "",
      client_name: "",
      email1: "",
      email2: "",
      direct_phone: "",
      mobile_phone: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      zip: "",
      country: "United States",
      desired_categories: "",
      desired_skills: "",
      comments: "",
    });
    list.setShowCreate(false);
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const firstName = form.first_name.trim();
    const middleName = form.middle_name.trim();
    const lastName = form.last_name.trim();
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

    const payload = {
      name: fullName,
      status: "active",
      address: lineAddress([
        form.address1,
        form.address2,
        [form.city.trim(), form.state.trim(), form.zip.trim()].filter(Boolean).join(" "),
        form.country,
      ]),
      sector: form.desired_categories.trim() ? form.desired_categories.trim().slice(0, SECTOR_MAX) : null,
    };

    if (!firstName || !lastName) {
      setError("First Name and Last Name are required");
      return;
    }
    if (!form.email1.trim()) {
      setError("Email 1 is required");
      return;
    }

    try {
      let matchedClientId: number | null = null;
      const normalizedClientName = form.client_name.trim();
      if (normalizedClientName) {
        const result = await listClients({
          page: 1,
          pageSize: 50,
          includeDeleted: false,
          search: normalizedClientName,
        });
        const exact = result.items.find((item) => item.name.trim().toLowerCase() === normalizedClientName.toLowerCase());
        matchedClientId = exact?.id ?? null;
      }

      const createdVendor = await createVendorMutation.mutateAsync({
        ...payload,
        client_ids: matchedClientId ? [matchedClientId] : null,
      });
      await createVendorContact(createdVendor.id, {
        first_name: firstName,
        last_name: lastName,
        email: form.email1.trim(),
        phone: form.direct_phone.trim() || form.mobile_phone.trim() || null,
      });

      resetCreateForm();
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.links.all });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create vendor"));
    }
  };

  const createFormContent = (
    <form className="space-y-4" onSubmit={onCreate}>
      <section className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Contact Information (Vendor Name)</div>
        <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Vendor Name</Label><Input className={LINE_INPUT_CLASS} value={vendorNamePreview} readOnly /></div>
          <div><Label>First Name *</Label><Input className={LINE_INPUT_CLASS} value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label>Middle Name</Label><Input className={LINE_INPUT_CLASS} value={form.middle_name} onChange={(e) => setForm((p) => ({ ...p, middle_name: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label>Last Name *</Label><Input className={LINE_INPUT_CLASS} value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label>Title</Label><Input className={LINE_INPUT_CLASS} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div className="sm:col-span-2"><Label>Client</Label><Input className={LINE_INPUT_CLASS} value={form.client_name} onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))} placeholder="Exact client name" maxLength={NAME_MAX} /></div>
        </div>
      </section>

      <section className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Contact Info</div>
        <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
          <div><Label>Email 1 *</Label><Input className={LINE_INPUT_CLASS} value={form.email1} onChange={(e) => setForm((p) => ({ ...p, email1: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label>Email 2</Label><Input className={LINE_INPUT_CLASS} value={form.email2} onChange={(e) => setForm((p) => ({ ...p, email2: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label>Direct Phone</Label><Input className={LINE_INPUT_CLASS} value={form.direct_phone} onChange={(e) => setForm((p) => ({ ...p, direct_phone: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label>Mobile Phone</Label><Input className={LINE_INPUT_CLASS} value={form.mobile_phone} onChange={(e) => setForm((p) => ({ ...p, mobile_phone: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label>Address</Label><Input className={LINE_INPUT_CLASS} value={form.address1} onChange={(e) => setForm((p) => ({ ...p, address1: e.target.value }))} maxLength={ADDRESS_MAX} /></div>
          <div><Label>Address2</Label><Input className={LINE_INPUT_CLASS} value={form.address2} onChange={(e) => setForm((p) => ({ ...p, address2: e.target.value }))} maxLength={ADDRESS_MAX} /></div>
          <div><Label>City</Label><Input className={LINE_INPUT_CLASS} value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label>State</Label><Input className={LINE_INPUT_CLASS} value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label>Zip</Label><Input className={LINE_INPUT_CLASS} value={form.zip} onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label>Country</Label><Input className={LINE_INPUT_CLASS} value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div className="sm:col-span-2"><Label>Desired Categories</Label><Input className={LINE_INPUT_CLASS} value={form.desired_categories} onChange={(e) => setForm((p) => ({ ...p, desired_categories: e.target.value }))} maxLength={SECTOR_MAX} /></div>
          <div className="sm:col-span-2"><Label>Desired Skills</Label><Input className={LINE_INPUT_CLASS} value={form.desired_skills} onChange={(e) => setForm((p) => ({ ...p, desired_skills: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div className="sm:col-span-2"><Label>General Contact Comments</Label><Textarea className="min-h-20 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:ring-0" value={form.comments} onChange={(e) => setForm((p) => ({ ...p, comments: e.target.value }))} /></div>
          <div className="sm:col-span-2"><Label>Owner Full Name</Label><Input className={LINE_INPUT_CLASS} value={ownerName} readOnly /></div>
        </div>
      </section>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={() => list.setShowCreate(false)}>Cancel</Button>
        <Button type="submit" disabled={createVendorMutation.isPending}>
          {createVendorMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );

  return (
    <ListPageShell
      icon={<Building2 className="size-5 text-sky-600" />}
      title="Vendors"
      search={list.search}
      onSearchChange={list.setSearch}
      includeDeleted={true}
      onIncludeDeletedChange={() => undefined}
      showIncludeDeleted={false}
      addButtonLabel="Add Vendor"
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
              <input type="checkbox" checked={selection.allSelected} onChange={selection.toggleSelectAll} aria-label="Select all vendors" />
            </th>
            <th className="w-24 px-3 py-2 font-medium text-slate-900">ID</th>
            <th className="px-3 py-2 font-medium text-slate-900">Vendor Name</th>
            <th className="w-40 px-3 py-2 font-medium text-slate-900">Status</th>
            <th className="w-52 px-3 py-2 font-medium text-slate-900">Sector</th>
            <th className="w-[26rem] px-3 py-2 font-medium text-slate-900">Address</th>
            <th className="w-28 px-3 py-2 font-medium text-slate-900">Owner</th>
            <th className="w-40 px-3 py-2 font-medium text-slate-900">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td className="px-3 py-4 text-slate-600" colSpan={8}>Loading...</td></tr>
          ) : null}

          {!isLoading && vendorItems.length === 0 ? (
            <tr><td className="px-3 py-4 text-slate-600" colSpan={8}>No vendors found.</td></tr>
          ) : null}

          {vendorItems.map((vendor, index) => (
            <tr key={vendor.id} className={getRowClassName(index)}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={list.selectedIds.has(vendor.id)}
                    onChange={() => selection.toggleSelectOne(vendor.id)}
                    aria-label={`Select vendor ${vendor.name}`}
                  />
                  <Link
                    href={`/vendors/${vendor.id}`}
                    className="text-slate-500 hover:text-blue-700"
                    aria-label={`View details for vendor ${vendor.name}`}
                  >
                    <Binoculars className="size-4" />
                  </Link>
                </div>
              </td>
              <td className="px-3 py-2 tabular-nums text-slate-800">{vendor.id}</td>
              <td className="px-3 py-2">
                <Link href={`/vendors/${vendor.id}`} className="font-medium text-blue-700 hover:underline">
                  {vendor.name}
                </Link>
              </td>
              <td className="px-3 py-2"><StatusChip value={vendor.status} /></td>
              <td className="px-3 py-2 text-slate-800">{vendor.sector ?? "-"}</td>
              <td className="max-w-[26rem] truncate px-3 py-2 text-slate-800">{vendor.address ?? "-"}</td>
              <td className="px-3 py-2 tabular-nums text-slate-800">{vendor.owner_user_id}</td>
              <td className="px-3 py-2">
                {vendor.deleted_at ? (
                  <Button variant="secondary" onClick={() => restoreMutation.mutate(vendor.id)}>Restore</Button>
                ) : (
                  <Button variant="danger" onClick={() => deleteMutation.mutate(vendor.id)}>Delete</Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ListPageShell>
  );
}
