import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";

type Severity = "error" | "warning" | "info" | "success";

interface ErrorBannerProps {
  message: string | null;
  severity?: Severity;
  onDismiss?: () => void;
}

const config: Record<Severity, { icon: typeof AlertCircle; border: string; bg: string; text: string }> = {
  error: { icon: AlertCircle, border: "border-red-200", bg: "bg-red-50", text: "text-red-700" },
  warning: { icon: AlertTriangle, border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700" },
  info: { icon: Info, border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700" },
  success: { icon: CheckCircle, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700" },
};

export function ErrorBanner({ message, severity = "error", onDismiss }: ErrorBannerProps) {
  if (!message) return null;
  const { icon: Icon, border, bg, text } = config[severity];
  return (
    <div role="alert" aria-live="assertive" className={`flex items-start gap-2 rounded-md border ${border} ${bg} px-3 py-2 text-sm ${text}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="shrink-0 p-0.5 hover:opacity-70" aria-label="Dismiss">
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
