"use client";

import { ChevronDown, Columns3, Star, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ListPageShellProps {
  icon: React.ReactNode;
  title: string;
  search: string;
  onSearchChange: (_value: string) => void;
  includeDeleted: boolean;
  onIncludeDeletedChange: (_checked: boolean) => void;
  showIncludeDeleted?: boolean;
  addButtonLabel: string;
  showCreate: boolean;
  onToggleCreate: () => void;
  filters?: React.ReactNode;
  createForm?: React.ReactNode;
  error?: React.ReactNode;
  pagination: {
    page: number;
    maxPage: number;
    total: number;
    canGoPrev: boolean;
    canGoNext: boolean;
    goPrev: () => void;
    goNext: () => void;
  };
  children: React.ReactNode;
}

export function ListPageShell({
  icon,
  title,
  search,
  onSearchChange,
  includeDeleted,
  onIncludeDeletedChange,
  showIncludeDeleted = true,
  addButtonLabel,
  showCreate,
  onToggleCreate,
  filters,
  createForm,
  error,
  pagination,
  children,
}: ListPageShellProps) {
  return (
    <div className="overflow-hidden rounded border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-300 bg-white px-3 py-2">
        <div className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          {icon}
          <span className="text-balance text-[32px]">{title}</span>
        </div>

        <div className="w-full max-w-xs">
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="h-10"
          />
        </div>

        {filters}

        <button type="button" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-800">
          <Columns3 className="size-4" />
          <span>Columns</span>
          <ChevronDown className="size-3" />
        </button>
        <button type="button" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-800">
          <User className="size-4" />
          <span>Users</span>
          <ChevronDown className="size-3" />
        </button>
        <button type="button" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-800">
          <Star className="size-4" />
          <span>Favorites</span>
          <ChevronDown className="size-3" />
        </button>

        <div className="ml-auto flex items-center gap-2">
          {showIncludeDeleted ? (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => onIncludeDeletedChange(e.target.checked)}
              />
              Include deleted
            </label>
          ) : null}
          <Button
            className="text-sm font-medium"
            type="button"
            variant="secondary"
            onClick={onToggleCreate}
          >
            {showCreate ? "Close" : addButtonLabel}
          </Button>
        </div>
      </div>

      {error}

      {showCreate && createForm ? (
        <div className="border-b border-slate-300 bg-slate-50 px-3 py-3">
          {createForm}
        </div>
      ) : null}

      <div className="max-h-[calc(100dvh-270px)] overflow-auto">
        {children}
      </div>

      <div className="flex items-center justify-between border-t border-slate-300 bg-white px-3 py-2 text-sm">
        <p className="text-slate-600">
          Page {pagination.page} of {pagination.maxPage} ({pagination.total} total)
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!pagination.canGoPrev} onClick={pagination.goPrev}>
            Previous
          </Button>
          <Button variant="ghost" disabled={!pagination.canGoNext} onClick={pagination.goNext}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
