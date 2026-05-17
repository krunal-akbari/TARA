"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ContactManager } from "@/components/common/contact-manager";
import { ErrorBanner } from "@/components/common/error-banner";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useSettingsCatalog } from "@/hooks/use-settings-catalog";
import { useUserNameMap } from "@/hooks/use-user-name-map";
import { getApiErrorMessage } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import {
  createClientContact,
  getClient,
  listClientContacts,
  restoreClient,
  updateClient,
  updateClientContact,
} from "@/lib/services/clients";
import { listJobs } from "@/lib/services/jobs";
import { createLink, listLinks, restoreLink, updateLink } from "@/lib/services/links";
import { listVendors } from "@/lib/services/vendors";
import { getVendor } from "@/lib/services/vendors";
import { ClientVendorLink, Vendor } from "@/lib/types/entities";
import { cn } from "@/lib/utils/cn";
import { toTitleCase } from "@/lib/utils/format";

const NAME_MAX = 255;
const ADDRESS_MAX = 512;

const JOBS_PAGE_SIZE = 100;
const LINKS_PAGE_SIZE = 100;

type ClientTabId =
  | "overview"
  | "edit"
  | "activity"
  | "emails"
  | "notes"
  | "venders"
  | "submissions";

function toLabel(value: string) {
  return toTitleCase(value.replaceAll("_", " "));
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const clientId = Number(id);
  const hasValidId = Number.isInteger(clientId) && clientId > 0;

  const queryClient = useQueryClient();
  const { catalog } = useSettingsCatalog();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [sector, setSector] = useState("");
  const [statusValue, setStatusValue] = useState<"active" | "inactive">("active");
  const [mainPhoneValue, setMainPhoneValue] = useState("");
  const [typeValue, setTypeValue] = useState<"end_client" | "vender">("end_client");
  const [selectedVenderId, setSelectedVenderId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClientTabId>("overview");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.clients.detail(id),
    queryFn: () => getClient(id, true),
    enabled: hasValidId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: queryKeys.clients.contacts(id),
    queryFn: () => listClientContacts(id),
    enabled: hasValidId,
  });

  const { data: venderOptionsData } = useQuery({
    queryKey: [...queryKeys.vendors.all, "client-edit-options"],
    queryFn: () => listVendors({ page: 1, pageSize: 100, includeDeleted: false }),
    enabled: hasValidId,
  });

  const { data: vendorLinks = [], isLoading: isVendorLinksLoading } = useQuery({
    queryKey: [...queryKeys.links.all, "client-venders", clientId],
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

      return aggregated;
    },
    enabled: hasValidId,
  });

  const { data: submissionsCount = 0 } = useQuery({
    queryKey: [...queryKeys.jobs.all, "client-submissions", clientId],
    queryFn: async () => {
      let page = 1;
      let total = 0;
      let count = 0;

      while (true) {
        const response = await listJobs({
          page,
          pageSize: JOBS_PAGE_SIZE,
          includeDeleted: true,
        });
        if (page === 1) total = response.total;
        if (response.items.length === 0) break;
        count += response.items.filter((job) => job.origin_client_id === clientId).length;
        if (page * JOBS_PAGE_SIZE >= total) break;
        page += 1;
      }

      return count;
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

  useEffect(() => {
    if (!data) return;
    setMainPhoneValue(contacts.find((contact) => Boolean(contact.phone))?.phone ?? "");
    const activeLinks = vendorLinks.filter((link) => !link.deleted_at);
    if (activeLinks.length > 0) {
      setTypeValue("vender");
      setSelectedVenderId(String(activeLinks[0].vendor_id));
    } else {
      setTypeValue("end_client");
      setSelectedVenderId("");
    }
  }, [contacts, data, vendorLinks]);

  const venderLinks = useMemo(() => vendorLinks.filter((link) => !link.deleted_at), [vendorLinks]);
  const venderIds = useMemo(() => [...new Set(vendorLinks.map((link) => link.vendor_id))], [vendorLinks]);
  const vendorQueries = useQueries({
    queries: venderIds.map((vendorId) => ({
      queryKey: queryKeys.vendors.detail(vendorId),
      queryFn: () => getVendor(vendorId, true),
      staleTime: 30000,
    })),
  });
  const vendersById = useMemo(() => {
    const map = new Map<number, Vendor>();
    venderIds.forEach((vendorId, index) => {
      const vendor = vendorQueries[index]?.data;
      if (vendor) map.set(vendorId, vendor);
    });
    return map;
  }, [venderIds, vendorQueries]);

  const vendersCount = venderLinks.length;
  const mainPhone = contacts.find((contact) => Boolean(contact.phone))?.phone ?? "-";
  const clientType = vendersCount > 0 ? "Business Partner" : "End Client";
  const { getUserFirstName } = useUserNameMap([data?.owner_user_id]);
  const clientCategoryOptions = useMemo(() => {
    const values = [...catalog.client_category];
    if (sector && !values.some((value) => value.toLowerCase() === sector.toLowerCase())) {
      values.push(sector);
    }
    return values;
  }, [catalog.client_category, sector]);

  const tabs = useMemo(
    () => [
      { id: "overview" as const, label: "Overview" },
      { id: "edit" as const, label: "Edit" },
      { id: "activity" as const, label: "Activity" },
      { id: "emails" as const, label: "Emails" },
      { id: "notes" as const, label: "Notes (0)" },
      { id: "venders" as const, label: `Business Partners (${vendersCount})` },
      { id: "submissions" as const, label: `Submissions (${submissionsCount})` },
    ],
    [vendersCount, submissionsCount],
  );

  const updateMutation = useMutation({
    mutationFn: (payload: { name: string; status: string; address: string | null; sector: string | null }) =>
      updateClient(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.links.all, "client-venders", clientId] });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to update client")),
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreClient(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clients.detail(id) }),
    onError: (err) => setError(getApiErrorMessage(err, "Failed to restore client")),
  });

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError(null);

      const trimmedName = name.trim();
      if (trimmedName.length < 2) {
        setError("Name must be at least 2 characters");
        return;
      }

      if (typeValue === "vender" && (!selectedVenderId || Number.isNaN(Number(selectedVenderId)))) {
        setError("Please select a business partner.");
        return;
      }

      try {
        await updateMutation.mutateAsync({
          name: trimmedName,
          status: statusValue,
          address: address.trim() ? address.trim() : null,
          sector: sector.trim() ? sector.trim() : null,
        });

        const trimmedPhone = mainPhoneValue.trim();
        const primaryContact = contacts[0];

        if (primaryContact && (primaryContact.phone ?? "") !== trimmedPhone) {
          await updateClientContact(id, primaryContact.id, {
            phone: trimmedPhone ? trimmedPhone : null,
          });
        }
        if (!primaryContact && trimmedPhone) {
          await createClientContact(id, {
            first_name: "Primary",
            last_name: "Contact",
            email: null,
            phone: trimmedPhone,
          });
        }

        const activeLinks = vendorLinks.filter((link) => !link.deleted_at);
        if (typeValue === "end_client") {
          await Promise.all(
            activeLinks
              .filter((link) => link.status !== "inactive")
              .map((link) => updateLink(link.id, { status: "inactive" })),
          );
        } else {
          const venderId = Number(selectedVenderId);
          const matchedLink = vendorLinks.find((link) => link.vendor_id === venderId);
          if (!matchedLink) {
            await createLink({
              client_id: clientId,
              vendor_id: venderId,
              status: "active",
              priority: 100,
            });
          } else if (matchedLink.deleted_at) {
            await restoreLink(matchedLink.id);
          } else if (matchedLink.status !== "active") {
            await updateLink(matchedLink.id, { status: "active" });
          }
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.clients.detail(id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.clients.contacts(id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
        queryClient.invalidateQueries({ queryKey: [...queryKeys.links.all, "client-venders", clientId] });
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to update client details"));
      }
    },
    [
      address,
      clientId,
      contacts,
      id,
      mainPhoneValue,
      name,
      queryClient,
      sector,
      selectedVenderId,
      statusValue,
      typeValue,
      updateMutation,
      vendorLinks,
    ],
  );

  const contactService = useMemo(
    () => ({
      list: () => listClientContacts(id),
      create: (payload: { first_name: string; last_name: string; email: string | null; phone: string | null }) =>
        createClientContact(id, payload),
      update: (
        contactId: number,
        payload: { first_name: string; last_name: string; email: string | null; phone: string | null },
      ) => updateClientContact(id, contactId, payload),
    }),
    [id],
  );

  const tabPanelContent = useMemo(() => {
    if (!data) return null;

    if (activeTab === "overview") {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="overflow-hidden p-0">
              <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Company Overview</div>
              <div className="grid grid-cols-2 border-b border-slate-200 px-3 py-2 text-sm">
                <span className="text-slate-700">Recruiter</span>
                <span className="text-slate-900">{getUserFirstName(data.owner_user_id)}</span>
              </div>
              <div className="mt-2 border-t border-slate-200 px-3 py-2 text-sm text-slate-700">Company Description</div>
              <div className="border-t border-slate-200 px-3 py-2 text-sm text-slate-700">Client Contact Notes</div>
            </Card>

            <div className="space-y-4">
              <Card className="overflow-hidden p-0">
                <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Details</div>
                <div className="grid gap-0 text-sm">
                  <div className="grid grid-cols-2 border-b border-slate-200 px-3 py-2"><span className="text-slate-700">Company Website</span><span className="text-slate-900">-</span></div>
                  <div className="grid grid-cols-2 border-b border-slate-200 px-3 py-2"><span className="text-slate-700">Status</span><span className="text-slate-900">{toLabel(data.status)}</span></div>
                  <div className="grid grid-cols-2 border-b border-slate-200 px-3 py-2"><span className="text-slate-700">Address</span><span className="text-slate-900">{data.address || "United States"}</span></div>
                  <div className="grid grid-cols-2 px-3 py-2"><span className="text-slate-700">Main Phone</span><span className="text-slate-900">{mainPhone}</span></div>
                </div>
              </Card>

              <Card className="overflow-hidden p-0">
                <div className="grid gap-0 text-sm">
                  <div className="border-b border-slate-200 px-3 py-2 text-slate-700">Company Website</div>
                  <div className="border-b border-slate-200 px-3 py-2 text-slate-700">Facebook Profile Name</div>
                  <div className="border-b border-slate-200 px-3 py-2 text-slate-700">LinkedIn Profile Name</div>
                  <div className="px-3 py-2 text-slate-700">Twitter Handle</div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "edit") {
      return (
        <div className="space-y-4">
          <Card>
            <form className="grid gap-3 sm:max-w-3xl sm:grid-cols-2" onSubmit={onSubmit}>
              <div>
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={NAME_MAX}
                  placeholder="Client name"
                  required
                />
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
                <Label>Category</Label>
                <Select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                >
                  {clientCategoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {toTitleCase(option)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value === "inactive" ? "inactive" : "active")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
              <div>
                <Label>Main Phone</Label>
                <Input
                  value={mainPhoneValue}
                  onChange={(e) => setMainPhoneValue(e.target.value)}
                  maxLength={64}
                  placeholder="Main phone number"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={typeValue} onChange={(e) => setTypeValue(e.target.value === "vender" ? "vender" : "end_client")}>
                  <option value="end_client">End Client</option>
                  <option value="vender">Business Partner</option>
                </Select>
              </div>
              {typeValue === "vender" ? (
                <div className="sm:col-span-2">
                  <Label>Business Partner</Label>
                  <Select value={selectedVenderId} onChange={(e) => setSelectedVenderId(e.target.value)}>
                    <option value="">Select business partner</option>
                    {(venderOptionsData?.items ?? []).map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              <div className="sm:col-span-2 text-xs text-slate-500">
                Changing type to End Client marks linked business partners inactive. Choosing Business Partner ensures the selected business partner is linked.
              </div>
              <div className="sm:col-span-2 flex gap-2 pt-1">
                <Button type="submit" disabled={updateMutation.isPending}>Save</Button>
                {data.deleted_at ? (
                  <Button type="button" variant="secondary" onClick={() => restoreMutation.mutate()}>Restore</Button>
                ) : null}
              </div>
            </form>
          </Card>
          <Card>
            <ContactManager
              queryKey={queryKeys.clients.contacts(id)}
              service={contactService}
              title="Client Contacts"
            />
          </Card>
        </div>
      );
    }

    if (activeTab === "venders") {
      return (
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Business Partners</h2>
          {isVendorLinksLoading ? <p className="mt-3 text-sm text-slate-600">Loading business partners...</p> : null}
          {!isVendorLinksLoading && vendorLinks.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No business partners linked to this client yet.</p>
          ) : null}
          {!isVendorLinksLoading && vendorLinks.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="px-2 py-2">Business Partner</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Priority</th>
                    <th className="px-2 py-2">Sector</th>
                    <th className="px-2 py-2">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorLinks.map((link) => {
                    const vendor = vendersById.get(link.vendor_id);
                    const linkStatus = link.deleted_at ? "Deleted" : toLabel(link.status);
                    return (
                      <tr key={link.id} className="border-b">
                        <td className="px-2 py-2">
                          {vendor ? (
                            <Link href={`/vendors/${vendor.id}`} className="font-medium text-blue-700 hover:underline">
                              {vendor.name}
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-900">Business Partner #{link.vendor_id}</span>
                          )}
                        </td>
                        <td className="px-2 py-2"><StatusChip value={linkStatus} /></td>
                        <td className="px-2 py-2 tabular-nums text-slate-800">{link.priority}</td>
                        <td className="px-2 py-2 text-slate-700">{vendor?.sector || "-"}</td>
                        <td className="px-2 py-2 text-slate-700">{vendor?.address || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      );
    }

    return (
      <Card>
        <p className="text-sm text-slate-600">
          {toLabel(activeTab)} panel is reserved for upcoming data in this Bullhorn-style layout.
        </p>
      </Card>
    );
  }, [
    activeTab,
    address,
    clientCategoryOptions,
    contactService,
    data,
    getUserFirstName,
    id,
    isVendorLinksLoading,
    mainPhone,
    mainPhoneValue,
    name,
    onSubmit,
    restoreMutation,
    selectedVenderId,
    sector,
    statusValue,
    typeValue,
    updateMutation.isPending,
    vendorLinks,
    venderOptionsData?.items,
    vendersById,
  ]);

  if (!hasValidId) {
    return <ErrorBanner message="Invalid client id." />;
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      {isLoading ? (
        <Card>
          <p className="text-sm text-slate-600">Loading client details...</p>
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
                <div className="flex items-center gap-2">
                  <StatusChip value={toLabel(data.status)} />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <p className="text-xs font-medium text-slate-500">ID</p>
                  <p className="mt-1 tabular-nums text-slate-900">{data.id}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Client Name</p>
                  <p className="mt-1 text-slate-900">{data.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Main Phone</p>
                  <p className="mt-1 text-slate-900">{mainPhone}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Category</p>
                  <p className="mt-1 text-slate-900">{data.sector || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Type</p>
                  <p className="mt-1 text-slate-900">{clientType}</p>
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

          {tabPanelContent}
        </>
      ) : null}
    </div>
  );
}
