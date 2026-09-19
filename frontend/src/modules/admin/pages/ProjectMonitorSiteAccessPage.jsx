import { Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useSitesDropdown,
  useUsersDropdown,
} from "../../../hooks/useOrganization";
import {
  useGrantSiteAccess,
  useRevokeSiteAccess,
  useSiteAccess,
} from "../../../hooks/useProjectMonitor";
import { apiErrorMessage } from "../../project_monitor/utils/finance";

/**
 * Admin page: which Project Managers own the DPR & Bills feed for
 * which site. A Project Manager sees and enters a site's DPR/billing
 * figures only while assigned here; Director and Admins always see
 * every site.
 */
export function ProjectMonitorSiteAccessPage() {
  const [siteId, setSiteId] = useState("");
  const [userId, setUserId] = useState("");

  const sitesQuery = useSitesDropdown();
  const managersQuery = useUsersDropdown({
    role: "PROJECT_MANAGER",
  });
  const accessQuery = useSiteAccess(siteId);
  const grantAccess = useGrantSiteAccess();
  const revokeAccess = useRevokeSiteAccess();

  const assigned = (accessQuery.data ?? []).filter(
    (row) => !siteId || row.site === siteId,
  );
  const assignedIds = new Set(
    assigned.map((row) => row.user),
  );
  const managers = (managersQuery.data ?? []).filter(
    (manager) => !assignedIds.has(manager.id),
  );

  const handleGrant = async (event) => {
    event.preventDefault();
    try {
      await grantAccess.mutateAsync({
        site: siteId,
        user: userId,
        role: "DPR_BILLS",
      });
      setUserId("");
    } catch {
      // Shown by the inline alert.
    }
  };

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Site Access</h1>
          <p>
            Choose which Project Managers can enter and see
            DPR quantities and RA bills for each site.
            Director and Admins always see every site.
          </p>
        </div>
        <div className="page-actions">
          <label className="filter-control">
            <span>Project / Site</span>
            <select
              value={siteId}
              onChange={(event) => {
                setSiteId(event.target.value);
                setUserId("");
              }}
            >
              <option value="">All sites</option>
              {(sitesQuery.data ?? []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.code} - {site.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {siteId ? (
        <SurfaceCard>
          <div className="surface-card__header">
            <h2>Assign a Project Manager</h2>
          </div>
          <form
            className="pm-inline-row"
            onSubmit={handleGrant}
          >
            <label
              className="form-field"
              style={{ minWidth: 300 }}
            >
              <span>Project Manager</span>
              <select
                value={userId}
                onChange={(event) =>
                  setUserId(event.target.value)
                }
                required
              >
                <option value="">
                  Select a Project Manager
                </option>
                {managers.map((manager) => (
                  <option
                    key={manager.id}
                    value={manager.id}
                  >
                    {manager.label ||
                      manager.full_name ||
                      manager.employee_id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="button button--primary"
              disabled={grantAccess.isPending || !userId}
            >
              <UserPlus size={16} /> Assign
            </button>
          </form>
          {grantAccess.isError ? (
            <div className="inline-alert inline-alert--error">
              {apiErrorMessage(grantAccess.error)}
            </div>
          ) : null}
        </SurfaceCard>
      ) : null}

      {accessQuery.isLoading ? (
        <AppLoader label="Loading site access..." />
      ) : accessQuery.isError ? (
        <ErrorState
          title="Site access unavailable"
          message={apiErrorMessage(accessQuery.error)}
          onRetry={() => accessQuery.refetch()}
        />
      ) : assigned.length === 0 ? (
        <EmptyState
          title="Nobody is assigned yet"
          message={
            siteId
              ? "Assign a Project Manager above to let them enter DPR and bills for this site."
              : "No Project Manager has been assigned to any site yet."
          }
        />
      ) : (
        <SurfaceCard>
          <div className="pm-table-wrap">
            <table className="pm-activity-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Project Manager</th>
                  <th>Employee ID</th>
                  <th>Role</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assigned.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.site_code} - {row.site_name}
                    </td>
                    <td>{row.user_name}</td>
                    <td>{row.user_employee_id}</td>
                    <td>DPR &amp; Bills entry</td>
                    <td>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${row.user_name} from ${row.site_code}? They will lose access to its DPR and bills.`,
                            )
                          ) {
                            revokeAccess.mutate(row.id);
                          }
                        }}
                        aria-label="Remove access"
                        title="Remove access"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
