import { ListResponse } from "@/lib/types/common";

export interface Client {
  id: number;
  tenant_id: number;
  name: string;
  status: string;
  owner_user_id: number;
  address: string | null;
  sector: string | null;
  deleted_at: string | null;
}

export interface ClientContact {
  id: number;
  client_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

export interface Vendor {
  id: number;
  tenant_id: number;
  name: string;
  status: string;
  owner_user_id: number;
  address: string | null;
  sector: string | null;
  deleted_at: string | null;
}

export interface VendorContact {
  id: number;
  vendor_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

export interface ClientVendorLink {
  id: number;
  tenant_id: number;
  client_id: number;
  vendor_id: number;
  status: string;
  priority: number;
  effective_from: string | null;
  effective_to: string | null;
  deleted_at: string | null;
}

export interface Job {
  id: number;
  tenant_id: number;
  title: string;
  description: string;
  status: string;
  intake_channel: string;
  origin_client_id: number | null;
  origin_vendor_id: number | null;
  owner_user_id: number;
  deleted_at: string | null;
}

export interface RouteTransition {
  id: number;
  tenant_id: number;
  job_id: number;
  sequence_no: number;
  from_node_type: string | null;
  from_node_id: number | null;
  to_node_type: string;
  to_node_id: number;
  reason: string;
  notes: string | null;
  actor_user_id: number;
  occurred_at: string;
}

export interface CurrentRoute {
  job_id: number;
  current_node_type: string;
  current_node_id: number;
  status: string;
  last_transition_seq: number;
  updated_at: string;
}

export interface Candidate {
  id: number;
  tenant_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  current_company: string | null;
  owner_user_id: number;
  dedupe_fingerprint: string | null;
  deleted_at: string | null;
}

export interface DedupeCheckResponse {
  matches: Candidate[];
  total_matches: number;
}

export interface Resume {
  id: number;
  tenant_id: number;
  candidate_id: number;
  storage_key: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  parse_status: string;
  uploaded_by: number;
  created_at: string;
}

export interface ActivityEvent {
  id: number;
  tenant_id: number;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor_user_id: number;
  payload_json: Record<string, unknown>;
}

export interface OperationalReport {
  jobs_total: number;
  clients_total: number;
  vendors_total: number;
  candidates_total: number;
  active_links_total: number;
  route_transitions_total: number;
  route_reason_breakdown: Record<string, number>;
}

export type ClientListResponse = ListResponse<Client>;
export type VendorListResponse = ListResponse<Vendor>;
export type LinkListResponse = ListResponse<ClientVendorLink>;
export type JobListResponse = ListResponse<Job>;
export type CandidateListResponse = ListResponse<Candidate>;
export type ResumeListResponse = ListResponse<Resume>;
export type RouteTransitionListResponse = ListResponse<RouteTransition>;
export type ActivityEventListResponse = ListResponse<ActivityEvent>;
