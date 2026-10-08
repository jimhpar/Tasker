import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, getToken, removeToken, getStoredUser, setStoredUser } from '../services/api';
import { syncGeminiKeyWithServer } from '../services/gemini';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState(() => {
    const explicitTheme = localStorage.getItem('tasker_user_explicit_theme');
    if (explicitTheme && ['Light', 'Gray', 'Dark'].includes(explicitTheme)) {
      return explicitTheme;
    }
    // Default strictly to Light
    localStorage.setItem('tasker_theme', 'Light');
    return 'Light';
  });

  // Apply theme class to document body
  const applyTheme = (t, isExplicitUserAction = false) => {
    const safeTheme = (t && ['Light', 'Gray', 'Dark'].includes(t)) ? t : 'Light';
    document.body.classList.remove('theme-dark', 'theme-gray', 'theme-light');
    const className = `theme-${safeTheme.toLowerCase()}`;
    document.body.classList.add(className);
    localStorage.setItem('tasker_theme', safeTheme);
    if (isExplicitUserAction) {
      localStorage.setItem('tasker_user_explicit_theme', safeTheme);
    }
    setThemeState(safeTheme);
  };

  useEffect(() => {
    localStorage.removeItem('tasker_is_admin');
    const explicitTheme = localStorage.getItem('tasker_user_explicit_theme');
    if (explicitTheme) {
      applyTheme(explicitTheme);
    } else {
      applyTheme('Light');
    }
    const token = getToken();
    const stored = getStoredUser();

    if (token && stored) {
      setUser(stored);
      syncGeminiKeyWithServer(stored).catch(() => {});
      if (explicitTheme) {
        applyTheme(explicitTheme);
      } else if (stored.settings?.theme && stored.settings.theme !== 'Dark') {
        applyTheme(stored.settings.theme);
      } else {
        applyTheme('Light');
      }
    }
    if (token) {
      authApi.getMe().then(serverUser => {
        if (serverUser && (serverUser._id || serverUser.id)) {
          const storedLatest = getStoredUser() || {};
          const enriched = {
            ...storedLatest,
            ...serverUser,
            _id: serverUser._id || serverUser.id,
            id: serverUser._id || serverUser.id
          };
          setStoredUser(enriched);
          setUser(enriched);
          syncGeminiKeyWithServer(enriched).catch(() => {});
        }
      }).catch(() => {});
    }
    setLoading(false);

    const handleUserUpdate = () => {
      const latestUser = getStoredUser();
      if (latestUser) {
        setUser(latestUser);
      }
    };
    window.addEventListener('tasker_user_updated', handleUserUpdate);
    return () => window.removeEventListener('tasker_user_updated', handleUserUpdate);
  }, []);

  const login = async (identifier, password) => {
    const res = await authApi.login(identifier, password);
    setUser(res.user);
    syncGeminiKeyWithServer(res.user).catch(() => {});
    const explicitTheme = localStorage.getItem('tasker_user_explicit_theme');
    if (explicitTheme) {
      applyTheme(explicitTheme);
    } else if (res.user.settings?.theme && res.user.settings.theme !== 'Dark') {
      applyTheme(res.user.settings.theme);
    } else {
      applyTheme('Light');
    }
    window.dispatchEvent(new CustomEvent('tasker_gemini_key_updated'));
    window.dispatchEvent(new CustomEvent('tasker_tasks_updated'));
    window.dispatchEvent(new CustomEvent('tasker_people_updated'));
    return res.user;
  };

  const register = async (data) => {
    const res = await authApi.register(data);
    setUser(res.user);
    syncGeminiKeyWithServer(res.user).catch(() => {});
    const explicitTheme = localStorage.getItem('tasker_user_explicit_theme');
    if (explicitTheme) {
      applyTheme(explicitTheme);
    } else if (res.user.settings?.theme && res.user.settings.theme !== 'Dark') {
      applyTheme(res.user.settings.theme);
    } else {
      applyTheme('Light');
    }
    window.dispatchEvent(new CustomEvent('tasker_gemini_key_updated'));
    window.dispatchEvent(new CustomEvent('tasker_tasks_updated'));
    window.dispatchEvent(new CustomEvent('tasker_people_updated'));
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('tasker_is_admin');
    removeToken();
    setUser(null);
    window.dispatchEvent(new CustomEvent('tasker_gemini_key_updated'));
    window.dispatchEvent(new CustomEvent('tasker_tasks_updated'));
    window.dispatchEvent(new CustomEvent('tasker_people_updated'));
  };

  const updateProfile = async (profileData) => {
    const { username, email, phone, ...pureProfile } = profileData;
    const res = await authApi.updateProfile(profileData);
    setUser((prev) => {
      const updatedUsername = res.username || username || prev?.username;
      const isUserAdmin = prev?.role === 'admin' ||
        ['zim', 'zim_founder', 'admin'].includes(updatedUsername?.toLowerCase());
      localStorage.removeItem('tasker_is_admin');
      return {
        ...prev,
        role: isUserAdmin ? 'admin' : (prev?.role || 'user'),
        email: email !== undefined ? email : (res.email || prev?.email),
        phone: phone !== undefined ? phone : (res.phone || prev?.phone),
        profile: { ...prev?.profile, ...(res.profile || pureProfile) },
        ...(updatedUsername ? { username: updatedUsername } : {})
      };
    });
  };

  const updateSettings = async (settingsData) => {
    const res = await authApi.updateSettings(settingsData);
    setUser((prev) => ({
      ...prev,
      settings: { ...prev?.settings, ...res.settings },
      ...(res.username ? { username: res.username } : {})
    }));
    if (settingsData.theme) {
      applyTheme(settingsData.theme, true);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        theme,
        setTheme: (newTheme) => applyTheme(newTheme, true),
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
