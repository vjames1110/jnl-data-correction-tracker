import { useState } from "react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { reconciliationOverviewPath } from "../../../constants/roles";
import { useAuth } from "../../../hooks/useAuth";
import {
  useReconciliationToleranceSettings,
  useUpdateReconciliationToleranceSettings,
} from "../../../hooks/useReconciliation";

function ToleranceSettingsForm({ settings }) {
  const updateSettings =
    useUpdateReconciliationToleranceSettings();
  const [form, setForm] = useState(() => ({
    default_tolerance_percentage:
      settings.default_tolerance_percentage,
    watch_multiplier:
      settings.watch_multiplier,
  }));

  return (
    <SurfaceCard>
      <form
        className="site-form"
        onSubmit={(event) => {
          event.preventDefault();
          updateSettings.mutate(form);
        }}
      >
        {updateSettings.error ? (
          <div className="inline-alert inline-alert--error">
            <strong>
              {updateSettings.error.message}
            </strong>
          </div>
        ) : null}
        {updateSettings.isSuccess ? (
          <div className="inline-alert inline-alert--success">
            Tolerance settings saved.
          </div>
        ) : null}

        <div className="form-grid">
          <label className="form-field">
            <span>
              Default Tolerance Percentage
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={
                form.default_tolerance_percentage
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  default_tolerance_percentage:
                    event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Watch Multiplier</span>
            <input
              type="number"
              step="0.01"
              min="1"
              value={form.watch_multiplier}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  watch_multiplier:
                    event.target.value,
                }))
              }
              required
            />
          </label>
        </div>
        <p className="table-subtext">
          Variance within the tolerance
          percentage is Within Tolerance; between
          tolerance and tolerance x multiplier is
          Watch; beyond that is Over Tolerance.
        </p>

        <div className="management-panel__actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending
              ? "Saving..."
              : "Save Settings"}
          </button>
        </div>
      </form>
    </SurfaceCard>
  );
}

export function StoreToleranceSettingsPage() {
  const { user } = useAuth();
  const settingsQuery =
    useReconciliationToleranceSettings();

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Store Reconciliation
          </span>
          <h1>Tolerance Settings</h1>
          <p>
            Controls when an entry's variance is
            classified Within Tolerance, Watch,
            or Over Tolerance. A period can
            override the default for itself.
          </p>
        </div>

        <Link
          className="button button--tertiary"
          to={reconciliationOverviewPath(
            user?.role,
          )}
        >
          Overview
        </Link>
      </div>

      {settingsQuery.isLoading ? (
        <AppLoader label="Loading tolerance settings..." />
      ) : settingsQuery.isError ? (
        <ErrorState
          title="Tolerance settings unavailable"
          message={settingsQuery.error?.message}
          onRetry={settingsQuery.refetch}
        />
      ) : (
        <ToleranceSettingsForm
          settings={settingsQuery.data}
        />
      )}
    </div>
  );
}
