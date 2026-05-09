import * as Auth from "@/lib/_core/auth";
import { useEffect, useState } from "react";

export function useAuth() {
  const [user, setUser] = useState<Auth.User | null>(Auth.getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = Auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return {
    user,
    loading,
    isAuthenticated: Boolean(user),
    logout: Auth.signOut,
  };
}
