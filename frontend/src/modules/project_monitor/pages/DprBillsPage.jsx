import {
  FileBarChart,
  ListOrdered,
  Plus,
  Receipt,
  Table2,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { useAuth } from "../../../hooks/useAuth";
import {
  useAutoSelectSite,
  useProjectSites,
} from "../../../hooks/useProjectMonitor";
import {
  useCreateDprItem,
  useDeleteDprItem,
  useDprAccess,
  useDprContract,
  useDprGrid,
  useDprItems,
  useFinancialSummary,
  useSaveDprGrid,
  useUpdateDprItem,
} from "../../../hooks/useProjectMonitor";
import { ManagementPanel } from "../../admin/components/OrganizationControls";
import { ContractFinanceCard } from "../components/ContractFinanceCard";
import { DprGrid } from "../components/DprGrid";
import { DprImportControls } from "../components/DprImportControls";
import { DprItemForm } from "../components/DprItemForm";
import { DprRegister } from "../components/DprRegister";
import { DprUnlockPanel } from "../components/DprUnlockPanel";
import { FinancialReportView } from "../components/FinancialReportView";
import { FinancialTiles } from "../components/FinancialTiles";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { RaBillsPanel } from "../components/RaBillsPanel";
import { WorkspaceSwitch } from "../components/WorkspaceSwitch";
import { apiErrorMessage } from "../utils/finance";

const SUB_TABS = [
  { key: "grid", label: "DPR grid", icon: Table2 },
  { key: "register", label: "Register", icon: ListOrdered },
  { key: "bills", label: "RA bills", icon: Receipt },
  {
    key: "report",
    label: "Financial report",
    icon: FileBarChart,
  },
];

/**
 * Section F: the daily progress report, RA bills and the money-aware
 * contract status. Everything on this page is per-site permissioned:
 * a Project Manager sees it only for sites they are assigned to (the
 * backend enforces it; this page just reflects ``dpr/access``).
 */
export function DprBillsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const [selectedSite, setSelectedSite] = useState(
    () => searchParams.get("site") || "",
  );
  const [subTab, setSubTab] = useState("grid");
  const [itemPanel, setItemPanel] = useState(null);
  const [presetParent, setPresetParent] = useState("");
  const [itemError, setItemError] = useState(null);

  const sitesQuery = useProjectSites();
  const accessQuery = useDprAccess(selectedSite);
  const access = accessQuery.data;
  const canView = Boolean(access?.can_view);
  const canEnter = Boolean(access?.can_enter);

  const summaryQuery = useFinancialSummary(
    selectedSite,
    canView,
  );
  const contractQuery = useDprContract(
    selectedSite,
    canView,
  );
  const gridQuery = useDprGrid(selectedSite, canView);
  const itemsQuery = useDprItems(selectedSite, canView);

  const saveGrid = useSaveDprGrid();
  const createItem = useCreateDprItem();
  const updateItem = useUpdateDprItem();
  const deleteItem = useDeleteDprItem();

  const handleSiteChange = (value) => {
    setSelectedSite(value);
    setSearchParams(value ? { site: value } : {});
  };

  useAutoSelectSite(
    sitesQuery.data,
    selectedSite,
    handleSiteChange,
  );

  const handleSaveItem = async (payload) => {
    setItemError(null);
    try {
      if (itemPanel === "new") {
        await createItem.mutateAsync({
          site: selectedSite,
          ...payload,
        });
      } else {
        await updateItem.mutateAsync({
          itemId: itemPanel.id,
          payload,
        });
      }
      setItemPanel(null);
    } catch (error) {
      setItemError(error);
    }
  };

  const handleDeleteItem = (item) => {
    if (
      window.confirm(
        item.is_heading
          ? `Delete the group "${item.description}"? A group that still has items under it cannot be deleted.`
          : `Delete "${item.description}"? Items that already have DPR entries or bills cannot be deleted - deactivate them instead.`,
      )
    ) {
      deleteItem.mutate(item.id);
    }
  };

  const isBusy =
    accessQuery.isLoading ||
    (canView &&
      (gridQuery.isLoading || itemsQuery.isLoading));
  const items = itemsQuery.data?.items ?? [];
  // Groups only add up their items - entries and bills go against
  // the items themselves.
  const leafItems = items.filter((item) => !item.is_heading);

  return (
    <div className="organization-page">
      <div className="page-heading print-hidden">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>DPR &amp; Bills</h1>
          <p>
            Daily progress quantities against the contract
            items, RA bills and payments, and what they mean
            for the balance of the contract.
          </p>
        </div>

        <div className="page-actions">
          <label className="filter-control">
            <span>Project / Site</span>
            <select
              value={selectedSite}
              onChange={(event) =>
                handleSiteChange(event.target.value)
              }
            >
              <option value="">Select project</option>
              {(sitesQuery.data ?? []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.code} - {site.label}
                </option>
              ))}
            </select>
          </label>
          {canEnter && subTab === "grid" ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setItemError(null);
                setPresetParent("");
                setItemPanel("new");
              }}
            >
              <Plus size={16} /> Add item
            </button>
          ) : null}
        </div>
      </div>

      <div className="print-hidden">
        <ProjectMonitorTabs
          role={user?.role}
          active="dpr-bills"
        />
      </div>

      {itemPanel ? (
        <ManagementPanel
          eyebrow="DPR"
          title={
            itemPanel === "new"
              ? "Add a contract item"
              : "Edit contract item"
          }
          onClose={() => setItemPanel(null)}
          closeOnOutsideClick
        >
          <DprItemForm
            initial={itemPanel === "new" ? null : itemPanel}
            items={items}
            presetParent={presetParent}
            contractPercent={
              itemsQuery.data?.tender_percent ?? null
            }
            escalationPercent={
              items.find((item) => !item.is_heading)
                ?.escalation_percent ?? 0
            }
            onSubmit={handleSaveItem}
            onCancel={() => setItemPanel(null)}
            isPending={
              createItem.isPending || updateItem.isPending
            }
            error={itemError}
          />
        </ManagementPanel>
      ) : null}

      {!selectedSite ? (
        <EmptyState
          title="Pick a project to get started"
          message="Choose a project/site above to see its DPR and bills."
        />
      ) : isBusy ? (
        <AppLoader label="Loading DPR & bills..." />
      ) : accessQuery.isError ? (
        <ErrorState
          title="DPR & Bills unavailable"
          message={apiErrorMessage(accessQuery.error)}
          onRetry={() => accessQuery.refetch()}
        />
      ) : !canView ? (
        <EmptyState
          title="No access to this site's DPR & Bills"
          message="DPR and billing figures are visible only to the Project Managers assigned to a site, the Director and Admins. Ask an Admin to assign you to this site."
        />
      ) : (
        <>
          <div className="pm-stack print-hidden">
            {summaryQuery.data ? (
              <FinancialTiles summary={summaryQuery.data} />
            ) : null}
            {contractQuery.data ? (
              <ContractFinanceCard
                siteId={selectedSite}
                contract={contractQuery.data}
                canEnter={canEnter}
              />
            ) : null}
          </div>

          <WorkspaceSwitch
            label="DPR and bills view"
            value={subTab}
            onChange={setSubTab}
            options={SUB_TABS}
          />

          {subTab === "grid" ? (
            <SurfaceCard>
              {canEnter ? (
                <DprImportControls siteId={selectedSite} />
              ) : null}
              {deleteItem.isError ? (
                <div className="inline-alert inline-alert--error">
                  {apiErrorMessage(deleteItem.error)}
                </div>
              ) : null}
              {gridQuery.isError ? (
                <ErrorState
                  title="DPR grid unavailable"
                  message={apiErrorMessage(gridQuery.error)}
                  onRetry={() => gridQuery.refetch()}
                />
              ) : gridQuery.data ? (
                <DprGrid
                  grid={gridQuery.data}
                  siteId={selectedSite}
                  canEnter={canEnter}
                  isSaving={saveGrid.isPending}
                  onSave={(edits) =>
                    saveGrid.mutateAsync({
                      site: selectedSite,
                      edits,
                    })
                  }
                  onEditItem={(item) => {
                    setItemError(null);
                    setItemPanel(item);
                  }}
                  onAddChild={(group) => {
                    setItemError(null);
                    setPresetParent(group.id);
                    setItemPanel("new");
                  }}
                  onDeleteItem={handleDeleteItem}
                />
              ) : null}
              <DprUnlockPanel
                siteId={selectedSite}
                canUnlock={Boolean(access?.can_unlock)}
              />
            </SurfaceCard>
          ) : null}

          {subTab === "register" ? (
            <SurfaceCard>
              <DprRegister
                siteId={selectedSite}
                items={leafItems}
                canEnter={canEnter}
              />
            </SurfaceCard>
          ) : null}

          {subTab === "bills" ? (
            <SurfaceCard>
              <RaBillsPanel
                siteId={selectedSite}
                items={leafItems}
                canEnter={canEnter}
              />
            </SurfaceCard>
          ) : null}

          {subTab === "report" ? (
            <FinancialReportView siteId={selectedSite} />
          ) : null}
        </>
      )}
    </div>
  );
}
