import * as React from "react";

import { cn } from "@/lib/utils/cn";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-ink outline-none ring-0 focus:border-ocean",
        className,
      )}
      {...props}
    />
  );
}
