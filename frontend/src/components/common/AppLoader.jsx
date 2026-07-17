import { LoaderCircle } from "lucide-react";

export function AppLoader({
  label = "Loading...",
  fullScreen = false,
}) {
  return (
    <div
      className={
        fullScreen
          ? "app-loader app-loader--fullscreen"
          : "app-loader"
      }
      role="status"
      aria-live="polite"
    >
      <LoaderCircle
        className="app-loader__icon"
        size={28}
      />
      <span>{label}</span>
    </div>
  );
}