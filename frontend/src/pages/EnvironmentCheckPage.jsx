import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, Database, Server } from "lucide-react";

import { env } from "../config/env";
import { apiClient } from "../services/apiClient";

async function fetchHealthStatus() {
  const response = await apiClient.get("/health/");
  return response.data;
}

export function EnvironmentCheckPage() {
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["system-health"],
    queryFn: fetchHealthStatus,
    refetchInterval: 60_000,
  });

  const isConnected = data?.success === true;

  return (
    <main className="environment-page">
      <section className="environment-card">
        <div className="environment-brand">
          <div className="environment-logo">
            <Building2 size={28} />
          </div>

          <div>
            <p className="environment-company">
              {env.companyName}
            </p>
            <h1>{env.appName}</h1>
          </div>
        </div>

        <p className="environment-description">
          Phase 1 development environment verification
        </p>

        <div className="environment-status-grid">
          <article className="status-card">
            <Server size={22} />
            <div>
              <span>Frontend</span>
              <strong className="status-success">
                Operational
              </strong>
            </div>
          </article>

          <article className="status-card">
            <Activity size={22} />
            <div>
              <span>Backend API</span>
              <strong
                className={
                  isConnected
                    ? "status-success"
                    : "status-pending"
                }
              >
                {isLoading
                  ? "Checking..."
                  : isConnected
                    ? "Connected"
                    : "Unavailable"}
              </strong>
            </div>
          </article>

          <article className="status-card">
            <Database size={22} />
            <div>
              <span>Neon PostgreSQL</span>
              <strong
                className={
                  data?.data?.database === "connected"
                    ? "status-success"
                    : "status-pending"
                }
              >
                {isLoading
                  ? "Checking..."
                  : data?.data?.database ?? "Unavailable"}
              </strong>
            </div>
          </article>
        </div>

        {error ? (
          <div className="environment-error">
            <strong>Connection failed</strong>
            <p>{error.message}</p>
          </div>
        ) : null}

        {data ? (
          <div className="environment-response">
            <span>API response</span>
            <p>{data.message}</p>
            <small>
              Version: {data.data.api_version}
            </small>
          </div>
        ) : null}

        <button
          type="button"
          className="primary-button"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          {isLoading ? "Checking..." : "Check connection"}
        </button>
      </section>
    </main>
  );
}