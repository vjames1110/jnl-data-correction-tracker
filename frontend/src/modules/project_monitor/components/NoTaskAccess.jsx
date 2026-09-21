import { EmptyState } from "../../../components/common/EmptyState";

/**
 * Shown on a task page (Structures, Buildings, ...) when the person
 * has no grant for that task on the chosen site - e.g. they followed
 * an old link. The tabs already hide such pages; the backend refuses
 * the data either way.
 */
export function NoTaskAccess({ task }) {
  return (
    <EmptyState
      title={`No access to ${task} on this project`}
      message={`Ask an Admin to give you the ${task} task for this site on the Site Access page.`}
    />
  );
}
