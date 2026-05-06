"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, FileText, Layers, Loader2, RefreshCw, Upload, XCircle } from "lucide-react";

import { ErrorBanner } from "@/components/common/error-banner";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api/http";
import { queryKeys } from "@/lib/query-keys";
import { createCandidate } from "@/lib/services/candidates";
import { extractResumePreview, listResumes, retryResumeParse, uploadResume } from "@/lib/services/resumes";
import { useBulkResumeParseStore } from "@/lib/stores/bulk-resume-parse-store";
import { formatDateTime, toTitleCase } from "@/lib/utils/format";

const MAX_PARSE_RETRIES = 2;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCandidateNameFromFileName(fileName: string) {
  const cleanName = fileName.replace(/\.[^.]+$/, "");
  const parts = cleanName
    .split(/[._\-\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => toTitleCase(part));

  if (parts.length === 0) {
    return { firstName: "Resume", lastName: "Candidate" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Candidate" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function getStageLabel(stage: string) {
  switch (stage) {
    case "extracting":
      return "extracting";
    case "creating_candidate":
      return "creating candidate";
    case "uploading_resume":
      return "uploading";
    case "processing_resume":
      return "processing";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "queued";
  }
}

function canRetryParse(item: {
  candidateId: number | null;
  resumeId: number | null;
  parseRetryCount: number;
}) {
  return item.candidateId !== null && item.resumeId !== null && item.parseRetryCount < MAX_PARSE_RETRIES;
}

export default function CandidateBulkParsePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const isUnmountedRef = useRef(false);
  const items = useBulkResumeParseStore((state) => state.items);
  const isRunning = useBulkResumeParseStore((state) => state.isRunning);
  const appendFiles = useBulkResumeParseStore((state) => state.appendFiles);
  const updateItem = useBulkResumeParseStore((state) => state.updateItem);
  const setRunning = useBulkResumeParseStore((state) => state.setRunning);
  const clearItems = useBulkResumeParseStore((state) => state.clearItems);
  const clearCompleted = useBulkResumeParseStore((state) => state.clearCompleted);

  const [pageError, setPageError] = useState<string | null>(null);

  const queuedItems = useMemo(
    () => items.filter((item) => item.stage === "queued"),
    [items],
  );
  const nextQueuedItem = useMemo(
    () => items.find((item) => item.stage === "queued") ?? null,
    [items],
  );
  const pollingItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.candidateId !== null &&
          item.resumeId !== null &&
          (item.parseStatus === "pending" || item.parseStatus === "processing"),
      ),
    [items],
  );

  const summary = useMemo(
    () => ({
      queued: items.filter((item) => item.stage === "queued").length,
      inProgress: items.filter((item) =>
        ["extracting", "creating_candidate", "uploading_resume", "processing_resume"].includes(item.stage),
      ).length,
      completed: items.filter((item) => item.stage === "completed").length,
      failed: items.filter((item) => item.stage === "failed").length,
    }),
    [items],
  );

  const retryableParseFailures = useMemo(
    () =>
      items.filter(
        (item) => item.stage === "failed" && item.parseStatus === "failed" && canRetryParse(item),
      ),
    [items],
  );

  useEffect(() => {
    if (!nextQueuedItem || isRunning) return;

    const runNextQueuedItem = async () => {
      setRunning(true);
      setPageError(null);

      try {
        updateItem(nextQueuedItem.id, { stage: "extracting", error: null });

        let extracted: Awaited<ReturnType<typeof extractResumePreview>> | null = null;
        try {
          extracted = await extractResumePreview(nextQueuedItem.file);
        } catch {
          extracted = null;
        }

        const fallbackName = getCandidateNameFromFileName(nextQueuedItem.file.name);
        const firstName = extracted?.first_name?.trim() || fallbackName.firstName;
        const lastName = extracted?.last_name?.trim() || fallbackName.lastName;
        const candidateName = `${firstName} ${lastName}`.trim();

        updateItem(nextQueuedItem.id, {
          stage: "creating_candidate",
          candidateName,
        });

        const candidate = await createCandidate({
          first_name: firstName,
          last_name: lastName,
          email: extracted?.email ?? undefined,
          phone: extracted?.phone ?? undefined,
          current_company: extracted?.current_company ?? undefined,
        });

        updateItem(nextQueuedItem.id, {
          stage: "uploading_resume",
          candidateId: candidate.id,
          candidateName,
        });

        const resume = await uploadResume(candidate.id, nextQueuedItem.file);

        updateItem(nextQueuedItem.id, {
          stage: resume.parse_status === "completed" ? "completed" : "processing_resume",
          candidateId: candidate.id,
          candidateName,
          resumeId: resume.id,
          parseStatus: resume.parse_status,
          createdAt: resume.created_at,
        });

        queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.candidates.resumes(candidate.id) });
      } catch (error) {
        updateItem(nextQueuedItem.id, {
          stage: "failed",
          error: getApiErrorMessage(error, "Bulk parse failed"),
        });
      } finally {
        if (!isUnmountedRef.current) {
          setRunning(false);
        }
      }
    };

    void runNextQueuedItem();
  }, [isRunning, nextQueuedItem, queryClient, setRunning, updateItem]);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (pollingItems.length === 0) return;

    let cancelled = false;

    const pollStatuses = async () => {
      const idsToPoll = Array.from(new Set(pollingItems.map((item) => item.candidateId).filter((value): value is number => value !== null)));

      await Promise.all(
        idsToPoll.map(async (candidateId) => {
          try {
            const response = await listResumes(candidateId, { page: 1, pageSize: 50 });
            if (cancelled) return;

            for (const item of pollingItems.filter((entry) => entry.candidateId === candidateId && entry.resumeId !== null)) {
              const matchedResume = response.items.find((resume) => resume.id === item.resumeId);
              if (!matchedResume || matchedResume.parse_status === item.parseStatus) continue;

              if (matchedResume.parse_status === "failed" && canRetryParse(item)) {
                const nextRetryCount = item.parseRetryCount + 1;

                updateItem(item.id, {
                  parseStatus: "pending",
                  parseRetryCount: nextRetryCount,
                  stage: "processing_resume",
                  error: `Retrying parse (${nextRetryCount}/${MAX_PARSE_RETRIES})...`,
                });

                try {
                  await retryResumeParse(candidateId, matchedResume.id);
                } catch (error) {
                  updateItem(item.id, {
                    parseStatus: "failed",
                    stage: "failed",
                    error: getApiErrorMessage(error, "Resume parse retry failed"),
                  });
                }
                continue;
              }

              updateItem(item.id, {
                parseStatus: matchedResume.parse_status,
                stage:
                  matchedResume.parse_status === "completed"
                    ? "completed"
                    : matchedResume.parse_status === "failed"
                      ? "failed"
                      : "processing_resume",
                error:
                  matchedResume.parse_status === "failed"
                    ? item.parseRetryCount >= MAX_PARSE_RETRIES
                      ? "Resume parsing failed after retries."
                      : "Resume parsing failed."
                    : null,
              });

              queryClient.invalidateQueries({ queryKey: queryKeys.candidates.detail(candidateId) });
              queryClient.invalidateQueries({ queryKey: queryKeys.candidates.resumes(candidateId) });
              queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
            }
          } catch (error) {
            if (cancelled) return;
            setPageError(getApiErrorMessage(error, "Failed to refresh parse statuses"));
          }
        }),
      );
    };

    pollStatuses();
    const intervalId = window.setInterval(pollStatuses, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [pollingItems, queryClient, updateItem]);

  const onRetryFailedParses = async () => {
    if (retryableParseFailures.length === 0) return;

    setPageError(null);

    await Promise.all(
      retryableParseFailures.map(async (item) => {
        if (item.candidateId === null || item.resumeId === null) return;

        const nextRetryCount = item.parseRetryCount + 1;
        updateItem(item.id, {
          parseStatus: "pending",
          parseRetryCount: nextRetryCount,
          stage: "processing_resume",
          error: `Retrying parse (${nextRetryCount}/${MAX_PARSE_RETRIES})...`,
        });

        try {
          await retryResumeParse(item.candidateId, item.resumeId);
        } catch (error) {
          updateItem(item.id, {
            parseStatus: "failed",
            stage: "failed",
            error: getApiErrorMessage(error, "Resume parse retry failed"),
          });
        }
      }),
    );
  };

  const onSelectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    appendFiles(files);
    event.target.value = "";
  };

  const hasItems = items.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/candidates" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
          <ArrowLeft className="size-4" />
          Back to Candidates
        </Link>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            multiple
            onChange={onSelectFiles}
            className="hidden"
          />
          <Button type="button" variant="ghost" onClick={() => inputRef.current?.click()}>
            <Upload className="mr-1.5 size-4" />
            Add Files
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.refresh()}>
            <RefreshCw className="mr-1.5 size-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <Layers className="size-6 text-slate-600" />
          <div>
            <p className="text-lg font-semibold text-slate-900">Bulk Parse</p>
            <p className="text-sm text-slate-600">Create candidates from multiple resume files and track parse status live.</p>
          </div>
        </div>

        <ErrorBanner message={pageError} onDismiss={() => setPageError(null)} />

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium uppercase text-slate-500">Queued</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{summary.queued}</p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium uppercase text-slate-500">In Progress</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{summary.inProgress}</p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium uppercase text-slate-500">Completed</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">{summary.completed}</p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium uppercase text-slate-500">Failed</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-red-600">{summary.failed}</p>
          </div>
        </div>

        {!hasItems ? (
          <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <FileText className="mx-auto size-8 text-slate-400" />
            <p className="mt-3 text-sm text-slate-600">No resumes selected yet.</p>
            <Button type="button" className="mt-4" onClick={() => inputRef.current?.click()}>
              Choose Files
            </Button>
          </div>
        ) : null}

        {hasItems ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-sm text-slate-600">
                {isRunning ? "Bulk parse is running." : "Bulk parse queue is ready."}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    void onRetryFailedParses();
                  }}
                  disabled={retryableParseFailures.length === 0}
                >
                  Retry Failed Parses
                </Button>
                <Button type="button" variant="ghost" onClick={clearCompleted} disabled={summary.completed === 0 || isRunning}>
                  Clear Completed
                </Button>
                <Button type="button" variant="ghost" onClick={clearItems} disabled={isRunning}>
                  Clear All
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="px-3 py-2 font-medium">File</th>
                    <th className="px-3 py-2 font-medium">Candidate</th>
                    <th className="px-3 py-2 font-medium">Queue Status</th>
                    <th className="px-3 py-2 font-medium">Parse Status</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{item.file.name}</p>
                          <p className="text-xs text-slate-500">{formatFileSize(item.file.size)}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {item.candidateId ? (
                          <Link href={`/candidates/${item.candidateId}`} className="font-medium text-blue-700 hover:underline">
                            {item.candidateName ?? `Candidate #${item.candidateId}`}
                          </Link>
                        ) : (
                          item.candidateName ?? "-"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-2">
                          {item.stage === "queued" ? (
                            <FileText className="size-4 text-slate-500" />
                          ) : item.stage === "completed" ? (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          ) : item.stage === "failed" ? (
                            <XCircle className="size-4 text-red-600" />
                          ) : (
                            <Loader2 className="size-4 animate-spin text-slate-500" />
                          )}
                          <span className="text-slate-700">{getStageLabel(item.stage)}</span>
                        </span>
                        {item.error ? <p className="mt-1 text-xs text-red-600">{item.error}</p> : null}
                      </td>
                      <td className="px-3 py-3">
                        {item.parseStatus ? <StatusChip value={item.parseStatus} /> : <span className="text-slate-500">-</span>}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {item.createdAt ? formatDateTime(item.createdAt) : "-"}
                      </td>
                      <td className="px-3 py-3">
                        {item.candidateId ? (
                          <Link href={`/candidates/${item.candidateId}/resumes`} className="text-blue-700 hover:underline">
                            Open Resume
                          </Link>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}
