"use client";

import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { queryKeys } from "@/lib/query-keys";
import { getOperationalReport } from "@/lib/services/reporting";

export default function ReportingPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reporting.operational,
    queryFn: getOperationalReport,
  });

  return (
    <div>
      <PageHeader title="Reporting" subtitle="Operational metrics and reason distribution." />
      {isLoading ? <p className="text-sm text-slate-600">Loading report...</p> : null}
      {error ? <p className="text-sm text-red-700">Failed to load report.</p> : null}

      {data ? (
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <p>Jobs Total: <strong>{data.jobs_total}</strong></p>
            <p>Clients Total: <strong>{data.clients_total}</strong></p>
            <p>Business Partners Total: <strong>{data.vendors_total}</strong></p>
            <p>Candidates Total: <strong>{data.candidates_total}</strong></p>
            <p>Active Links Total: <strong>{data.active_links_total}</strong></p>
            <p>Route Transitions Total: <strong>{data.route_transitions_total}</strong></p>
          </div>

          <h2 className="mt-6 text-lg font-semibold">Route Reason Breakdown</h2>
          <div className="mt-3 space-y-2">
            {Object.entries(data.route_reason_breakdown).map(([reason, count]) => (
              <div key={reason} className="flex items-center gap-3 text-sm">
                <div className="w-44">{reason}</div>
                <div className="h-2 flex-1 rounded bg-slate-100">
                  <div className="h-2 rounded bg-ember" style={{ width: `${Math.min(100, count * 10)}%` }} />
                </div>
                <div className="w-10 text-right">{count}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
