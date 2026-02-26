import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/http";
import { QueryDeleted } from "@/lib/types/common";
import { Vendor, VendorContact, VendorListResponse } from "@/lib/types/entities";

interface ListVendorsQuery extends QueryDeleted {
  search?: string;
}

export function listVendors(query: ListVendorsQuery = {}) {
  return apiGet<VendorListResponse>("/api/v1/vendors", {
    include_deleted: query.includeDeleted ?? false,
    search: query.search,
    page: query.page ?? 1,
    page_size: query.pageSize ?? 20,
  });
}

export function getVendor(vendorId: number | string, includeDeleted = false) {
  return apiGet<Vendor>(`/api/v1/vendors/${vendorId}`, { include_deleted: includeDeleted });
}

export function createVendor(payload: {
  name: string;
  status?: string;
  client_ids?: number[] | null;
  client_names?: string[] | null;
  address?: string | null;
  sector?: string | null;
}) {
  return apiPost<Vendor>("/api/v1/vendors", payload);
}

export function updateVendor(
  vendorId: number | string,
  payload: { name?: string; status?: string; address?: string | null; sector?: string | null },
) {
  return apiPatch<Vendor>(`/api/v1/vendors/${vendorId}`, payload);
}

export function deleteVendor(vendorId: number | string) {
  return apiDelete(`/api/v1/vendors/${vendorId}`);
}

export function restoreVendor(vendorId: number | string) {
  return apiPost<Vendor>(`/api/v1/vendors/${vendorId}/restore`);
}

export function listVendorContacts(vendorId: number | string) {
  return apiGet<VendorContact[]>(`/api/v1/vendors/${vendorId}/contacts`);
}

export function createVendorContact(
  vendorId: number | string,
  payload: { first_name: string; last_name: string; email?: string | null; phone?: string | null },
) {
  return apiPost<VendorContact>(`/api/v1/vendors/${vendorId}/contacts`, payload);
}

export function updateVendorContact(
  vendorId: number | string,
  contactId: number | string,
  payload: { first_name?: string; last_name?: string; email?: string | null; phone?: string | null },
) {
  return apiPatch<VendorContact>(`/api/v1/vendors/${vendorId}/contacts/${contactId}`, payload);
}

export function deleteVendorContact(vendorId: number | string, contactId: number | string) {
  return apiDelete(`/api/v1/vendors/${vendorId}/contacts/${contactId}`);
}
