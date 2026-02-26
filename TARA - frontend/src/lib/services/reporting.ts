import { apiGet } from "@/lib/api/http";
import { OperationalReport } from "@/lib/types/entities";

export function getOperationalReport() {
  return apiGet<OperationalReport>("/api/v1/reports/operational");
}
