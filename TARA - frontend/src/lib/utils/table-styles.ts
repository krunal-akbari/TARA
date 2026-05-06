import { cn } from "@/lib/utils/cn";

export function getRowClassName(index: number) {
  return cn(
    index % 2 === 0 ? "bg-slate-50" : "bg-slate-100",
    "border-b border-white/50",
  );
}

export const LINE_INPUT_CLASS =
  "h-9 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:ring-2 focus-visible:ring-ocean/40";
