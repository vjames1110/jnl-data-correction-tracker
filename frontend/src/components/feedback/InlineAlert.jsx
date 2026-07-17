import {
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";

const iconMap = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

export function InlineAlert({
  variant = "info",
  title,
  message,
}) {
  const Icon = iconMap[variant] ?? Info;

  return (
    <div
      className={`inline-alert inline-alert--${variant}`}
      role={
        variant === "error"
          ? "alert"
          : "status"
      }
    >
      <Icon size={18} />

      <div>
        {title ? <strong>{title}</strong> : null}
        {message ? <p>{message}</p> : null}
      </div>
    </div>
  );
}