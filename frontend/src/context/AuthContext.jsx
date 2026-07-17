import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AUTH_STATUS,
} from "../constants/auth";
import { queryClient } from "../app/queryClient";
import { authService } from "../services/authService";
import { tokenStorage } from "../services/tokenStorage";
import { AuthContext } from "./AuthContextValue";

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(
    () =>
      tokenStorage.hasRefreshToken()
        ? AUTH_STATUS.INITIALIZING
        : AUTH_STATUS.UNAUTHENTICATED,
  );
  const [user, setUser] = useState(null);

  const clearSession = useCallback(() => {
    tokenStorage.clearTokens();
    queryClient.clear();
    setUser(null);
    setStatus(AUTH_STATUS.UNAUTHENTICATED);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function restoreSession() {
      if (!tokenStorage.hasRefreshToken()) {
        return;
      }

      try {
        const currentUser =
          await authService.getCurrentUser();

        if (isCurrent) {
          setUser(currentUser);
          setStatus(
            AUTH_STATUS.AUTHENTICATED,
          );
        }
      } catch {
        if (isCurrent) {
          clearSession();
        }
      }
    }

    restoreSession();

    return () => {
      isCurrent = false;
    };
  }, [clearSession]);

  useEffect(() => {
    function handleAuthenticationExpired() {
      clearSession();
    }

    window.addEventListener(
      "jnl:authentication-expired",
      handleAuthenticationExpired,
    );

    return () => {
      window.removeEventListener(
        "jnl:authentication-expired",
        handleAuthenticationExpired,
      );
    };
  }, [clearSession]);

  const login = useCallback(
    async (credentials) => {
      const loginData =
        await authService.login(credentials);

      tokenStorage.setTokens({
        access: loginData.access,
        refresh: loginData.refresh,
      });

      setUser(loginData.user);
      setStatus(
        AUTH_STATUS.AUTHENTICATED,
      );

      return loginData;
    },
    [],
  );

  const refreshCurrentUser =
    useCallback(async () => {
      const currentUser =
        await authService.getCurrentUser();

      setUser(currentUser);
      return currentUser;
    }, []);

  const logout = useCallback(async () => {
    const refreshToken =
      tokenStorage.getRefreshToken();

    try {
      if (refreshToken) {
        await authService.logout(
          refreshToken,
        );
      }
    } catch {
      // Local session clearing remains mandatory
      // even when the API is unavailable.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      status,
      user,
      isInitializing:
        status === AUTH_STATUS.INITIALIZING,
      isAuthenticated:
        status === AUTH_STATUS.AUTHENTICATED,
      login,
      logout,
      clearSession,
      refreshCurrentUser,
    }),
    [
      status,
      user,
      login,
      logout,
      clearSession,
      refreshCurrentUser,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
