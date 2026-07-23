import { useState } from "react";
import {
  KeyRound,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import {
  useNavigate,
} from "react-router-dom";

import {
  AUTH_ROUTES,
  SESSION_END_REASONS,
} from "../../../constants/auth";
import { InlineAlert } from "../../../components/feedback/InlineAlert";
import { useAuth } from "../../../hooks/useAuth";
import { authService } from "../../../services/authService";
import {
  getApiErrorMessage,
} from "../../../utils/errors";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const {
    user,
    logout,
    terminateLocalSession,
  } = useAuth();

  const [formData, setFormData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");
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

    if (
      formData.new_password !==
      formData.confirm_password
    ) {
      setErrorMessage(
        "The new password and confirmation do not match.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response =
        await authService.changePassword(
          formData,
        );

      terminateLocalSession(
        SESSION_END_REASONS.PASSWORD_CHANGED,
      );
      navigate(AUTH_ROUTES.LOGIN, {
        replace: true,
        state: {
          passwordChanged: true,
          message: response.message,
        },
      });
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "The password could not be changed.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="password-change-page">
      <section className="password-change-card">
        <div className="password-change-icon">
          <ShieldCheck size={30} />
        </div>

        <div className="password-change-heading">
          <span>Security requirement</span>
          <h1>Change temporary password</h1>
          <p>
            Hello {user?.full_name}. You must
            replace your temporary password
            before entering the application.
          </p>
        </div>

        {errorMessage ? (
          <InlineAlert
            variant="error"
            title="Password change failed"
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
          {[
            {
              name: "current_password",
              label: "Current password",
            },
            {
              name: "new_password",
              label: "New password",
            },
            {
              name: "confirm_password",
              label: "Confirm new password",
            },
          ].map((field) => (
            <label
              className="form-field"
              key={field.name}
            >
              <span>{field.label}</span>

              <div className="input-control">
                <KeyRound size={18} />

                <input
                  type="password"
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>
          ))}

          <button
            type="submit"
            className="button button--primary button--full"
            disabled={isSubmitting}
          >
            <ShieldCheck size={18} />
            {isSubmitting
              ? "Changing password..."
              : "Change password"}
          </button>

          <button
            type="button"
            className="button button--tertiary button--full"
            onClick={logout}
            disabled={isSubmitting}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
