"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChangeEvent, useState } from "react";

import { PaginationControls } from "@/components/common/pagination-controls";
import { StatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { queryKeys } from "@/lib/query-keys";
import { listResumes, uploadResume } from "@/lib/services/resumes";

export default function CandidateResumesPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.candidates.resumes(id),
    queryFn: () => listResumes(id, { page, pageSize }),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error("Choose a file first");
      return uploadResume(id, selectedFile);
    },
    onSuccess: () => {
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.resumes(id) });
    },
  });

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  return (
    <div>
      <Card className="mb-5">
        <h2 className="text-lg font-semibold">Upload Resume</h2>
        <div className="mt-3 flex items-center gap-3">
          <input type="file" onChange={onFileChange} />
          <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending || !selectedFile}>Upload</Button>
        </div>
        {uploadMutation.error ? <p className="mt-2 text-sm text-red-700">Upload failed.</p> : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Resume List</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-2 py-2">File</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Size</th>
                <th className="px-2 py-2">Parse Status</th>
                <th className="px-2 py-2">Uploaded At</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="px-2 py-3" colSpan={5}>Loading...</td></tr>
              ) : (data?.items ?? []).map((resume) => (
                <tr key={resume.id} className="border-b">
                  <td className="px-2 py-2">{resume.file_name}</td>
                  <td className="px-2 py-2">{resume.content_type}</td>
                  <td className="px-2 py-2">{resume.size_bytes}</td>
                  <td className="px-2 py-2"><StatusChip value={resume.parse_status} /></td>
                  <td className="px-2 py-2 text-xs">{resume.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationControls page={page} pageSize={pageSize} total={data?.total ?? 0} onPageChange={setPage} />
      </Card>
    </div>
  );
}
