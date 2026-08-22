import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";

interface User {
  id: string;
  name: string;
  username: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const userData = await api.getCurrentUser();
      setUser(userData);
    } catch (err) {
      // Only log out on 401 (invalid/expired token).
      // On 500 (transient Google Sheets error), keep the user logged in
      // and retry on next navigation.
      if (err instanceof ApiError && err.status === 401) {
        api.logout();
        setUser(null);
      }
      // For other errors (500, network), don't clear the session.
      // The token is still valid; the backend just had a temporary issue.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const signIn = async (username: string, password: string) => {
    const data = await api.login(username, password);
    setUser(data.user);
    return data;
  };

  const signOut = async () => {
    api.logout();
    setUser(null);
  };

  const isAuthenticated = !!user;

  return {
    user,
    setUser,
    isLoading,
    isAuthenticated,
    signIn,
    signOut,
    refreshUser: checkAuth,
  };
}
