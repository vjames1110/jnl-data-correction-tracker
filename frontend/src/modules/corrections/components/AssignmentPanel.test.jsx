import {
  render,
  screen,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AssignmentPanel } from "./AssignmentPanel";

const {
  useAssignCorrectionRequestMock,
  useReassignCorrectionRequestMock,
  useUsersDropdownMock,
} = vi.hoisted(() => ({
  useAssignCorrectionRequestMock: vi.fn(),
  useReassignCorrectionRequestMock: vi.fn(),
  useUsersDropdownMock: vi.fn(),
}));

vi.mock(
  "../../../hooks/useCorrectionRequests",
  () => ({
    useAssignCorrectionRequest: () =>
      useAssignCorrectionRequestMock(),
    useReassignCorrectionRequest: () =>
      useReassignCorrectionRequestMock(),
  }),
);

vi.mock("../../../hooks/useOrganization", () => ({
  useUsersDropdown: (...args) =>
    useUsersDropdownMock(...args),
}));

function idleMutation() {
  return {
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  };
}

describe("AssignmentPanel", () => {
  beforeEach(() => {
    useAssignCorrectionRequestMock.mockReset();
    useReassignCorrectionRequestMock.mockReset();
    useUsersDropdownMock.mockReset();

    useAssignCorrectionRequestMock.mockReturnValue(
      idleMutation(),
    );
    useReassignCorrectionRequestMock.mockReturnValue(
      idleMutation(),
    );
    useUsersDropdownMock.mockReturnValue({
      data: [],
    });
  });

  it("renders nothing when the status matches neither list", () => {
    const { container } = render(
      <AssignmentPanel
        request={{
          id: "req-1",
          current_status: "DRAFT",
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows Assign for the default assignable statuses", () => {
    render(
      <AssignmentPanel
        request={{
          id: "req-1",
          current_status: "APPROVED",
        }}
      />,
    );

    expect(
      screen.getByText(
        "Assign Responsible Person",
      ),
    ).toBeInTheDocument();
  });

  it("shows a required-reason Reassign form for requester-driven statuses", () => {
    render(
      <AssignmentPanel
        request={{
          id: "req-1",
          current_status: "RESOLVED",
          current_owner_employee_id: "EMP001",
          current_owner_name: "Responsible One",
        }}
        assignableStatuses={[]}
        reassignableStatuses={[
          "RESOLVED",
          "REOPENED",
        ]}
      />,
    );

    expect(
      screen.getByText(
        "Reassign Responsible Person",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/reason \(required\)/i),
    ).toBeInTheDocument();
  });
});
