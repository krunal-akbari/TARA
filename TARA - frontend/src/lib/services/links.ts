import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/http";
import { ClientVendorLink, LinkListResponse } from "@/lib/types/entities";

interface ListLinksQuery {
  includeDeleted?: boolean;
  clientId?: number;
  vendorId?: number;
  page?: number;
  pageSize?: number;
}

export function listLinks(query: ListLinksQuery = {}) {
  return apiGet<LinkListResponse>("/api/v1/client-vendor-links", {
    include_deleted: query.includeDeleted ?? false,
    client_id: query.clientId,
    vendor_id: query.vendorId,
    page: query.page ?? 1,
    page_size: query.pageSize ?? 20,
  });
}

export function createLink(payload: {
  client_id: number;
  vendor_id: number;
  status?: string;
  priority?: number;
  effective_from?: string | null;
  effective_to?: string | null;
}) {
  return apiPost<ClientVendorLink>("/api/v1/client-vendor-links", payload);
}

export function updateLink(
  linkId: number | string,
  payload: { status?: string; priority?: number; effective_from?: string | null; effective_to?: string | null },
) {
  return apiPatch<ClientVendorLink>(`/api/v1/client-vendor-links/${linkId}`, payload);
}

export function deleteLink(linkId: number | string) {
  return apiDelete(`/api/v1/client-vendor-links/${linkId}`);
}

export function restoreLink(linkId: number | string) {
  return apiPost<ClientVendorLink>(`/api/v1/client-vendor-links/${linkId}/restore`);
}
