import {
  ShieldX,
} from "lucide-react";
import {
  Link,
} from "react-router-dom";

import {
  AUTH_ROUTES,
} from "../constants/auth";

export function ForbiddenPage() {
  return (
    <main className="system-state-page">
      <ShieldX size={54} />

      <span>403</span>
      <h1>Access denied</h1>

      <p>
        Your account does not have permission
        to access the administration portal.
      </p>

      <Link
        className="button button--primary"
        to={AUTH_ROUTES.LOGIN}
      >
        Return to sign in
      </Link>
    </main>
  );
}