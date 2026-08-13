import { useState } from "react";
import { UserRoundPlus } from "lucide-react";

import { USER_ROLES } from "../../../constants/roles";
import {
  useAssignCorrectionRequest,
  useReassignCorrectionRequest,
} from "../../../hooks/useCorrectionRequests";
import { useUsersDropdown } from "../../../hooks/useOrganization";
import {
  ASSIGNABLE_REQUEST_STATUSES,
  REASSIGNABLE_REQUEST_STATUSES,
  formatOwner,
} from "../utils/requestStatusDisplay";

export function AssignmentPanel({
  request,
  onAssigned,
  assignableStatuses = ASSIGNABLE_REQUEST_STATUSES,
  reassignableStatuses = REASSIGNABLE_REQUEST_STATUSES,
}) {
  const [responsiblePerson, setResponsiblePerson] =
    useState("");
  const [note, setNote] = useState("");

  const usersQuery = useUsersDropdown({
    role: USER_ROLES.RESPONSIBLE_PERSON,
  });
  const assignMutation =
    useAssignCorrectionRequest();
  const reassignMutation =
    useReassignCorrectionRequest();

  const isAssign = assignableStatuses.includes(
    request.current_status,
  );
  const isReassign =
    !isAssign &&
    reassignableStatuses.includes(
      request.current_status,
    );

  if (!isAssign && !isReassign) {
    return null;
  }

  const mutation = isAssign
    ? assignMutation
    : reassignMutation;
  const noteRequired = isReassign;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!responsiblePerson) {
      return;
    }

    const payload = isAssign
      ? {
          responsible_person: responsiblePerson,
          comment: note,
        }
      : {
          responsible_person: responsiblePerson,
          reason: note,
        };

    await mutation.mutateAsync({
      id: request.id,
      payload,
    });

    setResponsiblePerson("");
    setNote("");
    onAssigned?.();
  }

  return (
    <form
      className="assignment-panel"
      onSubmit={handleSubmit}
    >
      <div className="assignment-panel__header">
        <UserRoundPlus size={16} />
        <strong>
          {isAssign
            ? "Assign Responsible Person"
            : "Reassign Responsible Person"}
        </strong>
      </div>

      {isReassign ? (
        <p className="assignment-panel__hint">
          Currently with{" "}
          {formatOwner({
            employeeId:
              request.current_owner_employee_id,
            name: request.current_owner_name,
          })}
          . Reassigning resets the request to
          Assigned so the new owner can accept it.
        </p>
      ) : null}

      {mutation.isError ? (
        <div className="inline-alert inline-alert--error">
          <strong>
            {mutation.error?.message}
          </strong>
        </div>
      ) : null}

      <label className="form-field">
        <span>Responsible person</span>
        <select
          value={responsiblePerson}
          onChange={(event) =>
            setResponsiblePerson(
              event.target.value,
            )
          }
          required
        >
          <option value="" disabled hidden>
            Select responsible person
          </option>
          {(usersQuery.data ?? []).map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span>
          {noteRequired
            ? "Reason (required)"
            : "Comment (optional)"}
        </span>
        <textarea
          value={note}
          onChange={(event) =>
            setNote(event.target.value)
          }
          required={noteRequired}
        />
      </label>

      <button
        type="submit"
        className="button button--primary"
        disabled={
          mutation.isPending || !responsiblePerson
        }
      >
        {isAssign ? "Assign" : "Reassign"}
      </button>
    </form>
  );
}
