import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (_page: number) => void;
}

export function PaginationControls({ page, pageSize, total, onPageChange }: Props) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <p className="text-sm text-slate-600">
        Page {page} of {maxPage} ({total} total)
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="ghost" disabled={page >= maxPage} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
