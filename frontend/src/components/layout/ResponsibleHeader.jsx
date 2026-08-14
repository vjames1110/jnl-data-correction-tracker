import { Menu } from "lucide-react";

import { env } from "../../config/env";
import { NotificationBell } from "./NotificationBell";
import { ProfileMenu } from "./ProfileMenu";
import { ServerClock } from "./ServerClock";

export function ResponsibleHeader({
  onToggleSidebar,
}) {
  return (
    <header className="user-header responsible-header">
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
            Work Assignee Portal
          </strong>
        </div>
      </div>

      <div className="user-header__right">
        <ServerClock />

        <NotificationBell />

        <ProfileMenu />
      </div>
    </header>
  );
}
