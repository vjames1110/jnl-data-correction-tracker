import {
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { USER_ROLES } from "../../constants/roles";
import { NotificationBell } from "./NotificationBell";

const { useAuthMock, useNotificationsMock } =
  vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    useNotificationsMock: vi.fn(),
  }));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../../hooks/useNotifications", () => ({
  useNotifications: (...args) =>
    useNotificationsMock(...args),
}));

function renderBell() {
  render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useNotificationsMock.mockReset();
    useAuthMock.mockReturnValue({
      user: {
        role: USER_ROLES.USER,
      },
    });
  });

  it("shows an unread indicator when notifications are unread", () => {
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            id: "1",
            title: "Request approved",
            event_type: "REQUEST_APPROVED",
            severity: "SUCCESS",
            is_read: false,
            created_at: new Date().toISOString(),
          },
        ],
      },
    });

    renderBell();

    expect(
      screen.getByLabelText("Notifications"),
    ).toBeInTheDocument();
  });

  it("opens the panel and links to the notification center", async () => {
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            id: "1",
            title: "Request approved",
            event_type: "REQUEST_APPROVED",
            severity: "SUCCESS",
            is_read: true,
            created_at: new Date().toISOString(),
          },
        ],
      },
    });

    renderBell();

    await userEvent.click(
      screen.getByLabelText("Notifications"),
    );

    expect(
      screen.getByText("Request approved"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /view all/i,
      }),
    ).toHaveAttribute(
      "href",
      "/user/notifications",
    );
  });

  it("shows an empty state when there are no notifications", async () => {
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      data: {
        items: [],
      },
    });

    renderBell();

    await userEvent.click(
      screen.getByLabelText("Notifications"),
    );

    expect(
      screen.getByText(/all caught up/i),
    ).toBeInTheDocument();
  });
});
