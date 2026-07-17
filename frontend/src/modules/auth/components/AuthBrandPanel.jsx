import {
  BarChart3,
  Building2,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { env } from "../../../config/env";

export function AuthBrandPanel() {
  return (
    <aside className="auth-brand-panel">
      <div className="auth-brand-panel__overlay" />

      <div className="auth-brand-panel__content">
        <div className="auth-brand">
          <div className="auth-brand__mark">
            <Building2 size={28} />
          </div>

          <div>
            <strong>{env.companyShortName}</strong>
            <span>{env.companyName}</span>
          </div>
        </div>

        <div className="auth-brand-panel__message">
          <span className="auth-eyebrow">
            Enterprise Operations
          </span>

          <h1>
            Data corrections managed with
            accountability.
          </h1>

          <p>
            Centralize ERP correction requests,
            approvals, assignments, resolutions,
            and operational analytics.
          </p>
        </div>

        <div className="auth-feature-list">
          <div>
            <Workflow size={20} />
            <span>Controlled approval workflow</span>
          </div>

          <div>
            <BarChart3 size={20} />
            <span>Real-time operational analytics</span>
          </div>

          <div>
            <ShieldCheck size={20} />
            <span>Role-based secure access</span>
          </div>
        </div>
      </div>
    </aside>
  );
}