import {
  Bell,
  Menu,
} from "lucide-react";

import { env } from "../../config/env";
import { ProfileMenu } from "./ProfileMenu";
import { ServerClock } from "./ServerClock";

export function DirectorHeader({
  onToggleSidebar,
}) {
  return (
    <header className="user-header director-header">
      <div className="user-header__left">
        <button
          type="button"
          className="icon-button user-header__menu"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
        >
          <Menu size={20} />
        </button>

        <div>
          <span className="user-header__company">
            {env.companyName}
          </span>
          <strong className="user-header__portal">
            Director Approval Portal
          </strong>
        </div>
      </div>

      <div className="user-header__right">
        <ServerClock />

        <button
          type="button"
          className="icon-button notification-button"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={19} />
          <span className="notification-button__dot" />
        </button>

        <ProfileMenu />
      </div>
    </header>
  );
}
