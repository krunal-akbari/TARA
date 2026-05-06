import * as React from "react";

import { cn } from "@/lib/utils/cn";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-ocean focus-visible:ring-2 focus-visible:ring-ocean/40 focus-visible:ring-offset-1",
        className,
      )}
      {...props}
    />
  );
}
