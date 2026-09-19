import { Menu } from "lucide-react";

import { env } from "../../config/env";
import { useModuleAccess } from "../../hooks/useModuleAccess";
import { NotificationBell } from "./NotificationBell";
import { ProfileMenu } from "./ProfileMenu";
import { ServerClock } from "./ServerClock";

export function JnlOpsHeader({
  onToggleSidebar,
}) {
  const { activeModule } = useModuleAccess();

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
            {env.appName}
            {activeModule ? (
              <span className="admin-header__module">
                {" "}
                / {activeModule.label}
              </span>
            ) : null}
          </strong>
        </div>
      </div>

      <div className="admin-header__right">
        <ServerClock />

        <NotificationBell />

        <ProfileMenu />
      </div>
    </header>
  );
}
