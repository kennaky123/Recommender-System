import React, { createContext, useCallback, useContext, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser, loginUser, registerUser } from '@/api';
import { AUTH_TOKEN_KEY } from '@/lib/httpClient';
import { vodQueryKeys } from '@/lib/queryClient';
import { AuthUser } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  activeUserId: number;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (payload: { email: string; password: string }) => Promise<AuthUser>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
  }) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState<boolean>(() =>
    Boolean(window.localStorage.getItem(AUTH_TOKEN_KEY))
  );

  const { data: user = null, isLoading } = useQuery({
    queryKey: vodQueryKeys.authMe(),
    queryFn: ({ signal }) => fetchCurrentUser(signal),
    enabled: hasToken,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (res) => {
      window.localStorage.setItem(AUTH_TOKEN_KEY, res.token);
      setHasToken(true);
      queryClient.setQueryData(vodQueryKeys.authMe(), res.user);
      queryClient.invalidateQueries({ queryKey: vodQueryKeys.all });
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (res) => {
      window.localStorage.setItem(AUTH_TOKEN_KEY, res.token);
      setHasToken(true);
      queryClient.setQueryData(vodQueryKeys.authMe(), res.user);
      queryClient.invalidateQueries({ queryKey: vodQueryKeys.all });
    },
  });

  const login = useCallback(
    async (payload: { email: string; password: string }) => {
      const res = await loginMutation.mutateAsync(payload);
      return res.user;
    },
    [loginMutation]
  );

  const register = useCallback(
    async (payload: { name: string; email: string; password: string }) => {
      const res = await registerMutation.mutateAsync(payload);
      return res.user;
    },
    [registerMutation]
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    setHasToken(false);
    queryClient.setQueryData(vodQueryKeys.authMe(), null);
    queryClient.invalidateQueries({ queryKey: vodQueryKeys.all });
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        activeUserId: user?.id ?? 1,
        isAuthenticated: Boolean(user),
        isAuthLoading: hasToken && isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
