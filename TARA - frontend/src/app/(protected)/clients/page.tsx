"use client";

import Link from "next/link";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Binoculars, Building2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { ListPageShell } from "@/components/common/list-page-shell";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useListPage } from "@/hooks/use-list-page";
import { useSettingsCatalog } from "@/hooks/use-settings-catalog";
import { useUserNameMap } from "@/hooks/use-user-name-map";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/query-keys";
import { createClient, createClientContact, listClients } from "@/lib/services/clients";
import { listLinks } from "@/lib/services/links";
import type { Client } from "@/lib/types/entities";
import { listVendors } from "@/lib/services/vendors";
import { cn } from "@/lib/utils/cn";
import { toTitleCase, lineAddress } from "@/lib/utils/format";
import { LINE_INPUT_CLASS, getRowClassName } from "@/lib/utils/table-styles";

type ClientTableColumn = {
  key: string;
  header: React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  defaultWidth: number;
  minWidth: number;
  toggleableKey?: ToggleableClientColumnKey;
  render: (client: Client) => React.ReactNode;
};

type ToggleableClientColumnKey =
  | "id"
  | "name"
  | "address"
  | "sector"
  | "partners"
  | "status"
  | "type"
  | "ownerUserId"
  | "deletedAt";

const CLIENT_COLUMN_OPTIONS: Array<{ key: ToggleableClientColumnKey; label: string }> = [
  { key: "id", label: "ID" },
  { key: "name", label: "Client Name" },
  { key: "address", label: "Address" },
  { key: "sector", label: "Sector" },
  { key: "partners", label: "Partners" },
  { key: "status", label: "Status" },
  { key: "type", label: "Type" },
  { key: "ownerUserId", label: "Recruiter" },
  { key: "deletedAt", label: "Deleted At" },
];

const DEFAULT_VISIBLE_CLIENT_COLUMNS: ToggleableClientColumnKey[] =
  CLIENT_COLUMN_OPTIONS.map((option) => option.key);

