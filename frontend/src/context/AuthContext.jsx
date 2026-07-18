import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AUTH_STATUS,
  SESSION_END_REASONS,
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

  const terminateLocalSession = useCallback((
    reason = SESSION_END_REASONS.LOCAL_CLEAR,
  ) => {
    tokenStorage.clearTokens();
    queryClient.clear();
    setUser(null);
    setStatus(AUTH_STATUS.UNAUTHENTICATED);

    window.dispatchEvent(
      new CustomEvent("jnl:session-ended", {
        detail: {
          reason,
        },
      }),
    );
  }, []);

  const clearSession = useCallback(
    () =>
      terminateLocalSession(
        SESSION_END_REASONS.LOCAL_CLEAR,
      ),
    [terminateLocalSession],
  );

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
          terminateLocalSession(
            SESSION_END_REASONS.RESTORE_FAILED,
          );
        }
      }
    }

    restoreSession();

    return () => {
      isCurrent = false;
    };
  }, [terminateLocalSession]);

  useEffect(() => {
    function handleAuthenticationExpired() {
      terminateLocalSession(
        SESSION_END_REASONS.SESSION_EXPIRED,
      );
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
  }, [terminateLocalSession]);

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
      terminateLocalSession(
        SESSION_END_REASONS.MANUAL_SIGNOUT,
      );
    }
  }, [terminateLocalSession]);

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
      terminateLocalSession,
      refreshCurrentUser,
    }),
    [
      status,
      user,
      login,
      logout,
      clearSession,
      terminateLocalSession,
      refreshCurrentUser,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
