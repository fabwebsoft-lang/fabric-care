import { useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { getSessionToken, getCachedUser, clearAllSession } from "@/lib/session";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(_options?: UseAuthOptions) {
  const utils = trpc.useUtils();
  const token = typeof window !== "undefined" ? getSessionToken() : null;
  const cachedUser = typeof window !== "undefined" ? getCachedUser() : null;

  const meQuery = trpc.auth.me.useQuery();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {}
    clearAllSession();
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    const user = meQuery.data ?? (token ? cachedUser : null);
    const isLoading = token ? meQuery.isLoading && !user : false;

    return {
      user: user ?? null,
      loading: isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(user),
    };
  }, [
    token,
    cachedUser,
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
