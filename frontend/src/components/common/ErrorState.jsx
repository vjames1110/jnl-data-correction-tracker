import {
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

export function ErrorState({
  title = "Unable to load data",
  message = "Please try again.",
  onRetry,
}) {
  return (
    <div className="error-state">
      <AlertTriangle size={34} />

      <h3>{title}</h3>
      <p>{message}</p>

      {onRetry ? (
        <button
          type="button"
          className="button button--secondary"
          onClick={onRetry}
        >
          <RefreshCw size={16} />
          Try again
        </button>
      ) : null}
    </div>
  );
}