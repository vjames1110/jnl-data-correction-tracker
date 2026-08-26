import { ClipboardEdit } from "lucide-react";
import { Link } from "react-router-dom";

import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { useAuth } from "../../../hooks/useAuth";

export function StoreDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Store Reconciliation
          </span>
          <h1>Store HO Dashboard</h1>
          <p>
            Welcome, {user?.full_name}. Enter this
            month's stock reconciliation for any
            site and submit it for the Director's
            approval.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--primary"
            to="/store/entry"
          >
            <ClipboardEdit size={18} />
            Go To Monthly Entry
          </Link>
        </div>
      </div>

      <SurfaceCard>
        <div className="surface-card__body">
          <p>
            Use <strong>Monthly Entry</strong> to
            record opening/receipts/closing stock
            for formula-driven items (like
            concrete materials), book stock and
            physical counts for everything else,
            and production output for the month.
            Once entries look right, submit the
            period from that screen.
          </p>
        </div>
      </SurfaceCard>
    </div>
  );
}