const CLIENT_COLUMN_DIMENSIONS: Record<string, { defaultWidth: number; minWidth: number }> = {
  selection: { defaultWidth: 56, minWidth: 56 },
  id: { defaultWidth: 72, minWidth: 60 },
  name: { defaultWidth: 280, minWidth: 160 },
  address: { defaultWidth: 260, minWidth: 160 },
  sector: { defaultWidth: 180, minWidth: 120 },
  partners: { defaultWidth: 140, minWidth: 110 },
  status: { defaultWidth: 140, minWidth: 110 },
  type: { defaultWidth: 160, minWidth: 120 },
  ownerUserId: { defaultWidth: 100, minWidth: 80 },
  deletedAt: { defaultWidth: 170, minWidth: 120 },
};

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const list = useListPage();
  const { catalog, defaults } = useSettingsCatalog();
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{ key: string; startX: number; startWidth: number; minWidth: number } | null>(null);

  const ownerName = useMemo(() => {
    const full = `${session?.user?.first_name ?? ""} ${session?.user?.last_name ?? ""}`.trim();
    if (full) return full;
    const prefix = session?.user?.email?.split("@")[0] ?? "Current User";
    return toTitleCase(prefix);
  }, [session]);

  const [vendorSearch, setVendorSearch] = useState("");
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [columnSearch, setColumnSearch] = useState("");
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<ToggleableClientColumnKey[]>(
    DEFAULT_VISIBLE_CLIENT_COLUMNS,
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      Object.entries(CLIENT_COLUMN_DIMENSIONS).map(([key, value]) => [key, value.defaultWidth]),
    ),
  );
  const [activeResizeKey, setActiveResizeKey] = useState<string | null>(null);

  const [clientForm, setClientForm] = useState({
    name: "",
    parent_company: "",
    category: defaults.client_category,
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
  const clientCategoryOptions = useMemo(() => catalog.client_category, [catalog.client_category]);

  const normalizedVendorSearch = vendorSearch.trim();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.clients.list(list.page, list.includeDeleted, list.normalizedSearch),
    queryFn: () =>
      listClients({
        page: list.page,
        pageSize: list.pageSize,
        includeDeleted: list.includeDeleted,
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
  const clientOwnerIds = useMemo(() => clientItems.map((client) => client.owner_user_id), [clientItems]);
  const { getUserFirstName } = useUserNameMap(clientOwnerIds);

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
  const visibleColumnKeySet = useMemo(() => new Set(visibleColumnKeys), [visibleColumnKeys]);

  useEffect(() => {
    if (!showColumnMenu) return;

    const onMouseDown = (event: MouseEvent) => {
      if (!columnMenuRef.current?.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [showColumnMenu]);

  useEffect(() => {
    if (!clientForm.category && defaults.client_category) {
      setClientForm((prev) => ({ ...prev, category: defaults.client_category }));
    }
  }, [clientForm.category, defaults.client_category]);

  useEffect(() => {
    if (!activeResizeKey) return;

    const onMouseMove = (event: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;

      const nextWidth = Math.max(state.minWidth, state.startWidth + event.clientX - state.startX);
      setColumnWidths((prev) => (
        prev[state.key] === nextWidth
          ? prev
          : { ...prev, [state.key]: nextWidth }
      ));
    };

    const onMouseUp = () => {
      resizeStateRef.current = null;
      setActiveResizeKey(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [activeResizeKey]);

  const resetClientForm = () => {
    setClientForm({
      name: "",
      parent_company: "",
      category: defaults.client_category,
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

  const renderCompactText = (value: string | null | undefined, emptyValue = "-") =>
    value ? (
      <span className="block w-full truncate" title={value}>
        {value}
      </span>
    ) : (
      emptyValue
    );
  const filteredColumnOptions = useMemo(() => {
    const search = columnSearch.trim().toLowerCase();
    if (!search) return CLIENT_COLUMN_OPTIONS;

    return CLIENT_COLUMN_OPTIONS.filter((option) =>
      option.label.toLowerCase().includes(search),
    );
  }, [columnSearch]);
  const toggleColumn = (key: ToggleableClientColumnKey) => {
    setVisibleColumnKeys((prev) => {
      const next = prev.includes(key)
        ? prev.filter((columnKey) => columnKey !== key)
        : [...prev, key];

      return CLIENT_COLUMN_OPTIONS
        .map((option) => option.key)
        .filter((columnKey) => next.includes(columnKey));
    });
  };
  const selectAllColumns = () => {
    setVisibleColumnKeys(CLIENT_COLUMN_OPTIONS.map((option) => option.key));
  };
  const clearAllColumns = () => {
    setVisibleColumnKeys([]);
  };
  const getColumnWidth = (column: ClientTableColumn) =>
    columnWidths[column.key] ?? column.defaultWidth;
  const startColumnResize = (event: React.MouseEvent<HTMLDivElement>, column: ClientTableColumn) => {
    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      key: column.key,
      startX: event.clientX,
      startWidth: getColumnWidth(column),
      minWidth: column.minWidth,
    };
    setActiveResizeKey(column.key);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const clientTableColumns: ClientTableColumn[] = [
    {
      key: "selection",
      header: (
        <input
          type="checkbox"
          checked={selection.allSelected}
          onChange={selection.toggleSelectAll}
          aria-label="Select all clients"
        />
      ),
      headerClassName: "px-3 py-2",
      cellClassName: "px-3 py-2",
      defaultWidth: CLIENT_COLUMN_DIMENSIONS.selection.defaultWidth,
      minWidth: CLIENT_COLUMN_DIMENSIONS.selection.minWidth,
      render: (client) => (
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
      ),
    },
    {
      key: "id",
      toggleableKey: "id",
      header: "ID",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 tabular-nums text-slate-800",
      defaultWidth: CLIENT_COLUMN_DIMENSIONS.id.defaultWidth,
      minWidth: CLIENT_COLUMN_DIMENSIONS.id.minWidth,
      render: (client) => client.id,
    },
    {
      key: "name",
      toggleableKey: "name",
      header: "Client Name",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2",
      defaultWidth: CLIENT_COLUMN_DIMENSIONS.name.defaultWidth,
      minWidth: CLIENT_COLUMN_DIMENSIONS.name.minWidth,
      render: (client) => (
        <Link href={`/clients/${client.id}`} className="font-medium text-blue-700 hover:underline">
          {client.name}
        </Link>
      ),
    },
    {
      key: "address",
      toggleableKey: "address",
      header: "Address",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      defaultWidth: CLIENT_COLUMN_DIMENSIONS.address.defaultWidth,
      minWidth: CLIENT_COLUMN_DIMENSIONS.address.minWidth,
      render: (client) => renderCompactText(client.address),
    },
    {
      key: "sector",
      toggleableKey: "sector",
      header: "Sector",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      defaultWidth: CLIENT_COLUMN_DIMENSIONS.sector.defaultWidth,
      minWidth: CLIENT_COLUMN_DIMENSIONS.sector.minWidth,
      render: (client) => renderCompactText(client.sector),
    },
    {
      key: "partners",
      toggleableKey: "partners",
      header: "Partners",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2",
      defaultWidth: CLIENT_COLUMN_DIMENSIONS.partners.defaultWidth,
      minWidth: CLIENT_COLUMN_DIMENSIONS.partners.minWidth,
      render: (client) => (
        <Link
          href={`/clients/${client.id}/network`}
          className="tabular-nums text-blue-700 hover:underline"
        >
          {partnerCountById.get(client.id) ?? 0}
        </Link>
      ),
    },
    {
      key: "status",
      toggleableKey: "status",
      header: "Status",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2",
      defaultWidth: CLIENT_COLUMN_DIMENSIONS.status.defaultWidth,
      minWidth: CLIENT_COLUMN_DIMENSIONS.status.minWidth,
      render: (client) => <StatusChip value={client.status} />,
    },
    {
      key: "type",
      toggleableKey: "type",
      header: "Type",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2",
      defaultWidth: CLIENT_COLUMN_DIMENSIONS.type.defaultWidth,
      minWidth: CLIENT_COLUMN_DIMENSIONS.type.minWidth,
      render: (client) => {
        const partnerCount = partnerCountById.get(client.id) ?? 0;
        const typeLabel = partnerCount > 0 ? "business_partner" : "end_client";
        return <StatusChip value={typeLabel} />;
      },
    },
    {
      key: "ownerUserId",
      toggleableKey: "ownerUserId",
      header: "Recruiter",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      defaultWidth: CLIENT_COLUMN_DIMENSIONS.ownerUserId.defaultWidth,
      minWidth: CLIENT_COLUMN_DIMENSIONS.ownerUserId.minWidth,
      render: (client) => getUserFirstName(client.owner_user_id),
    },
    {
      key: "deletedAt",
      toggleableKey: "deletedAt",
      header: "Deleted At",
      headerClassName: "px-3 py-2 font-medium text-slate-600",
      cellClassName: "px-3 py-2 text-slate-700",
      defaultWidth: CLIENT_COLUMN_DIMENSIONS.deletedAt.defaultWidth,
      minWidth: CLIENT_COLUMN_DIMENSIONS.deletedAt.minWidth,
      render: (client) => renderCompactText(client.deleted_at),
    },
  ];
  const visibleClientTableColumns = clientTableColumns.filter(
    (column) => !column.toggleableKey || visibleColumnKeySet.has(column.toggleableKey),
  );
  const visibleTableMinWidth = visibleClientTableColumns.reduce(
    (total, column) => total + getColumnWidth(column),
    0,
  );

  const onCreateClient = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!clientForm.name.trim()) return setError("Client Name is required");
    if (!clientForm.category.trim()) return setError("Category is required");
    const selectedVendorId = clientForm.type === "vendor" ? Number(clientForm.vendor_id) : null;
    if (clientForm.type === "vendor" && (!selectedVendorId || Number.isNaN(selectedVendorId))) {
      return setError("Business Partner is required when Type is Business Partner");
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
            <div><Label htmlFor="client-name">Client Name *</Label><Input id="client-name" className={LINE_INPUT_CLASS} value={clientForm.name} onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div>
              <Label htmlFor="client-category">Category *</Label>
              <Select id="client-category" className={LINE_INPUT_CLASS} value={clientForm.category} onChange={(e) => setClientForm((p) => ({ ...p, category: e.target.value }))}>
                {clientCategoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {toTitleCase(option)}
                  </option>
                ))}
              </Select>
            </div>
            <div><Label htmlFor="client-website">Website</Label><Input id="client-website" className={LINE_INPUT_CLASS} value={clientForm.website} onChange={(e) => setClientForm((p) => ({ ...p, website: e.target.value }))} /></div>
            <div>
              <Label htmlFor="client-type">Type *</Label>
              <Select
                id="client-type"
                className={LINE_INPUT_CLASS}
                value={clientForm.type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setClientForm((p) => ({ ...p, type: nextType, vendor_id: nextType === "vendor" ? p.vendor_id : "" }));
                  setVendorSearch("");
                }}
              >
                <option value="end_client">End Client</option>
                <option value="vendor">Business Partner</option>
              </Select>
            </div>
            {clientForm.type === "vendor" ? (
              <div>
                <Label htmlFor="client-vendor">Business Partner *</Label>
                <Input
                  id="client-vendor"
                  className={LINE_INPUT_CLASS}
                  value={vendorSearch}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setClientForm((p) => ({ ...p, vendor_id: "" }));
                  }}
                  placeholder="Type business partner name"
                />
                {normalizedVendorSearch.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">Start typing to search business partners.</p>
                ) : (
                  <div className="mt-1 max-h-40 overflow-auto rounded border border-slate-200 bg-white">
                    {vendorsLoading ? <p className="px-3 py-2 text-sm text-slate-500">Searching business partners...</p> : null}
                    {!vendorsLoading && vendorOptions.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">No business partners found.</p> : null}
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
                {clientForm.vendor_id ? <p className="mt-1 text-xs text-emerald-700">Selected Business Partner ID: {clientForm.vendor_id}</p> : null}
              </div>
            ) : null}
            <div className="sm:col-span-2"><Label htmlFor="client-company-description">Company Description</Label><Textarea id="client-company-description" className="min-h-20 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:ring-0" value={clientForm.company_description} onChange={(e) => setClientForm((p) => ({ ...p, company_description: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Address</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <Label htmlFor="client-address">Address</Label>
              <Input id="client-address" className={LINE_INPUT_CLASS} value={clientForm.address1} onChange={(e) => setClientForm((p) => ({ ...p, address1: e.target.value }))} />
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="client-address2">Address2</Label>
              <Input id="client-address2" className={LINE_INPUT_CLASS} value={clientForm.address2} onChange={(e) => setClientForm((p) => ({ ...p, address2: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="client-city">City</Label>
              <Input id="client-city" className={LINE_INPUT_CLASS} value={clientForm.city} onChange={(e) => setClientForm((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="client-state">State</Label>
              <Input id="client-state" className={LINE_INPUT_CLASS} value={clientForm.state} onChange={(e) => setClientForm((p) => ({ ...p, state: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="client-zip">Zip</Label>
              <Input id="client-zip" className={LINE_INPUT_CLASS} value={clientForm.zip} onChange={(e) => setClientForm((p) => ({ ...p, zip: e.target.value }))} />
            </div>
            <div className="sm:col-span-6">
              <Label htmlFor="client-country">Country</Label>
              <Input id="client-country" className={LINE_INPUT_CLASS} value={clientForm.country} onChange={(e) => setClientForm((p) => ({ ...p, country: e.target.value }))} />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Contact Info</div>
          <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
            <div><Label htmlFor="client-contact-first-name">Contact Person First Name</Label><Input id="client-contact-first-name" className={LINE_INPUT_CLASS} value={clientForm.contact_first_name} onChange={(e) => setClientForm((p) => ({ ...p, contact_first_name: e.target.value }))} /></div>
            <div><Label htmlFor="client-contact-last-name">Contact Person Last Name</Label><Input id="client-contact-last-name" className={LINE_INPUT_CLASS} value={clientForm.contact_last_name} onChange={(e) => setClientForm((p) => ({ ...p, contact_last_name: e.target.value }))} /></div>
            <div><Label htmlFor="client-email">Email</Label><Input id="client-email" className={LINE_INPUT_CLASS} value={clientForm.contact_email} onChange={(e) => setClientForm((p) => ({ ...p, contact_email: e.target.value }))} /></div>
            <div><Label htmlFor="client-work-number">Work Number</Label><Input id="client-work-number" className={LINE_INPUT_CLASS} value={clientForm.work_number} onChange={(e) => setClientForm((p) => ({ ...p, work_number: e.target.value }))} /></div>
            <div><Label htmlFor="client-cell-number">Cell Number</Label><Input id="client-cell-number" className={LINE_INPUT_CLASS} value={clientForm.cell_no} onChange={(e) => setClientForm((p) => ({ ...p, cell_no: e.target.value }))} /></div>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Recruiter</div>
          <div className="grid gap-3 px-3 py-3">
            <div><Label htmlFor="client-owner-full-name">Recruiter Full Name</Label><Input id="client-owner-full-name" className={LINE_INPUT_CLASS} value={ownerName} readOnly /></div>
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
      includeDeleted={list.includeDeleted}
      onIncludeDeletedChange={list.setIncludeDeleted}
      showIncludeDeleted={false}
      addButtonLabel="Add Client"
      showCreate={list.showCreate}
      onToggleCreate={list.toggleShowCreate}
      filters={(
        <div ref={columnMenuRef} className="relative z-50">
          <Button
            type="button"
            variant="ghost"
            className="h-10 gap-2 px-3"
            onClick={() => setShowColumnMenu((current) => !current)}
          >
            <span>Columns</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {visibleColumnKeys.length}
            </span>
          </Button>
          {showColumnMenu ? (
            <div className="absolute left-0 top-full z-[100] mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Columns</p>
                    <p className="mt-1 text-sm text-slate-600">Choose which client fields are visible.</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
                    {visibleColumnKeys.length} selected
                  </span>
                </div>
                <div className="mt-3">
                  <Input
                    value={columnSearch}
                    onChange={(event) => setColumnSearch(event.target.value)}
                    placeholder="Search columns..."
                    className="h-9"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  onClick={selectAllColumns}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  onClick={clearAllColumns}
                >
                  Clear All
                </button>
                <button
                  type="button"
                  className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  onClick={() => setVisibleColumnKeys(DEFAULT_VISIBLE_CLIENT_COLUMNS)}
                >
                  Reset Default
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto px-2 py-2">
                {filteredColumnOptions.length > 0 ? (
                  filteredColumnOptions.map((option) => {
                    const checked = visibleColumnKeySet.has(option.key);

                    return (
                      <label
                        key={option.key}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          checked ? "bg-blue-50 text-slate-900" : "text-slate-700 hover:bg-slate-50",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-4 rounded border-slate-300 text-blue-600 accent-blue-600"
                          checked={checked}
                          onChange={() => toggleColumn(option.key)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{option.label}</p>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-slate-500">
                    No columns match your search.
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Drag the table header edge to resize visible columns.
              </div>
            </div>
          ) : null}
        </div>
      )}
      createForm={createFormContent}
      error={<ErrorBanner message={error} onDismiss={() => setError(null)} />}
      pagination={pagination}
    >
      <table
        className="w-full table-fixed border-collapse text-left text-sm"
        style={{ minWidth: `${visibleTableMinWidth}px` }}
      >
        <colgroup>
          {visibleClientTableColumns.map((column) => (
            <col key={column.key} style={{ width: `${getColumnWidth(column)}px` }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-slate-300">
            {visibleClientTableColumns.map((column) => (
              <th
                key={column.key}
                className={column.headerClassName}
                style={{ width: `${getColumnWidth(column)}px`, minWidth: `${getColumnWidth(column)}px` }}
              >
                <div className="group relative flex items-center pr-3">
                  <div className="min-w-0 truncate">
                    {column.header}
                  </div>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${typeof column.header === "string" ? column.header : "column"} column`}
                    onMouseDown={(event) => startColumnResize(event, column)}
                    className={cn(
                      "absolute right-[-6px] top-[-1px] h-[calc(100%+2px)] w-3 cursor-col-resize select-none",
                      activeResizeKey === column.key && "bg-sky-200/70",
                    )}
                  >
                    <div className="mx-auto h-full w-px bg-transparent transition-colors group-hover:bg-slate-300" />
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td className="px-3 py-4 text-slate-600" colSpan={visibleClientTableColumns.length}>Loading...</td></tr>
          ) : null}

          {!isLoading && clientItems.length === 0 ? (
            <tr><td className="px-3 py-4 text-slate-600" colSpan={visibleClientTableColumns.length}>No clients found.</td></tr>
          ) : null}

          {clientItems.map((client, index) => (
            <tr key={client.id} className={getRowClassName(index)}>
              {visibleClientTableColumns.map((column) => (
                <td key={`${client.id}-${column.key}`} className={column.cellClassName}>
                  {column.render(client)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ListPageShell>
  );
}
