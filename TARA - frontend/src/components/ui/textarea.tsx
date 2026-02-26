import * as React from "react";

import { cn } from "@/lib/utils/cn";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none ring-0 placeholder:text-slate-400 focus:border-ocean",
        className,
      )}
      {...props}
    />
  );
}
