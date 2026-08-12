import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "../../../hooks/useNotifications";

export function NotificationPreferencesPanel() {
  const preferencesQuery =
    useNotificationPreferences();
  const updatePreferences =
    useUpdateNotificationPreferences();

  const preference = preferencesQuery.data;
  const mutedEventTypes = new Set(
    preference?.muted_event_types ?? [],
  );

  function toggleChannel(field) {
    if (!preference) {
      return;
    }

    updatePreferences.mutate({
      [field]: !preference[field],
    });
  }

  function toggleMutedEvent(eventType) {
    if (!preference) {
      return;
    }

    const nextMuted = mutedEventTypes.has(
      eventType,
    )
      ? [...mutedEventTypes].filter(
          (value) => value !== eventType,
        )
      : [...mutedEventTypes, eventType];

    updatePreferences.mutate({
      muted_event_types: nextMuted,
    });
  }

  if (preferencesQuery.isLoading) {
    return (
      <AppLoader label="Loading notification preferences..." />
    );
  }

  if (preferencesQuery.isError) {
    return (
      <ErrorState
        title="Preferences unavailable"
        message={preferencesQuery.error?.message}
        onRetry={preferencesQuery.refetch}
      />
    );
  }

  return (
    <div className="notification-preferences">
      {updatePreferences.isError ? (
        <div className="inline-alert inline-alert--error">
          <strong>
            {updatePreferences.error?.message}
          </strong>
        </div>
      ) : null}

      <div className="notification-preferences__channels">
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={Boolean(
              preference?.in_app_enabled,
            )}
            onChange={() =>
              toggleChannel("in_app_enabled")
            }
          />
          In-app notifications
        </label>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={Boolean(
              preference?.email_enabled,
            )}
            onChange={() =>
              toggleChannel("email_enabled")
            }
          />
          Email notifications
        </label>
      </div>

      <div className="notification-preferences__events">
        <span className="notification-preferences__label">
          Muted events
        </span>

        <div className="notification-preferences__event-grid">
          {(
            preference?.available_event_types ??
            []
          ).map((eventType) => (
            <label
              key={eventType.value}
              className="toggle-field"
            >
              <input
                type="checkbox"
                checked={mutedEventTypes.has(
                  eventType.value,
                )}
                onChange={() =>
                  toggleMutedEvent(
                    eventType.value,
                  )
                }
              />
              {eventType.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
