import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, saveTokens, clearTokens, setOnUnauthorized } from '../lib/api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [regRole, setRegRole] = useState('CAREGIVER');
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    setOnUnauthorized(() => setUser(null));
    (async () => {
      try {
        const at = await SecureStore.getItemAsync('accessToken');
        if (!at) return;
        const { data } = await api.get('/auth/me');
        // /auth/me returns the session payload {id, role, email, fullName}
        setUser(data.data);
      } catch {
        await clearTokens();
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const signIn = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    await saveTokens(data.data.accessToken, data.data.refreshToken);
    setUser(data.data.user);
    return data.data.user;
  };

  const signUp = async ({ email, password, fullName, role }) => {
    const { data } = await api.post('/auth/register', { email, password, fullName, role });
    return data.data;
  };

  const signOut = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore — token may already be expired
    }
    await clearTokens();
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, regRole, setRegRole, booting, signIn, signUp, signOut }),
    [user, regRole, booting]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
