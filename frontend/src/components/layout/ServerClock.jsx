import { CalendarDays } from "lucide-react";

import {
  useServerClock,
} from "../../hooks/useServerClock";
import {
  formatDisplayDate,
  formatDisplayTime,
} from "../../utils/dates";

export function ServerClock() {
  const {
    currentTime,
    timezone,
    isLoading,
  } = useServerClock();

  return (
    <div className="server-clock">
      <CalendarDays size={18} />

      <div>
        <span>
          {isLoading
            ? "Synchronizing..."
            : formatDisplayDate(currentTime)}
        </span>

        <strong>
          {formatDisplayTime(currentTime)}
        </strong>
      </div>

      {timezone ? (
        <small>{timezone}</small>
      ) : null}
    </div>
  );
}