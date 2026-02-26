"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/http";
import { publicOnboarding } from "@/lib/services/tenancy";

export default function OnboardingPage() {
  const [onboardingKey, setOnboardingKey] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await publicOnboarding(
        {
          tenant_name: tenantName,
          admin_email: adminEmail,
          admin_password: adminPassword,
          currency_code: currencyCode,
          timezone,
        },
        onboardingKey,
      );
      setSuccess(`Company created. Company ID (tenant_id): ${response.tenant_id}`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to onboard company"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold text-ink">Public Onboarding</h1>
        <p className="mt-1 text-sm text-slate-600">Create company + first admin using `X-Onboarding-Key`.</p>

        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <div className="sm:col-span-2">
            <Label>Onboarding Key</Label>
            <Input
              value={onboardingKey}
              onChange={(e) => setOnboardingKey(e.target.value)}
              placeholder="e.g. nalashaa"
              required
            />
          </div>
          <div>
            <Label>Company Name</Label>
            <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="e.g. Nalashaa" required />
          </div>
          <div>
            <Label>Admin Email</Label>
            <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Admin Password</Label>
            <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
          </div>
          <div>
            <Label>Currency</Label>
            <Input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} />
          </div>
          <div>
            <Label>Timezone</Label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <ErrorBanner message={error} />
            {success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <Button type="submit" disabled={busy}>{busy ? "Submitting..." : "Create Company"}</Button>
            <Link href="/login" className="text-sm text-ocean underline">Back to Login</Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
