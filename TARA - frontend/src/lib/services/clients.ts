import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/http";
import { QueryDeleted } from "@/lib/types/common";
import { Client, ClientContact, ClientListResponse } from "@/lib/types/entities";

interface ListClientsQuery extends QueryDeleted {
  search?: string;
}

export function listClients(query: ListClientsQuery = {}) {
  return apiGet<ClientListResponse>("/api/v1/clients", {
    include_deleted: query.includeDeleted ?? false,
    search: query.search,
    page: query.page ?? 1,
    page_size: query.pageSize ?? 20,
  });
}

export function getClient(clientId: number | string, includeDeleted = false) {
  return apiGet<Client>(`/api/v1/clients/${clientId}`, { include_deleted: includeDeleted });
}

export function createClient(payload: {
  name: string;
  status?: string;
  vendor_id?: number | null;
  vendor_name?: string | null;
  address?: string | null;
  sector?: string | null;
}) {
  return apiPost<Client>("/api/v1/clients", payload);
}

export function updateClient(
  clientId: number | string,
  payload: { name?: string; status?: string; address?: string | null; sector?: string | null },
) {
  return apiPatch<Client>(`/api/v1/clients/${clientId}`, payload);
}

export function deleteClient(clientId: number | string) {
  return apiDelete(`/api/v1/clients/${clientId}`);
}

export function restoreClient(clientId: number | string) {
  return apiPost<Client>(`/api/v1/clients/${clientId}/restore`);
}

export function listClientContacts(clientId: number | string) {
  return apiGet<ClientContact[]>(`/api/v1/clients/${clientId}/contacts`);
}

export function createClientContact(
  clientId: number | string,
  payload: { first_name: string; last_name: string; email?: string | null; phone?: string | null },
) {
  return apiPost<ClientContact>(`/api/v1/clients/${clientId}/contacts`, payload);
}

export function updateClientContact(
  clientId: number | string,
  contactId: number | string,
  payload: { first_name?: string; last_name?: string; email?: string | null; phone?: string | null },
) {
  return apiPatch<ClientContact>(`/api/v1/clients/${clientId}/contacts/${contactId}`, payload);
}

export function deleteClientContact(clientId: number | string, contactId: number | string) {
  return apiDelete(`/api/v1/clients/${clientId}/contacts/${contactId}`);
}
