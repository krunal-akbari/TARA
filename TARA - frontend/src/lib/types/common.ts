export interface ListResponse<T> {
  items: T[];
  total: number;
}

export interface QueryPagination {
  page?: number;
  pageSize?: number;
}

export interface QueryDeleted extends QueryPagination {
  includeDeleted?: boolean;
}

export interface ApiError {
  status?: number;
  message: string;
}
