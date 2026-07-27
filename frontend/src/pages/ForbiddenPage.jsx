import {
  ShieldX,
} from "lucide-react";
import {
  Link,
} from "react-router-dom";

export function ForbiddenPage() {
  return (
    <main className="system-state-page">
      <ShieldX size={54} />

      <span>403</span>
      <h1>Access denied</h1>

      <p>
        Your account does not have permission
        to access this page.
      </p>

      <Link
        className="button button--primary"
        to="/"
      >
        Go to my dashboard
      </Link>
    </main>
  );
}
