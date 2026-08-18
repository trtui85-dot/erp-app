import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { http, setAccessToken, onAuthError } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    http.post("/auth/refresh", {})
      .then((d) => active && (setAccessToken(d.data.token), setUser(d.data.user)))
      .catch(() => {})
      .finally(() => active && setReady(true));
    return () => (active = false);
  }, []);

  const login = useCallback(async (phone, pin) => {
    const d = await http.post("/auth/login", { phone, pin });
    setAccessToken(d.data.token);
    setUser(d.data.user);
    return d.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await http.post("/auth/logout"); } catch {}
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    onAuthError(() => setUser(null));
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
