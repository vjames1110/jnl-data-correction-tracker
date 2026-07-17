import { useState } from "react";
import {
  ChevronDown,
  KeyRound,
  LogOut,
  UserRound,
} from "lucide-react";
import {
  useNavigate,
} from "react-router-dom";

import {
  AUTH_ROUTES,
} from "../../constants/auth";
import { useAuth } from "../../hooks/useAuth";

export function ProfileMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] =
    useState(false);

  async function handleLogout() {
    setIsOpen(false);
    await logout();

    navigate(AUTH_ROUTES.LOGIN, {
      replace: true,
    });
  }

  return (
    <div className="profile-menu">
      <button
        type="button"
        className="profile-menu__trigger"
        onClick={() =>
          setIsOpen((current) => !current)
        }
        aria-expanded={isOpen}
      >
        <div className="profile-menu__avatar">
          {user?.first_name?.[0] ?? "A"}
        </div>

        <div className="profile-menu__identity">
          <strong>{user?.full_name}</strong>
          <span>
            {user?.role_display ??
              user?.role}
          </span>
        </div>

        <ChevronDown size={16} />
      </button>

      {isOpen ? (
        <div className="profile-menu__dropdown">
          <div className="profile-menu__summary">
            <UserRound size={18} />

            <div>
              <strong>{user?.full_name}</strong>
              <span>{user?.employee_id}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              navigate(
                AUTH_ROUTES.CHANGE_PASSWORD,
              );
            }}
          >
            <KeyRound size={17} />
            Change password
          </button>

          <button
            type="button"
            className="profile-menu__logout"
            onClick={handleLogout}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}