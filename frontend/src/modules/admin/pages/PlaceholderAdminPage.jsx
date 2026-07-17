import {
  Construction,
} from "lucide-react";
import {
  useLocation,
} from "react-router-dom";

const pageTitles = {
  "/admin/users": "User Management",
  "/admin/organization":
    "Organization Setup",
  "/admin/vouchers":
    "Voucher Configuration",
  "/admin/reports":
    "Reports and Analytics",
  "/admin/audit": "Audit Logs",
  "/admin/settings": "System Settings",
};

export function PlaceholderAdminPage() {
  const location = useLocation();

  const title =
    pageTitles[location.pathname] ??
    "Administration Module";

  return (
    <div className="placeholder-page">
      <div className="placeholder-page__icon">
        <Construction size={34} />
      </div>

      <span>Upcoming phase</span>
      <h1>{title}</h1>

      <p>
        The administration portal foundation is
        ready. This module will be implemented in
        its assigned development phase.
      </p>
    </div>
  );
}