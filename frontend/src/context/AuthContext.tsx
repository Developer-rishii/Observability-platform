import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { authApi } from '../api/services';

interface AuthContextType {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isVerifying: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('access_token');
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isVerifying, setIsVerifying] = useState<boolean>(true);

  // Authoritative server-side verification of user profile on boot
  useEffect(() => {
    let isMounted = true;
    const verifySession = async () => {
      const activeToken = localStorage.getItem('access_token');
      if (!activeToken) {
        if (isMounted) {
          setIsVerifying(false);
          setUser(null);
        }
        return;
      }

      try {
        const authoritativeUser = await authApi.getMe();
        if (isMounted) {
          setUser(authoritativeUser);
          localStorage.setItem('user_profile', JSON.stringify(authoritativeUser));
        }
      } catch {
        // If token expired or invalid, invalidate session
        if (isMounted) {
          setToken(null);
          setUser(null);
          localStorage.removeItem('access_token');
          localStorage.removeItem('user_profile');
        }
      } finally {
        if (isMounted) setIsVerifying(false);
      }
    };

    verifySession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('access_token', newToken);
    localStorage.setItem('user_profile', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_profile');
  };

  const refreshUser = async () => {
    try {
      const updatedUser = await authApi.getMe();
      setUser(updatedUser);
      localStorage.setItem('user_profile', JSON.stringify(updatedUser));
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token && !!user,
        isAdmin: !!user?.isAdmin,
        isVerifying,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
