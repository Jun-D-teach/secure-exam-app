import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";

interface User {
  id: number;
  name: string;
  username: string;
  role: string;
  avatar: string;
  bio: string;
  nip?: string;
  nisn?: string;
  class_name?: string;
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
      if (err instanceof ApiError && err.status === 401) {
        api.logout();
        setUser(null);
      }
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
