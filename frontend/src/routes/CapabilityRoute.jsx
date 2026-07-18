import {
  Navigate,
  Outlet,
} from "react-router-dom";

import { AppLoader } from "../components/common/AppLoader";
import { ErrorState } from "../components/common/ErrorState";
import { AUTH_ROUTES } from "../constants/auth";
import {
  useAdminCapabilities,
} from "../hooks/useAdminCapabilities";

export function CapabilityRoute({
  requiredCapability,
}) {
  const capabilitiesQuery =
    useAdminCapabilities();

  if (capabilitiesQuery.isLoading) {
    return (
      <AppLoader
        label="Checking access..."
        fullScreen
      />
    );
  }

  if (capabilitiesQuery.isError) {
    return (
      <ErrorState
        title="Access check unavailable"
        message={
          capabilitiesQuery.error?.message
        }
        onRetry={capabilitiesQuery.refetch}
      />
    );
  }

  const capabilities =
    capabilitiesQuery.data?.capabilities ?? [];

  if (
    !capabilities.includes(requiredCapability)
  ) {
    return (
      <Navigate
        to={AUTH_ROUTES.FORBIDDEN}
        replace
      />
    );
  }

  return <Outlet />;
}
