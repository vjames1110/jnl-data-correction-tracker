import { Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { useSitesDropdown } from "../../../hooks/useOrganization";
import {
  useSetSiteAccess,
  useSiteAccess,
  useSiteScope,
} from "../../../hooks/useProjectMonitor";
import { apiErrorMessage } from "../../project_monitor/utils/finance";

function sameSet(a, b) {
  return a.size === b.size && [...a].every((v) => b.has(v));
}

/** Column groups (Progress / Finance / Reports) from the task list. */
function groupTasks(tasks) {
  const groups = [];
  tasks.forEach((task) => {
    const last = groups[groups.length - 1];
    if (last && last.key === task.group) {
      last.tasks.push(task);
    } else {
      groups.push({
        key: task.group,
        label: task.group_label,
        tasks: [task],
      });
    }
  });
  return groups;
}

/**
 * One person's row: a checkbox per task. Ticking is local until
 * Save, which replaces the person's tasks on this site in one step.
 */
function PersonRow({
  person,
  tasks,
  isNew,
  isSaving,
  onSave,
  onRemove,
  onCancel,
}) {
  const [draft, setDraft] = useState(
    () => new Set(person.tasks),
  );
  const saved = new Set(person.tasks);
  const changed = !sameSet(draft, saved);

  const toggle = (key) =>
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  const pick = (group) =>
    setDraft(
      new Set(
        tasks
          .filter((task) => !group || task.group === group)
          .map((task) => task.key),
      ),
    );

  return (
    <tr>
      <td className="pm-access-person">
        <strong>{person.user_name}</strong>
        <span className="sub">
          {" "}
          ({person.user_employee_id})
        </span>
        <span className="pm-access-role">
          {person.role_label}
        </span>
        <span className="pm-access-presets">
          <button type="button" onClick={() => pick(null)}>
            All
          </button>
          <button
            type="button"
            onClick={() => pick("progress")}
          >
            Progress
          </button>
          <button
            type="button"
            onClick={() => pick("finance")}
          >
            Finance
          </button>
          <button
            type="button"
            onClick={() => setDraft(new Set())}
          >
            None
          </button>
        </span>
      </td>
      {tasks.map((task) => (
        <td key={task.key} className="pm-access-cell">
          <input
            type="checkbox"
            checked={draft.has(task.key)}
            onChange={() => toggle(task.key)}
            aria-label={`${person.user_name}: ${task.label}`}
          />
        </td>
      ))}
      <td className="pm-access-actions">
        <button
          type="button"
          className="button button--primary button--sm"
          disabled={
            isSaving ||
            !changed ||
            (isNew && draft.size === 0)
          }
          onClick={() =>
            onSave(person.user, [...draft])
          }
        >
          Save
        </button>
        {isNew ? (
          <button
            type="button"
            className="button button--tertiary button--sm"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className="icon-button icon-button--danger"
            aria-label={`Remove ${person.user_name} from this site`}
            title="Remove from this site"
            disabled={isSaving}
            onClick={() => onRemove(person)}
          >
            <Trash2 size={16} />
          </button>
        )}
      </td>
    </tr>
  );
}

/**
 * Admin page: for one site, which Project Incharges and Project
 * Managers may use which task. Several people can hold tasks on the
 * same site, and each person can hold any mix - everything, a single
 * task such as DPR & Bills or HR, or a combination. Director and
 * Admins always see every task on every site.
 */
export function ProjectMonitorSiteAccessPage() {
  const [siteId, setSiteId] = useState("");
  const [pickedUser, setPickedUser] = useState("");
  const [adding, setAdding] = useState(null);

  const sitesQuery = useSitesDropdown();
  const accessQuery = useSiteAccess(siteId);
  const scopeQuery = useSiteScope();
  const setAccess = useSetSiteAccess();

  const data = accessQuery.data;
  const tasks = data?.tasks ?? [];
  const groups = groupTasks(tasks);

  const handleSave = async (userId, taskKeys) => {
    try {
      await setAccess.mutateAsync({
        site: siteId,
        user: userId,
        tasks: taskKeys,
      });
      setAdding(null);
    } catch {
      // Shown by the inline alert.
    }
  };

  const handleRemove = (person) => {
    if (
      window.confirm(
        `Remove ${person.user_name} from this site? They lose every task they hold on it.`,
      )
    ) {
      handleSave(person.user, []);
    }
  };

  const startAdding = () => {
    const chosen = (data?.eligible ?? []).find(
      (candidate) => candidate.id === pickedUser,
    );
    if (!chosen) {
      return;
    }
    setAdding({
      user: chosen.id,
      user_name: chosen.name,
      user_employee_id: chosen.employee_id,
      role_label: chosen.role_label,
      tasks: [],
    });
    setPickedUser("");
  };

  const eligible = (data?.eligible ?? []).filter(
    (candidate) => candidate.id !== adding?.user,
  );

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Site Access</h1>
          <p>
            Choose a site, then tick what each Project Incharge
            and Project Manager may do on it - all tasks, one
            task such as DPR &amp; Bills, or any mix.
            Several people can work on the same site. Setting a
            person&apos;s site in User Management, or making them a
            site&apos;s Project Manager in Organization Setup, gives
            them a starting set of tasks here - trim or extend it as
            you need. Director and Admins always see every task on
            every site. HR and Machinery are entered only by the HR
            and Machinery departments, so they are not listed here.
          </p>
        </div>
        <div className="page-actions">
          <label className="filter-control">
            <span>Project / Site</span>
            <select
              value={siteId}
              onChange={(event) => {
                setSiteId(event.target.value);
                setAdding(null);
                setPickedUser("");
              }}
            >
              <option value="">Select a site</option>
              {(sitesQuery.data ?? []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.code} - {site.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!siteId ? (
        <EmptyState
          title="Pick a site"
          message="Choose a project/site above to see and change who can work on it."
        />
      ) : accessQuery.isLoading ? (
        <AppLoader label="Loading site access..." />
      ) : accessQuery.isError ? (
        <ErrorState
          title="Site access unavailable"
          message={apiErrorMessage(accessQuery.error)}
          onRetry={() => accessQuery.refetch()}
        />
      ) : (
        <SurfaceCard>
          <div className="surface-card__header">
            <h2>People on this site</h2>
          </div>

          <form
            className="pm-inline-row print-hidden"
            onSubmit={(event) => {
              event.preventDefault();
              startAdding();
            }}
          >
            <label
              className="form-field"
              style={{ minWidth: 340 }}
            >
              <span>Add a person</span>
              <select
                value={pickedUser}
                onChange={(event) =>
                  setPickedUser(event.target.value)
                }
              >
                <option value="">
                  Select a Project Incharge or Manager
                </option>
                {eligible.map((candidate) => (
                  <option
                    key={candidate.id}
                    value={candidate.id}
                  >
                    {candidate.employee_id} - {candidate.name}{" "}
                    ({candidate.role_label})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="button button--secondary"
              disabled={!pickedUser}
            >
              <UserPlus size={16} /> Add
            </button>
          </form>

          {setAccess.isError ? (
            <div className="inline-alert inline-alert--error">
              {apiErrorMessage(setAccess.error)}
            </div>
          ) : null}

          {data.people.length === 0 && !adding ? (
            <p className="pm-timeline-empty">
              Nobody has been given a task on this site yet.
              Add a person above.
            </p>
          ) : (
            <div className="pm-table-wrap">
              <table className="pm-access-grid">
                <thead>
                  <tr>
                    <th rowSpan={2}>Person</th>
                    {groups.map((group) => (
                      <th
                        key={group.key}
                        colSpan={group.tasks.length}
                        className="pm-access-group"
                      >
                        {group.label}
                      </th>
                    ))}
                    <th rowSpan={2} />
                  </tr>
                  <tr>
                    {tasks.map((task) => (
                      <th
                        key={task.key}
                        className="pm-access-task"
                      >
                        {task.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((person) => (
                    <PersonRow
                      // A saved change refreshes the row's draft.
                      key={`${person.user}:${person.tasks.join(",")}`}
                      person={person}
                      tasks={tasks}
                      isSaving={setAccess.isPending}
                      onSave={handleSave}
                      onRemove={handleRemove}
                    />
                  ))}
                  {adding ? (
                    <PersonRow
                      key={`new:${adding.user}`}
                      person={adding}
                      tasks={tasks}
                      isNew
                      isSaving={setAccess.isPending}
                      onSave={handleSave}
                      onCancel={() => setAdding(null)}
                    />
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>
      )}

      <SurfaceCard>
        <div className="surface-card__header pm-scope-header">
          <div>
            <h2>People and their sites</h2>
            <p className="sub">
              Every Project Incharge and Project Manager, and the
              sites they hold tasks on. Someone with no site
              cannot see or enter anything in Project Monitor.
            </p>
          </div>
        </div>
        {scopeQuery.isLoading ? (
          <AppLoader label="Loading assignments..." />
        ) : scopeQuery.isError ? (
          <ErrorState
            title="Assignments unavailable"
            message={apiErrorMessage(scopeQuery.error)}
            onRetry={() => scopeQuery.refetch()}
          />
        ) : (scopeQuery.data ?? []).length === 0 ? (
          <p className="pm-timeline-empty">
            No Project Incharge or Project Manager accounts
            yet.
          </p>
        ) : (
          <div className="pm-table-wrap">
            <table className="pm-activity-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Sites they can work on</th>
                </tr>
              </thead>
              <tbody>
                {scopeQuery.data.map((person) => (
                  <tr key={person.id}>
                    <td>
                      {person.name}
                      <span className="sub">
                        {" "}
                        ({person.employee_id})
                      </span>
                    </td>
                    <td>{person.role_label}</td>
                    <td>
                      {person.sites.length === 0 ? (
                        <span className="pm-scope-warning">
                          No site - cannot see or enter
                          anything
                        </span>
                      ) : (
                        person.sites.map((site) => (
                          <span
                            key={site.id}
                            className="pm-scope-chip"
                          >
                            {site.code} ·{" "}
                            {site.all_tasks
                              ? "all tasks"
                              : `${site.task_count} task${site.task_count === 1 ? "" : "s"}`}
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
