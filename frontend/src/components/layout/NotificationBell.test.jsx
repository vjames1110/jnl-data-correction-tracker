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

const {
  useAuthMock,
  useMarkAllNotificationsReadMock,
  useMarkNotificationReadMock,
  useNotificationUnreadCountMock,
  useNotificationsMock,
} = vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    useMarkAllNotificationsReadMock: vi.fn(),
    useMarkNotificationReadMock: vi.fn(),
    useNotificationUnreadCountMock: vi.fn(),
    useNotificationsMock: vi.fn(),
  }));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../../hooks/useNotifications", () => ({
  useNotifications: (...args) =>
    useNotificationsMock(...args),
  useNotificationUnreadCount: () =>
    useNotificationUnreadCountMock(),
  useMarkNotificationRead: () =>
    useMarkNotificationReadMock(),
  useMarkAllNotificationsRead: () =>
    useMarkAllNotificationsReadMock(),
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
    useMarkAllNotificationsReadMock.mockReset();
    useMarkNotificationReadMock.mockReset();
    useNotificationUnreadCountMock.mockReset();
    useNotificationsMock.mockReset();
    useAuthMock.mockReturnValue({
      user: {
        role: USER_ROLES.USER,
      },
    });
    useNotificationUnreadCountMock.mockReturnValue({
      data: {
        unread_count: 0,
      },
    });
    useMarkNotificationReadMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    useMarkAllNotificationsReadMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
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
    useNotificationUnreadCountMock.mockReturnValue({
      data: {
        unread_count: 1,
      },
    });

    renderBell();

    expect(
      screen.getByLabelText("Notifications"),
    ).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
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

  it("marks an unread linked notification as read", async () => {
    const markRead = vi.fn();
    useMarkNotificationReadMock.mockReturnValue({
      mutate: markRead,
      isPending: false,
    });
    useNotificationUnreadCountMock.mockReturnValue({
      data: {
        unread_count: 1,
      },
    });
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            id: "1",
            title: "Approval pending",
            event_type: "APPROVAL_PENDING",
            severity: "WARNING",
            is_read: false,
            deep_link: "/director/approvals/1",
            created_at: new Date().toISOString(),
          },
        ],
      },
    });

    renderBell();

    await userEvent.click(
      screen.getByLabelText("Notifications"),
    );
    await userEvent.click(
      screen.getByText("Approval pending"),
    );

    expect(markRead).toHaveBeenCalledWith("1");
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
