"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { listUsers } from "@/lib/services/users";

export function useUserNameMap(userIds: Array<number | null | undefined>) {
  const uniqueUserIds = useMemo(
    () => Array.from(new Set(userIds.filter((id): id is number => typeof id === "number"))),
    [userIds],
  );

  const usersQuery = useQuery({
    queryKey: ["users", "owner-name-map"],
    queryFn: () => listUsers({ page: 1, pageSize: 100, includeDeleted: true }),
    enabled: uniqueUserIds.length > 0,
    staleTime: 300000,
  });

  const userNameMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const user of usersQuery.data?.items ?? []) {
      const firstName = user.first_name?.trim();
      if (firstName) {
        map.set(user.id, firstName);
        continue;
      }

      const emailPrefix = user.email?.split("@")[0]?.trim();
      if (emailPrefix) map.set(user.id, emailPrefix);
    }
    return map;
  }, [usersQuery.data?.items]);

  const getUserFirstName = useCallback((userId: number | null | undefined) => {
    if (userId === null || userId === undefined) return "-";
    return userNameMap.get(userId) ?? `#${userId}`;
  }, [userNameMap]);

  return { getUserFirstName, userNameMap };
}
