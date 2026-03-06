import { apiGet, apiPost } from "@/lib/api/http";
import { QueryDeleted } from "@/lib/types/common";
import { AppUser, AppUserListResponse } from "@/lib/types/entities";

interface ListUsersQuery extends QueryDeleted {
  search?: string;
}

export function listUsers(query: ListUsersQuery = {}) {
  return apiGet<AppUserListResponse>("/api/v1/users", {
    include_deleted: query.includeDeleted ?? false,
    search: query.search,
    page: query.page ?? 1,
    page_size: query.pageSize ?? 50,
  });
}

export function createUser(payload: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
}) {
  return apiPost<AppUser>("/api/v1/users", payload);
}
