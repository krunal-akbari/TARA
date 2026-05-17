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
import { useUserNameMap } from "@/hooks/use-user-name-map";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/query-keys";
import { listClients } from "@/lib/services/clients";
import { createVendor, listVendors, restoreVendor } from "@/lib/services/vendors";
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
    name: "",
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
  const vendorOwnerIds = useMemo(() => vendorItems.map((vendor) => vendor.owner_user_id), [vendorItems]);
  const { getUserFirstName } = useUserNameMap(vendorOwnerIds);
  const pagination = list.getPagination(data?.total ?? 0);
  const selection = list.getSelectionHelpers(vendorItems);

  const createVendorMutation = useMutation({ mutationFn: createVendor });

  const restoreMutation = useMutation({
    mutationFn: restoreVendor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all }),
    onError: (err) => setError(getApiErrorMessage(err, "Failed to restore business partner")),
  });

  const resetCreateForm = () => {
    setForm({
      name: "",
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

    const businessPartnerName = form.name.trim();

    const payload = {
      name: businessPartnerName,
      status: "active",
      address: lineAddress([
        form.address1,
        form.address2,
        [form.city.trim(), form.state.trim(), form.zip.trim()].filter(Boolean).join(" "),
        form.country,
      ]),
      sector: form.desired_categories.trim() ? form.desired_categories.trim().slice(0, SECTOR_MAX) : null,
    };

    if (!businessPartnerName) {
      setError("Business Partner Name is required");
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

      await createVendorMutation.mutateAsync({
        ...payload,
        client_ids: matchedClientId ? [matchedClientId] : null,
      });

      resetCreateForm();
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.links.all });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create business partner"));
    }
  };

  const createFormContent = (
    <form className="space-y-4" onSubmit={onCreate}>
      <section className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Business Partner Information</div>
        <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor="vendor-name">Business Partner Name *</Label><Input id="vendor-name" className={LINE_INPUT_CLASS} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label htmlFor="vendor-title">Title</Label><Input id="vendor-title" className={LINE_INPUT_CLASS} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div className="sm:col-span-2"><Label htmlFor="vendor-client">Client</Label><Input id="vendor-client" className={LINE_INPUT_CLASS} value={form.client_name} onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))} placeholder="Exact client name" maxLength={NAME_MAX} /></div>
        </div>
      </section>

      <section className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Contact Info</div>
        <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
          <div><Label htmlFor="vendor-email1">Email 1</Label><Input id="vendor-email1" className={LINE_INPUT_CLASS} value={form.email1} onChange={(e) => setForm((p) => ({ ...p, email1: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label htmlFor="vendor-email2">Email 2</Label><Input id="vendor-email2" className={LINE_INPUT_CLASS} value={form.email2} onChange={(e) => setForm((p) => ({ ...p, email2: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label htmlFor="vendor-direct-phone">Direct Phone</Label><Input id="vendor-direct-phone" className={LINE_INPUT_CLASS} value={form.direct_phone} onChange={(e) => setForm((p) => ({ ...p, direct_phone: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label htmlFor="vendor-mobile-phone">Mobile Phone</Label><Input id="vendor-mobile-phone" className={LINE_INPUT_CLASS} value={form.mobile_phone} onChange={(e) => setForm((p) => ({ ...p, mobile_phone: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label htmlFor="vendor-address">Address</Label><Input id="vendor-address" className={LINE_INPUT_CLASS} value={form.address1} onChange={(e) => setForm((p) => ({ ...p, address1: e.target.value }))} maxLength={ADDRESS_MAX} /></div>
          <div><Label htmlFor="vendor-address2">Address2</Label><Input id="vendor-address2" className={LINE_INPUT_CLASS} value={form.address2} onChange={(e) => setForm((p) => ({ ...p, address2: e.target.value }))} maxLength={ADDRESS_MAX} /></div>
          <div><Label htmlFor="vendor-city">City</Label><Input id="vendor-city" className={LINE_INPUT_CLASS} value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label htmlFor="vendor-state">State</Label><Input id="vendor-state" className={LINE_INPUT_CLASS} value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label htmlFor="vendor-zip">Zip</Label><Input id="vendor-zip" className={LINE_INPUT_CLASS} value={form.zip} onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div><Label htmlFor="vendor-country">Country</Label><Input id="vendor-country" className={LINE_INPUT_CLASS} value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div className="sm:col-span-2"><Label htmlFor="vendor-desired-categories">Desired Categories</Label><Input id="vendor-desired-categories" className={LINE_INPUT_CLASS} value={form.desired_categories} onChange={(e) => setForm((p) => ({ ...p, desired_categories: e.target.value }))} maxLength={SECTOR_MAX} /></div>
          <div className="sm:col-span-2"><Label htmlFor="vendor-desired-skills">Desired Skills</Label><Input id="vendor-desired-skills" className={LINE_INPUT_CLASS} value={form.desired_skills} onChange={(e) => setForm((p) => ({ ...p, desired_skills: e.target.value }))} maxLength={NAME_MAX} /></div>
          <div className="sm:col-span-2"><Label htmlFor="vendor-comments">General Contact Comments</Label><Textarea id="vendor-comments" className="min-h-20 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:ring-0" value={form.comments} onChange={(e) => setForm((p) => ({ ...p, comments: e.target.value }))} /></div>
          <div className="sm:col-span-2"><Label htmlFor="vendor-owner-full-name">Recruiter Full Name</Label><Input id="vendor-owner-full-name" className={LINE_INPUT_CLASS} value={ownerName} readOnly /></div>
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
      title="Business Partners"
      search={list.search}
      onSearchChange={list.setSearch}
      includeDeleted={true}
      onIncludeDeletedChange={() => undefined}
      showIncludeDeleted={false}
      addButtonLabel="Add Business Partner"
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
              <input type="checkbox" checked={selection.allSelected} onChange={selection.toggleSelectAll} aria-label="Select all business partners" />
            </th>
            <th className="w-24 px-3 py-2 font-medium text-slate-900">ID</th>
            <th className="px-3 py-2 font-medium text-slate-900">Business Partner Name</th>
            <th className="w-40 px-3 py-2 font-medium text-slate-900">Status</th>
            <th className="w-52 px-3 py-2 font-medium text-slate-900">Sector</th>
            <th className="w-[26rem] px-3 py-2 font-medium text-slate-900">Address</th>
            <th className="w-28 px-3 py-2 font-medium text-slate-900">Recruiter</th>
            <th className="w-40 px-3 py-2 font-medium text-slate-900">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td className="px-3 py-4 text-slate-600" colSpan={8}>Loading...</td></tr>
          ) : null}

          {!isLoading && vendorItems.length === 0 ? (
            <tr><td className="px-3 py-4 text-slate-600" colSpan={8}>No business partners found.</td></tr>
          ) : null}

          {vendorItems.map((vendor, index) => (
            <tr key={vendor.id} className={getRowClassName(index)}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={list.selectedIds.has(vendor.id)}
                    onChange={() => selection.toggleSelectOne(vendor.id)}
                    aria-label={`Select business partner ${vendor.name}`}
                  />
                  <Link
                    href={`/vendors/${vendor.id}`}
                    className="text-slate-500 hover:text-blue-700"
                    aria-label={`View details for business partner ${vendor.name}`}
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
              <td className="px-3 py-2 text-slate-800">{getUserFirstName(vendor.owner_user_id)}</td>
              <td className="px-3 py-2">
                {vendor.deleted_at ? (
                  <Button variant="secondary" onClick={() => restoreMutation.mutate(vendor.id)}>Restore</Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ListPageShell>
  );
}
