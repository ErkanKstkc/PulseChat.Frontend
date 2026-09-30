'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AXIOS_INSTANCE } from '@/api/axios-instance';
import { signalRService } from '@/lib/signalr';

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Restore session on mount
    try {
      const storedToken = localStorage.getItem('pulsechat_token');
      const storedUser = localStorage.getItem('pulsechat_user');

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);

        // Connect to SignalR
        signalRService.startConnection(storedToken).catch((err) => {
          console.warn('[SignalR] Initial connection failed:', err);
        });
      }
    } catch (e) {
      console.error('[Auth] Failed to restore session from storage:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (emailOrUsername: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await AXIOS_INSTANCE.post('/api/Auth/login', {
        emailOrUsername,
        password,
      });

      if (response.data?.isSuccess && response.data?.data) {
        const { accessToken, refreshToken, user: loggedInUser } = response.data.data;

        localStorage.setItem('pulsechat_token', accessToken);
        localStorage.setItem('pulsechat_refresh_token', refreshToken);
        localStorage.setItem('pulsechat_user_id', loggedInUser.id);
        localStorage.setItem('pulsechat_user', JSON.stringify(loggedInUser));

        setToken(accessToken);
        setUser(loggedInUser);

        // Start SignalR connection
        await signalRService.startConnection(accessToken);
      } else {
        throw new Error(response.data?.message || 'Giriş yapılamadı.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await AXIOS_INSTANCE.post('/api/Auth/register', {
        username,
        email,
        password,
      });

      if (response.data?.isSuccess && response.data?.data) {
        const { accessToken, refreshToken, user: registeredUser } = response.data.data;

        localStorage.setItem('pulsechat_token', accessToken);
        localStorage.setItem('pulsechat_refresh_token', refreshToken);
        localStorage.setItem('pulsechat_user_id', registeredUser.id);
        localStorage.setItem('pulsechat_user', JSON.stringify(registeredUser));

        setToken(accessToken);
        setUser(registeredUser);

        // Start SignalR connection
        await signalRService.startConnection(accessToken);
      } else {
        throw new Error(response.data?.message || 'Kayıt yapılamadı.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('pulsechat_token');
    localStorage.removeItem('pulsechat_refresh_token');
    localStorage.removeItem('pulsechat_user_id');
    localStorage.removeItem('pulsechat_user');

    setToken(null);
    setUser(null);

    signalRService.stopConnection().catch(console.error);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
