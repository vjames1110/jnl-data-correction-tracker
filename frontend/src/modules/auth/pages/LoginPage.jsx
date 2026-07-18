import { useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  UserRound,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  AUTH_ROUTES,
} from "../../../constants/auth";
import {
  isAdminRole,
} from "../../../constants/roles";
import { InlineAlert } from "../../../components/feedback/InlineAlert";
import { useAuth } from "../../../hooks/useAuth";
import {
  getApiErrorMessage,
} from "../../../utils/errors";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    employee_id: "",
    password: "",
  });

  const [showPassword, setShowPassword] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState(() =>
      location.state?.passwordChanged
        ? location.state?.message ??
          "Password changed successfully. Please sign in again."
        : "",
    );
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const loginData = await login({
        employee_id:
          formData.employee_id.trim(),
        password: formData.password,
      });

      if (loginData.must_change_password) {
        navigate(
          AUTH_ROUTES.CHANGE_PASSWORD,
          {
            replace: true,
          },
        );
        return;
      }

      if (!isAdminRole(loginData.user.role)) {
        navigate(
          AUTH_ROUTES.FORBIDDEN,
          {
            replace: true,
          },
        );
        return;
      }

      const requestedPath =
        location.state?.from;

      navigate(
        requestedPath &&
          requestedPath.startsWith("/admin/")
          ? requestedPath
          : AUTH_ROUTES.DASHBOARD,
        {
          replace: true,
        },
      );
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "Invalid Employee ID or password.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-form-shell">
      <div className="auth-form-heading">
        <span>Administration Portal</span>
        <h2>Welcome back</h2>
        <p>
          Sign in using the Employee ID and
          password assigned to your account.
        </p>
      </div>

      {errorMessage ? (
        <InlineAlert
          variant="error"
          title="Sign-in failed"
          message={errorMessage}
        />
      ) : null}

      {successMessage ? (
        <InlineAlert
          variant="success"
          title="Password changed"
          message={successMessage}
        />
      ) : null}

      <form
        className="auth-form"
        onSubmit={handleSubmit}
      >
        <label className="form-field">
          <span>Employee ID</span>

          <div className="input-control">
            <UserRound size={18} />

            <input
              type="text"
              name="employee_id"
              value={formData.employee_id}
              onChange={handleChange}
              placeholder="Enter Employee ID"
              autoComplete="username"
              autoFocus
              required
            />
          </div>
        </label>

        <label className="form-field">
          <span>Password</span>

          <div className="input-control">
            <KeyRound size={18} />

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="input-control__action"
              onClick={() =>
                setShowPassword(
                  (current) => !current,
                )
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>
        </label>

        <button
          type="submit"
          className="button button--primary button--full"
          disabled={isSubmitting}
        >
          <LogIn size={18} />

          {isSubmitting
            ? "Signing in..."
            : "Sign in"}
        </button>
      </form>

      <p className="auth-support-note">
        Contact your system administrator when
        your account is inactive or locked.
      </p>
    </div>
  );
}
