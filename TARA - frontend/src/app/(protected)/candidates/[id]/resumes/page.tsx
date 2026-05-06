"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Download, Eye, FileText, Layers, Loader2, Upload, X, XCircle } from "lucide-react";
import { ChangeEvent, useCallback, useRef, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { PaginationControls } from "@/components/common/pagination-controls";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import { formatDateTime } from "@/lib/utils/format";
import { getRowClassName } from "@/lib/utils/table-styles";
import { getResumeContent, getResumePreviewText, getResumeStatusPollInterval, listResumes, uploadResume } from "@/lib/services/resumes";
import { getCandidate } from "@/lib/services/candidates";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type BulkFileStatus = "pending" | "uploading" | "done" | "error";

interface BulkFileEntry {
  key: string;
  file: File;
  status: BulkFileStatus;
  error?: string;
}

export default function CandidateResumesPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewResumeId, setPreviewResumeId] = useState<number | null>(null);

  /* ---- bulk import state ---- */
  const [bulkFiles, setBulkFiles] = useState<BulkFileEntry[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);

  const { data: candidate } = useQuery({
    queryKey: queryKeys.candidates.detail(id),
    queryFn: () => getCandidate(id),
  });

  const resumeListQuery = useQuery({
    queryKey: [...queryKeys.candidates.resumes(id), page],
    queryFn: () => listResumes(id, { page, pageSize }),
    refetchInterval: (query) => getResumeStatusPollInterval(query.state.data),
  });
  const { data, isLoading } = resumeListQuery;

  const previewQuery = useQuery({
    queryKey: ["resume-preview-text", id, previewResumeId],
    queryFn: () => getResumePreviewText(id, previewResumeId!),
    enabled: previewResumeId !== null,
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error("Choose a file first");
      return uploadResume(id, selectedFile);
    },
    onSuccess: () => {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.resumes(id) });
    },
  });

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleDownload = async (resumeId: number, fileName: string) => {
    const blob = await getResumeContent(id, resumeId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ---- bulk import handlers ---- */
  const onBulkFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setBulkFiles(
      files.map((file) => ({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        status: "pending",
      })),
    );
    // reset input so the same selection can be re-triggered
    if (bulkInputRef.current) bulkInputRef.current.value = "";
  };

  const removeBulkFile = useCallback((key: string) => {
    setBulkFiles((prev) => prev.filter((f) => f.key !== key));
  }, []);

  const clearBulkFiles = useCallback(() => {
    setBulkFiles([]);
  }, []);

  const runBulkImport = useCallback(async () => {
    const pending = bulkFiles.filter((f) => f.status === "pending" || f.status === "error");
    if (pending.length === 0) return;

    setBulkRunning(true);

    for (const entry of pending) {
      setBulkFiles((prev) =>
        prev.map((f) => (f.key === entry.key ? { ...f, status: "uploading" } : f)),
      );
      try {
        await uploadResume(id, entry.file);
        setBulkFiles((prev) =>
          prev.map((f) => (f.key === entry.key ? { ...f, status: "done" } : f)),
        );
      } catch (err) {
        setBulkFiles((prev) =>
          prev.map((f) =>
            f.key === entry.key
              ? { ...f, status: "error", error: getApiErrorMessage(err, "Upload failed") }
              : f,
          ),
        );
      }
    }

    setBulkRunning(false);
    queryClient.invalidateQueries({ queryKey: queryKeys.candidates.resumes(id) });
  }, [bulkFiles, id, queryClient]);

  const candidateName = candidate
    ? `${candidate.first_name} ${candidate.last_name}`
    : `Candidate #${id}`;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const bulkDoneCount = bulkFiles.filter((f) => f.status === "done").length;
  const bulkErrorCount = bulkFiles.filter((f) => f.status === "error").length;
  const bulkPendingCount = bulkFiles.filter((f) => f.status === "pending").length;
  const bulkHasRetriable = bulkFiles.some((f) => f.status === "error");
  const allDone = bulkFiles.length > 0 && bulkFiles.every((f) => f.status === "done");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/candidates/${id}`}
          className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to {candidateName}
        </Link>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <FileText className="size-6 text-slate-600" />
          <div>
            <p className="text-lg font-semibold text-slate-900">Resume Manager</p>
            <p className="text-sm text-slate-600">Manage resumes for {candidateName}</p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <Upload className="size-4 text-slate-600" />
            <p className="text-sm font-semibold text-slate-900">Upload Resume</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={onFileChange}
              className="text-sm text-slate-700 file:mr-2 file:rounded file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
            />
            <Button
              type="button"
              onClick={() => uploadMutation.mutate()}
              disabled={!selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>

            {/* Bulk Import trigger */}
            <input
              ref={bulkInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              multiple
              className="hidden"
              onChange={onBulkFilesSelected}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => bulkInputRef.current?.click()}
              disabled={bulkRunning}
              className="inline-flex items-center gap-2"
            >
              <Layers className="size-4" />
              Bulk Import
            </Button>
          </div>
          <ErrorBanner
            message={uploadMutation.error ? getApiErrorMessage(uploadMutation.error, "Upload failed.") : null}
          />
          {uploadMutation.isSuccess ? (
            <ErrorBanner message="Resume uploaded successfully." severity="success" />
          ) : null}
        </div>

        {/* Bulk Import Panel */}
        {bulkFiles.length > 0 ? (
          <div className="rounded border border-slate-200 bg-white">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-slate-600" />
                <p className="text-sm font-semibold text-slate-900">
                  Bulk Import&nbsp;
                  <span className="font-normal text-slate-500">
                    ({bulkFiles.length} file{bulkFiles.length !== 1 ? "s" : ""})
                  </span>
                </p>
                {bulkRunning ? (
                  <span className="flex items-center gap-1 text-xs text-blue-600">
                    <Loader2 className="size-3 animate-spin" />
                    Uploading…
                  </span>
                ) : allDone ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="size-3" />
                    All done
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {!allDone && (
                  <Button
                    type="button"
                    onClick={runBulkImport}
                    disabled={bulkRunning || bulkPendingCount + bulkErrorCount === 0}
                    className="h-7 px-3 text-xs"
                  >
                    {bulkRunning
                      ? `Uploading ${bulkDoneCount + 1}/${bulkFiles.length}…`
                      : bulkHasRetriable
                        ? `Retry Failed (${bulkErrorCount})`
                        : `Import All (${bulkPendingCount})`}
                  </Button>
                )}
                {!bulkRunning && (
                  <button
                    type="button"
                    onClick={clearBulkFiles}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Clear list"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Summary bar */}
            {(bulkDoneCount > 0 || bulkErrorCount > 0) && (
              <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs">
                <span className="text-emerald-700">{bulkDoneCount} uploaded</span>
                {bulkErrorCount > 0 && (
                  <span className="text-red-600">{bulkErrorCount} failed</span>
                )}
                {bulkPendingCount > 0 && (
                  <span className="text-slate-500">{bulkPendingCount} pending</span>
                )}
              </div>
            )}

            {/* File list */}
            <ul className="max-h-64 divide-y divide-slate-100 overflow-auto">
              {bulkFiles.map((entry) => (
                <li key={entry.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                  {/* Status icon */}
                  <span className="shrink-0">
                    {entry.status === "done" && (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    )}
                    {entry.status === "error" && (
                      <XCircle className="size-4 text-red-500" />
                    )}
                    {entry.status === "uploading" && (
                      <Loader2 className="size-4 animate-spin text-blue-500" />
                    )}
                    {entry.status === "pending" && (
                      <FileText className="size-4 text-slate-400" />
                    )}
                  </span>

                  {/* File info */}
                  <span className="min-w-0 flex-1">
                    <span className="truncate font-medium text-slate-900">{entry.file.name}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {formatFileSize(entry.file.size)}
                    </span>
                    {entry.status === "error" && entry.error ? (
                      <span className="ml-2 text-xs text-red-600">{entry.error}</span>
                    ) : null}
                  </span>

                  {/* Remove button (only when not running) */}
                  {!bulkRunning && entry.status !== "done" && (
                    <button
                      type="button"
                      onClick={() => removeBulkFile(entry.key)}
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Remove"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Resume Table */}
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">
              Uploaded Resumes{" "}
              <span className="font-normal text-slate-500">({total})</span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-3 py-2 font-medium">File Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Size</th>
                  <th className="px-3 py-2 font-medium">Parse Status</th>
                  <th className="px-3 py-2 font-medium">Uploaded At</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-600" colSpan={6}>
                      Loading resumes...
                    </td>
                  </tr>
                ) : null}
                {!isLoading && items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-600" colSpan={6}>
                      No resumes uploaded yet.
                    </td>
                  </tr>
                ) : null}
                {items.map((resume, idx) => (
                  <tr key={resume.id} className={getRowClassName(idx)}>
                    <td className="px-3 py-2 text-slate-900">{resume.file_name}</td>
                    <td className="px-3 py-2 text-slate-700">{resume.content_type}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">
                      {formatFileSize(resume.size_bytes)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusChip value={resume.parse_status} />
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {formatDateTime(resume.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Download"
                          onClick={() => handleDownload(resume.id, resume.file_name)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                        >
                          <Download className="size-4" />
                        </button>
                        <button
                          type="button"
                          title="Preview text"
                          onClick={() =>
                            setPreviewResumeId(
                              previewResumeId === resume.id ? null : resume.id,
                            )
                          }
                          className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                        >
                          <Eye className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Preview panel */}
          {previewResumeId !== null ? (
            <div className="border-t border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Text Preview</p>
                <button
                  type="button"
                  onClick={() => setPreviewResumeId(null)}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  Close
                </button>
              </div>
              <div className="mt-2 max-h-60 overflow-auto rounded border border-slate-200 bg-white p-3">
                {previewQuery.isLoading ? (
                  <p className="text-sm text-slate-500">Loading preview...</p>
                ) : previewQuery.error ? (
                  <p className="text-sm text-red-600">Could not load preview.</p>
                ) : (
                  <pre className="whitespace-pre-wrap text-xs text-slate-700">
                    {previewQuery.data?.text || "No parsed text available."}
                  </pre>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}
