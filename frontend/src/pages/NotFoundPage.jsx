import {
  FileQuestion,
} from "lucide-react";
import {
  Link,
} from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="system-state-page">
      <FileQuestion size={54} />

      <span>404</span>
      <h1>Page not found</h1>

      <p>
        The requested page does not exist or
        has been moved.
      </p>

      <Link
        className="button button--primary"
        to="/"
      >
        Return home
      </Link>
    </main>
  );
}