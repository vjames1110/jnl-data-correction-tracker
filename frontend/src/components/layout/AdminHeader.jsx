import {
  Bell,
  Menu,
} from "lucide-react";

import { env } from "../../config/env";
import { ProfileMenu } from "./ProfileMenu";
import { ServerClock } from "./ServerClock";

export function AdminHeader({
  onToggleSidebar,
}) {
  return (
    <header className="admin-header">
      <div className="admin-header__left">
        <button
          type="button"
          className="icon-button admin-header__menu"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
        >
          <Menu size={21} />
        </button>

        <div>
          <span className="admin-header__company">
            {env.companyName}
          </span>
          <strong className="admin-header__portal">
            Data Correction Tracker
          </strong>
        </div>
      </div>

      <div className="admin-header__right">
        <ServerClock />

        <button
          type="button"
          className="icon-button notification-button"
          aria-label="Notifications"
        >
          <Bell size={20} />
          <span className="notification-button__dot" />
        </button>

        <ProfileMenu />
      </div>
    </header>
  );
}