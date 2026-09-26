import { useState } from "react";

import { ActivityGroupsTable } from "./ActivityGroupsTable";
import { WorkspaceSwitch } from "./WorkspaceSwitch";

const keyOf = (group) =>
  `${group.group_order}-${group.group_title}`;

// "3/8": finished of the activities that apply (N/A rows do not count).
function progressOf(group) {
  const applicable = group.rows.filter(
    (row) => row.status !== "NOT_APPLICABLE",
  );
  const done = applicable.filter(
    (row) => row.status === "COMPLETE",
  ).length;
  return `${done}/${applicable.length}`;
}

/**
 * One sheet's activity groups as a segmented workspace: a switch
 * with one segment per group (Approvals | Box Structure | ...), each
 * showing how much of it is done, and the selected group's activity
 * table underneath. A row still expands to its input fields and
 * Action History exactly as before (``ActivityGroupsTable``); this
 * only decides which group is on screen. A sheet with a single group
 * skips the switch.
 */
export function GroupSegments({
  groups,
  label = "Sections",
  onSelectActivity,
  ...tableProps
}) {
  const [selectedKey, setSelectedKey] = useState(null);

  if (!groups?.length) {
    return (
      <p className="pm-timeline-empty">
        No tasks on this sheet.
      </p>
    );
  }

  const selected =
    groups.find((group) => keyOf(group) === selectedKey) ??
    groups[0];

  return (
    <div className="pm-segments">
      {groups.length > 1 ? (
        <WorkspaceSwitch
          label={label}
          value={keyOf(selected)}
          onChange={(key) => {
            setSelectedKey(key);
            // An open row belongs to the group being left.
            onSelectActivity(null);
          }}
          options={groups.map((group) => ({
            key: keyOf(group),
            label: group.group_title,
            badge: progressOf(group),
          }))}
        />
      ) : null}

      <ActivityGroupsTable
        groups={[selected]}
        onSelectActivity={onSelectActivity}
        {...tableProps}
      />
    </div>
  );
}
