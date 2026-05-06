"use client";

import { create } from "zustand";

export type BulkParseStage =
  | "queued"
  | "extracting"
  | "creating_candidate"
  | "uploading_resume"
  | "processing_resume"
  | "completed"
  | "failed";

export interface BulkParseQueueItem {
  id: string;
  file: File;
  stage: BulkParseStage;
  candidateId: number | null;
  candidateName: string | null;
  resumeId: number | null;
  parseStatus: string | null;
  parseRetryCount: number;
  createdAt: string | null;
  error: string | null;
}

interface BulkResumeParseState {
  items: BulkParseQueueItem[];
  isRunning: boolean;
  replaceFiles: (_files: File[]) => void;
  appendFiles: (_files: File[]) => void;
  updateItem: (_id: string, _patch: Partial<BulkParseQueueItem>) => void;
  setRunning: (_value: boolean) => void;
  clearItems: () => void;
  clearCompleted: () => void;
}

function createQueueItem(file: File): BulkParseQueueItem {
  return {
    id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
    file,
    stage: "queued",
    candidateId: null,
    candidateName: null,
    resumeId: null,
    parseStatus: null,
    parseRetryCount: 0,
    createdAt: null,
    error: null,
  };
}

export const useBulkResumeParseStore = create<BulkResumeParseState>((set) => ({
  items: [],
  isRunning: false,
  replaceFiles: (files) => set({ items: files.map(createQueueItem), isRunning: false }),
  appendFiles: (files) =>
    set((state) => ({
      items: [...state.items, ...files.map(createQueueItem)],
    })),
  updateItem: (id, patch) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })),
  setRunning: (value) => set({ isRunning: value }),
  clearItems: () => set({ items: [], isRunning: false }),
  clearCompleted: () =>
    set((state) => ({
      items: state.items.filter((item) => item.stage !== "completed"),
    })),
}));
