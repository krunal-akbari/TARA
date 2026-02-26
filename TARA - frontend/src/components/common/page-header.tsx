import { Card } from "@/components/ui/card";

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Card className="mb-6 bg-sunrise-grid">
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-1 text-sm text-slate-700">{subtitle}</p>
    </Card>
  );
}
