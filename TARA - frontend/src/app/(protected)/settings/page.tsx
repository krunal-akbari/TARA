"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Settings, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/http";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/query-keys";
import { getTenantResumeUploadSettings, updateTenantResumeUploadSettings } from "@/lib/services/tenancy";
import { createUser, listUsers } from "@/lib/services/users";

type SettingsTab = "profile" | "tenant" | "users";
type UserRole = "hr" | "recruiter" | "manager" | "admin";

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "hr", label: "HR" },
  { value: "recruiter", label: "Recruiter" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const randomValues = new Uint32Array(12);
  crypto.getRandomValues(randomValues);
  let output = "";
  for (let index = 0; index < 12; index += 1) {
    output += alphabet[randomValues[index] % alphabet.length];
  }
  return output;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const isAdmin = useMemo(
    () => (session?.user?.roles ?? []).some((role) => role.trim().toLowerCase() === "admin"),
    [session?.user?.roles],
  );
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("hr");
  const [temporaryPassword, setTemporaryPassword] = useState(generateTempPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resumeUploadLimitMb, setResumeUploadLimitMb] = useState("");
  const [tenantSettingsFeedback, setTenantSettingsFeedback] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: queryKeys.users.list(1, false, ""),
    queryFn: () => listUsers({ page: 1, pageSize: 100, includeDeleted: false }),
    enabled: activeTab === "users" && isAdmin,
  });

  const tenantResumeUploadSettingsQuery = useQuery({
    queryKey: queryKeys.tenancy.resumeUploadSettings,
    queryFn: getTenantResumeUploadSettings,
    enabled: activeTab === "tenant" && isAdmin,
  });

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });

  const updateTenantResumeUploadSettingsMutation = useMutation({
    mutationFn: updateTenantResumeUploadSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenancy.resumeUploadSettings });
    },
  });

  const sortedUsers = useMemo(() => {
    const items = usersQuery.data?.items ?? [];
    return [...items].sort((a, b) => {
      const firstA = (a.first_name ?? "").trim().toLowerCase();
      const firstB = (b.first_name ?? "").trim().toLowerCase();
      const byFirst = firstA.localeCompare(firstB);
      if (byFirst !== 0) return byFirst;
      const lastA = (a.last_name ?? "").trim().toLowerCase();
      const lastB = (b.last_name ?? "").trim().toLowerCase();
      return lastA.localeCompare(lastB);
    });
  }, [usersQuery.data?.items]);

  useEffect(() => {
    if (!tenantResumeUploadSettingsQuery.data) return;
    setResumeUploadLimitMb(String(tenantResumeUploadSettingsQuery.data.bulk_parse_resume_limit_mb));
  }, [tenantResumeUploadSettingsQuery.data]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedFirst = firstName.trim();
    const normalizedLast = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedFirst || !normalizedLast || !normalizedEmail) {
      setFeedback("Enter first name, last name, and email.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setFeedback("Enter a valid email address.");
      return;
    }
    if (sortedUsers.some((user) => user.email.trim().toLowerCase() === normalizedEmail)) {
      setFeedback("A user with this email already exists.");
      return;
    }
    if (temporaryPassword.trim().length < 8) {
      setFeedback("Temporary password must be at least 8 characters.");
      return;
    }

    createUserMutation
      .mutateAsync({
        email: normalizedEmail,
        password: temporaryPassword.trim(),
        first_name: normalizedFirst,
        last_name: normalizedLast,
        role,
      })
      .then(() => {
        setFeedback(`User added. Copy the temporary password before closing.`);
        setFirstName("");
        setLastName("");
        setEmail("");
        setRole("hr");
        setTemporaryPassword(generateTempPassword());
      })
      .catch((err) => {
        setFeedback(getApiErrorMessage(err, "Failed to create user"));
      });
  };

  const onTenantSettingsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = resumeUploadLimitMb.trim();

    if (!normalized) {
      setTenantSettingsFeedback("Enter a limit in MB.");
      return;
    }

    const parsed = Number(normalized);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      setTenantSettingsFeedback("Resume upload limit must be a whole number between 1 and 100 MB.");
      return;
    }

    updateTenantResumeUploadSettingsMutation
      .mutateAsync({ bulk_parse_resume_limit_mb: parsed })
      .then((result) => {
        setResumeUploadLimitMb(String(result.bulk_parse_resume_limit_mb));
        setTenantSettingsFeedback(`Bulk parse limit updated to ${result.bulk_parse_resume_limit_mb} MB.`);
      })
      .catch((err) => {
        setTenantSettingsFeedback(getApiErrorMessage(err, "Failed to update resume upload limit"));
      });
  };

  const onResetTenantSettings = () => {
    updateTenantResumeUploadSettingsMutation
      .mutateAsync({ bulk_parse_resume_limit_mb: null })
      .then((result) => {
        setResumeUploadLimitMb(String(result.bulk_parse_resume_limit_mb));
        setTenantSettingsFeedback(`Using system default limit of ${result.bulk_parse_resume_limit_mb} MB.`);
      })
      .catch((err) => {
        setTenantSettingsFeedback(getApiErrorMessage(err, "Failed to reset resume upload limit"));
      });
  };

  const fullName = `${session?.user?.first_name ?? ""} ${session?.user?.last_name ?? ""}`.trim() || "Current User";

  return (
    <div className="space-y-4">
      <Card className="rounded-lg border-slate-300 bg-white px-5 py-4 shadow-none">
        <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
          <Settings className="size-5 text-slate-800" />
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeTab === "profile" ? "primary" : "ghost"}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </Button>
          {isAdmin ? (
            <Button
              type="button"
              variant={activeTab === "tenant" ? "primary" : "ghost"}
              onClick={() => setActiveTab("tenant")}
            >
              Tenant
            </Button>
          ) : null}
          {isAdmin ? (
            <Button
              type="button"
              variant={activeTab === "users" ? "primary" : "ghost"}
              onClick={() => setActiveTab("users")}
            >
              Users
            </Button>
          ) : null}
        </div>
      </Card>

      {activeTab === "profile" ? (
        <Card className="rounded-lg border-slate-300 bg-white px-5 py-4 shadow-none">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Profile</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-slate-200 px-3 py-2">
              <p className="text-xs text-slate-500">Name</p>
              <p className="text-sm text-slate-900">{fullName}</p>
            </div>
            <div className="rounded border border-slate-200 px-3 py-2">
              <p className="text-xs text-slate-500">Email</p>
              <p className="text-sm text-slate-900">{session?.user?.email ?? "-"}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {activeTab === "tenant" && isAdmin ? (
        <Card className="rounded-lg border-slate-300 bg-white px-5 py-4 shadow-none">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
            <Settings className="size-5 text-slate-700" />
            <h2 className="text-xl font-semibold text-slate-900">Tenant Settings</h2>
          </div>

          {tenantResumeUploadSettingsQuery.isLoading ? (
            <p className="text-sm text-slate-600">Loading tenant settings...</p>
          ) : (
            <form onSubmit={onTenantSettingsSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded border border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-500">Tenant</p>
                  <p className="text-sm text-slate-900">{tenantResumeUploadSettingsQuery.data?.tenant_name ?? "-"}</p>
                </div>
                <div className="rounded border border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-500">Current Mode</p>
                  <p className="text-sm text-slate-900">
                    {tenantResumeUploadSettingsQuery.data?.uses_system_default ? "System Default" : "Tenant Override"}
                  </p>
                </div>
              </div>

              <div className="max-w-sm space-y-1">
                <Label htmlFor="resume-upload-limit-mb">Bulk Parse Resume Limit (MB)</Label>
                <Input
                  id="resume-upload-limit-mb"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={resumeUploadLimitMb}
                  onChange={(event) => setResumeUploadLimitMb(event.target.value)}
                  placeholder="10"
                />
                <p className="text-xs text-slate-500">
                  This limit applies per resume file during bulk parse and manual resume upload.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={updateTenantResumeUploadSettingsMutation.isPending}>
                  {updateTenantResumeUploadSettingsMutation.isPending ? "Saving..." : "Save Limit"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={updateTenantResumeUploadSettingsMutation.isPending}
                  onClick={onResetTenantSettings}
                >
                  Use System Default
                </Button>
              </div>

              {tenantSettingsFeedback ? <p className="text-sm text-slate-700">{tenantSettingsFeedback}</p> : null}
            </form>
          )}
        </Card>
      ) : null}

      {activeTab === "users" && isAdmin ? (
        <>
          <Card className="rounded-lg border-slate-300 bg-white px-5 py-4 shadow-none">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
              <UserPlus className="size-5 text-violet-700" />
              <h2 className="text-xl font-semibold text-slate-900">Add User</h2>
            </div>

            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <Label htmlFor="user-first-name">First Name</Label>
                <Input
                  id="user-first-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="user-last-name">Last Name</Label>
                <Input
                  id="user-last-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Last name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="user-role">Role</Label>
                <select
                  id="user-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as UserRole)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="user-temp-password">Temporary Password</Label>
                <div className="relative">
                  <Input
                    id="user-temp-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={temporaryPassword}
                    onChange={(event) => setTemporaryPassword(event.target.value)}
                    placeholder="Temporary password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-500 hover:text-slate-700"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-5">
                <Button type="submit" disabled={createUserMutation.isPending} className="inline-flex items-center gap-2">
                  <UserPlus className="size-4" />
                  {createUserMutation.isPending ? "Adding..." : "Add User"}
                </Button>
              </div>
            </form>

            {feedback ? <p className="mt-3 text-sm text-slate-700">{feedback}</p> : null}
          </Card>

          <Card className="rounded-lg border-slate-300 bg-white px-5 py-4 shadow-none">
            <div className="mb-3 flex items-center gap-2">
              <Users className="size-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-900">Users</h2>
            </div>
            {usersQuery.isLoading ? <p className="text-sm text-slate-600">Loading users...</p> : null}
            {sortedUsers.length === 0 ? (
              <p className="text-sm text-slate-600">No users added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-700">
                      <th className="px-2 py-2 font-medium">Name</th>
                      <th className="px-2 py-2 font-medium">Email</th>
                      <th className="px-2 py-2 font-medium">Role</th>
                      <th className="px-2 py-2 font-medium">Temporary Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers.map((user) => (
                      <tr key={user.id} className="border-b border-slate-100 text-slate-800">
                        <td className="px-2 py-2">{`${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "-"}</td>
                        <td className="px-2 py-2">{user.email}</td>
                        <td className="px-2 py-2 uppercase">{user.roles.join(", ") || "-"}</td>
                        <td className="px-2 py-2 text-slate-500">Hidden (stored hashed)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}

      {activeTab === "users" && !isAdmin ? (
        <Card className="rounded-lg border-slate-300 bg-white px-5 py-4 shadow-none">
          <p className="text-sm text-slate-700">Only admin users can view and manage users.</p>
        </Card>
      ) : null}
    </div>
  );
}
