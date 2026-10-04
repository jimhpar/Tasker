import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, getToken, removeToken, getStoredUser } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('tasker_theme') || 'Dark';
  });

  // Apply theme class to document body
  const applyTheme = (t) => {
    document.body.classList.remove('theme-dark', 'theme-gray', 'theme-light');
    const className = `theme-${t.toLowerCase()}`;
    document.body.classList.add(className);
    localStorage.setItem('tasker_theme', t);
    setThemeState(t);
  };

  useEffect(() => {
    applyTheme(theme);
    const token = getToken();
    const stored = getStoredUser();

    if (token && stored) {
      setUser(stored);
      if (stored.settings?.theme) {
        applyTheme(stored.settings.theme);
      }
    }
    setLoading(false);
  }, []);

  const login = async (identifier, password) => {
    const res = await authApi.login(identifier, password);
    setUser(res.user);
    if (res.user.settings?.theme) {
      applyTheme(res.user.settings.theme);
    }
    return res.user;
  };

  const register = async (data) => {
    const res = await authApi.register(data);
    setUser(res.user);
    if (res.user.settings?.theme) {
      applyTheme(res.user.settings.theme);
    }
    return res.user;
  };

  const logout = () => {
    removeToken();
    setUser(null);
  };

  const updateProfile = async (profileData) => {
    const res = await authApi.updateProfile(profileData);
    setUser((prev) => ({
      ...prev,
      profile: { ...prev?.profile, ...res.profile }
    }));
  };

  const updateSettings = async (settingsData) => {
    const res = await authApi.updateSettings(settingsData);
    setUser((prev) => ({
      ...prev,
      settings: { ...prev?.settings, ...res.settings },
      ...(res.username ? { username: res.username } : {})
    }));
    if (settingsData.theme) {
      applyTheme(settingsData.theme);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        theme,
        setTheme: applyTheme,
        login,
        register,
        logout,
        updateProfile,
        updateSettings
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
