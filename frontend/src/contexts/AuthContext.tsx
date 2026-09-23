import React, { createContext, useContext, useState } from 'react';
import { scheduleRefresh } from '../services/api';

interface User {
  username: string;
  role: string;
  display_name?: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string, username: string, role: string, display_name?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (newToken: string, username: string, role: string, display_name?: string) => {
    setToken(newToken);
    const userData = { username, role, display_name };
    setUser(userData);
    localStorage.setItem('token', newToken);
    localStorage.setItem('access_token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    // Start auto-refresh schedule
    scheduleRefresh(newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
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
