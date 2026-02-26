"use client";

import { useState, useCallback } from "react";

interface UseListPageOptions {
  pageSize?: number;
}

export function useListPage<T extends { id: number }>(options: UseListPageOptions = {}) {
  const pageSize = options.pageSize ?? 20;

  const [page, setPage] = useState(1);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showCreate, setShowCreate] = useState(false);

  const normalizedSearch = search.trim();

  const resetSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const toggleShowCreate = useCallback(() => {
    setShowCreate((prev) => !prev);
  }, []);

  const getSelectionHelpers = useCallback(
    (items: T[]) => {
      const allSelected = items.length > 0 && selectedIds.size === items.length;

      const toggleSelectAll = () => {
        if (allSelected) return setSelectedIds(new Set());
        setSelectedIds(new Set(items.map((item) => item.id)));
      };

      const toggleSelectOne = (id: number) => {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      };

      return { allSelected, toggleSelectAll, toggleSelectOne };
    },
    [selectedIds],
  );

  const getPagination = useCallback(
    (total: number) => {
      const maxPage = Math.max(1, Math.ceil(total / pageSize));
      return {
        page,
        maxPage,
        pageSize,
        total,
        canGoPrev: page > 1,
        canGoNext: page < maxPage,
        goNext: () => setPage((prev) => prev + 1),
        goPrev: () => setPage((prev) => prev - 1),
      };
    },
    [page, pageSize],
  );

  return {
    page,
    pageSize,
    includeDeleted,
    setIncludeDeleted,
    search,
    setSearch: resetSearch,
    normalizedSearch,
    selectedIds,
    showCreate,
    setShowCreate,
    toggleShowCreate,
    getSelectionHelpers,
    getPagination,
  };
}
