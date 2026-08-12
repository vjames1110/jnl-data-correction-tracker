import { useMemo, useState } from "react";
import { Filter, Search, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { useNotifications } from "../../../hooks/useNotifications";
import { formatDateTime } from "../../../utils/dates";
import { NotificationPreferencesPanel } from "../components/NotificationPreferencesPanel";
import {
  formatNotificationEvent,
  notificationSeverityTone,
} from "../utils/notificationDisplay";

function buildParams(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) =>
        value !== "" &&
        value !== null &&
        value !== undefined,
    ),
  );
}

export function NotificationsPage() {
  const [showPreferences, setShowPreferences] =
    useState(false);
  const [filters, setFilters] = useState({
    search: "",
    severity: "",
    ordering: "-created_at",
    page: 1,
  });

  const queryParams = useMemo(
    () => buildParams(filters),
    [filters],
  );
  const notificationsQuery = useNotifications(
    queryParams,
  );
  const notifications =
    notificationsQuery.data?.items ?? [];
  const pagination =
    notificationsQuery.data?.meta?.pagination;

  const setFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  return (
    <div className="notifications-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Notification Center
          </span>
          <h1>Notifications</h1>
          <p>
            Review workflow alerts delivered to
            your account.
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() =>
              setShowPreferences(
                (current) => !current,
              )
            }
          >
            <Settings2 size={16} />
            Preferences
          </button>
        </div>
      </div>

      {showPreferences ? (
        <SurfaceCard title="Notification preferences">
          <NotificationPreferencesPanel />
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <div className="user-request-toolbar">
          <label className="input-control">
            <Search size={16} />
            <input
              value={filters.search}
              onChange={(event) =>
                setFilter(
                  "search",
                  event.target.value,
                )
              }
              placeholder="Search title, message or reference"
            />
          </label>

          <label className="filter-control">
            <Filter size={15} />
            <select
              value={filters.severity}
              onChange={(event) =>
                setFilter(
                  "severity",
                  event.target.value,
                )
              }
            >
              <option value="">
                All severities
              </option>
              <option value="INFO">Info</option>
              <option value="SUCCESS">
                Success
              </option>
              <option value="WARNING">
                Warning
              </option>
              <option value="CRITICAL">
                Critical
              </option>
            </select>
          </label>

          <label className="filter-control">
            <span>Order</span>
            <select
              value={filters.ordering}
              onChange={(event) =>
                setFilter(
                  "ordering",
                  event.target.value,
                )
              }
            >
              <option value="-created_at">
                Newest first
              </option>
              <option value="created_at">
                Oldest first
              </option>
            </select>
          </label>
        </div>

        {notificationsQuery.isLoading ? (
          <AppLoader label="Loading notifications..." />
        ) : notificationsQuery.isError ? (
          <ErrorState
            title="Notifications unavailable"
            message={
              notificationsQuery.error?.message
            }
            onRetry={notificationsQuery.refetch}
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No notifications"
            message="Workflow alerts will appear here as they happen."
          />
        ) : (
          <ul className="notification-list">
            {notifications.map((notification) => {
              const itemContent = (
                <>
                  <span
                    className={`notification-dot notification-dot--${notificationSeverityTone(
                      notification.severity,
                    )}`}
                  />
                  <div className="notification-list__content">
                    <div className="notification-list__heading">
                      <strong>
                        {notification.title ||
                          formatNotificationEvent(
                            notification.event_type,
                          )}
                      </strong>
                      <span
                        className={`request-status request-status--${notificationSeverityTone(
                          notification.severity,
                        )}`}
                      >
                        {formatNotificationEvent(
                          notification.event_type,
                        )}
                      </span>
                    </div>

                    {notification.message ? (
                      <p>{notification.message}</p>
                    ) : null}

                    <div className="notification-list__meta">
                      {notification.request_reference ? (
                        <span>
                          {
                            notification.request_reference
                          }
                        </span>
                      ) : null}
                      <span>
                        {formatDateTime(
                          notification.created_at,
                        )}
                      </span>
                      {!notification.is_read ? (
                        <span className="notification-list__unread">
                          Unread
                        </span>
                      ) : null}
                    </div>
                  </div>
                </>
              );

              return (
                <li
                  key={notification.id}
                  className={
                    notification.is_read
                      ? "notification-list__item"
                      : "notification-list__item notification-list__item--unread"
                  }
                >
                  {notification.deep_link ? (
                    <Link
                      to={notification.deep_link}
                      className="notification-list__link"
                    >
                      {itemContent}
                    </Link>
                  ) : (
                    <div className="notification-list__link">
                      {itemContent}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {pagination ? (
          <div className="pagination-bar">
            <span>
              Page {pagination.page} of{" "}
              {pagination.total_pages}
            </span>
            <div>
              <button
                type="button"
                className="button button--tertiary"
                disabled={
                  !pagination.has_previous
                }
                onClick={() =>
                  setFilter(
                    "page",
                    pagination.page - 1,
                  )
                }
              >
                Previous
              </button>
              <button
                type="button"
                className="button button--tertiary"
                disabled={!pagination.has_next}
                onClick={() =>
                  setFilter(
                    "page",
                    pagination.page + 1,
                  )
                }
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </SurfaceCard>
    </div>
  );
}
