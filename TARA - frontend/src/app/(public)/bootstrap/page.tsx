"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { config } from "@/lib/config";
import { getApiErrorMessage } from "@/lib/api/http";
import { bootstrapTenant } from "@/lib/services/tenancy";

export default function BootstrapPage() {
  const [bootstrapKey, setBootstrapKey] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!config.enableBootstrapPage) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6">
        <Card className="w-full">
          <h1 className="text-xl font-semibold">Bootstrap UI Disabled</h1>
          <p className="mt-2 text-sm text-slate-600">Set `NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE=true` to access this page.</p>
          <Link href="/login" className="mt-3 inline-block text-sm text-ocean underline">Back to Login</Link>
        </Card>
      </div>
    );
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await bootstrapTenant(
        {
          tenant_name: tenantName,
          admin_email: adminEmail,
          admin_password: adminPassword,
        },
        bootstrapKey,
      );
      setSuccess(`Company bootstrapped. Company ID (tenant_id): ${response.tenant_id}`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to bootstrap company"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold text-ink">Admin Bootstrap</h1>
        <p className="mt-1 text-sm text-slate-600">Use `X-Bootstrap-Key` to create company + admin directly.</p>

        <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="bootstrap-key">Bootstrap Key</Label>
            <Input id="bootstrap-key" value={bootstrapKey} onChange={(e) => setBootstrapKey(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="company-name">Company Name</Label>
            <Input id="company-name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="admin-email">Admin Email</Label>
            <Input id="admin-email" type="email" autoComplete="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="admin-password">Admin Password</Label>
            <Input id="admin-password" type="password" autoComplete="new-password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
          </div>
          <ErrorBanner message={error} />
          {success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={busy}>{busy ? "Submitting..." : "Bootstrap"}</Button>
            <Link href="/login" className="text-sm text-ocean underline">Back to Login</Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
