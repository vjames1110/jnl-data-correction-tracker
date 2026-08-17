import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

import { portalBasePath } from "../../constants/roles";
import { useAuth } from "../../hooks/useAuth";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useNotificationUnreadCount,
} from "../../hooks/useNotifications";
import { formatRelativeTime } from "../../utils/dates";
import {
  formatNotificationEvent,
  notificationSeverityTone,
} from "../../modules/notifications/utils/notificationDisplay";
import { AppLoader } from "../common/AppLoader";
import { ErrorState } from "../common/ErrorState";

const RECENT_PARAMS = {
  page_size: 8,
  ordering: "-created_at",
};

export function NotificationBell() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const notificationsQuery = useNotifications(
    RECENT_PARAMS,
  );
  const notifications =
    notificationsQuery.data?.items ?? [];
  const unreadCountQuery =
    useNotificationUnreadCount();
  const unreadCount =
    unreadCountQuery.data?.unread_count ?? 0;
  const hasUnread = unreadCount > 0;
  const markReadMutation =
    useMarkNotificationRead();
  const markAllReadMutation =
    useMarkAllNotificationsRead();
  const hasUnreadInPanel = notifications.some(
    (notification) => !notification.is_read,
  );
  const notificationsPath = `${portalBasePath(
    user?.role,
  )}/notifications`;

  const handleNotificationClick = (
    notification,
  ) => {
    setIsOpen(false);
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleOutsideClick(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target,
        )
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
  }, [isOpen]);

  return (
    <div
      className="notification-bell"
      ref={containerRef}
    >
      <button
        type="button"
        className="icon-button notification-button"
        aria-label="Notifications"
        aria-expanded={isOpen}
        title="Notifications"
        onClick={() =>
          setIsOpen((current) => !current)
        }
      >
        <Bell size={19} />
        {hasUnread ? (
          <span className="notification-button__dot">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="notification-panel">
          <div className="notification-panel__header">
            <strong>Notifications</strong>
            <Link
              to={notificationsPath}
              onClick={() => setIsOpen(false)}
            >
              View all
            </Link>
          </div>
          {hasUnreadInPanel ? (
            <div className="notification-panel__tools">
              <button
                type="button"
                className="button button--tertiary notification-panel__action"
                disabled={
                  markAllReadMutation.isPending
                }
                onClick={() =>
                  markAllReadMutation.mutate()
                }
              >
                Mark all read
              </button>
            </div>
          ) : null}

          <div className="notification-panel__body">
            {notificationsQuery.isLoading ? (
              <AppLoader label="Loading notifications..." />
            ) : notificationsQuery.isError ? (
              <ErrorState
                title="Notifications unavailable"
                message={
                  notificationsQuery.error
                    ?.message
                }
                onRetry={
                  notificationsQuery.refetch
                }
              />
            ) : notifications.length === 0 ? (
              <p className="notification-panel__empty">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="notification-panel__list">
                {notifications.map(
                  (notification) => {
                    const itemContent = (
                      <>
                        <span
                          className={`notification-dot notification-dot--${notificationSeverityTone(
                            notification.severity,
                          )}`}
                        />
                        <div>
                          <p className="notification-panel__title">
                            {notification.title ||
                              formatNotificationEvent(
                                notification.event_type,
                              )}
                          </p>
                          <span className="notification-panel__time">
                            {formatRelativeTime(
                              notification.created_at,
                            )}
                          </span>
                        </div>
                      </>
                    );

                    return (
                      <li
                        key={notification.id}
                        className={
                          notification.is_read
                            ? "notification-panel__item"
                            : "notification-panel__item notification-panel__item--unread"
                        }
                      >
                        {notification.deep_link ? (
                          <Link
                            to={
                              notification.deep_link
                            }
                            onClick={() =>
                              handleNotificationClick(
                                notification,
                              )
                            }
                          >
                            {itemContent}
                          </Link>
                        ) : (
                          <div>{itemContent}</div>
                        )}
                      </li>
                    );
                  },
                )}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
