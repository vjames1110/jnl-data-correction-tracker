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

import { NotificationsPage } from "./NotificationsPage";

const {
  useMarkAllNotificationsReadMock,
  useMarkNotificationReadMock,
  useMarkNotificationUnreadMock,
  useNotificationUnreadCountMock,
  useNotificationsMock,
  useNotificationPreferencesMock,
  useUpdateNotificationPreferencesMock,
} = vi.hoisted(() => ({
  useMarkAllNotificationsReadMock: vi.fn(),
  useMarkNotificationReadMock: vi.fn(),
  useMarkNotificationUnreadMock: vi.fn(),
  useNotificationUnreadCountMock: vi.fn(),
  useNotificationsMock: vi.fn(),
  useNotificationPreferencesMock: vi.fn(),
  useUpdateNotificationPreferencesMock: vi.fn(),
}));

vi.mock("../../../hooks/useNotifications", () => ({
  useNotifications: (...args) =>
    useNotificationsMock(...args),
  useNotificationUnreadCount: () =>
    useNotificationUnreadCountMock(),
  useMarkNotificationRead: () =>
    useMarkNotificationReadMock(),
  useMarkNotificationUnread: () =>
    useMarkNotificationUnreadMock(),
  useMarkAllNotificationsRead: () =>
    useMarkAllNotificationsReadMock(),
  useNotificationPreferences: () =>
    useNotificationPreferencesMock(),
  useUpdateNotificationPreferences: () =>
    useUpdateNotificationPreferencesMock(),
}));

function renderPage() {
  render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  );
}

describe("NotificationsPage", () => {
  beforeEach(() => {
    useMarkAllNotificationsReadMock.mockReset();
    useMarkNotificationReadMock.mockReset();
    useMarkNotificationUnreadMock.mockReset();
    useNotificationUnreadCountMock.mockReset();
    useNotificationsMock.mockReset();
    useNotificationPreferencesMock.mockReset();
    useUpdateNotificationPreferencesMock.mockReset();
    useNotificationUnreadCountMock.mockReturnValue({
      data: {
        unread_count: 0,
      },
    });
    useMarkNotificationReadMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    useMarkNotificationUnreadMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    useMarkAllNotificationsReadMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    useUpdateNotificationPreferencesMock.mockReturnValue(
      {
        mutate: vi.fn(),
        isError: false,
      },
    );
  });

  it("shows a loading state", () => {
    useNotificationsMock.mockReturnValue({
      isLoading: true,
    });

    renderPage();

    expect(
      screen.getByText(/loading notifications/i),
    ).toBeInTheDocument();
  });

  it("shows an error state with retry", () => {
    const refetch = vi.fn();
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: {
        message: "Network unavailable",
      },
      refetch,
    });

    renderPage();

    expect(
      screen.getByText(
        /notifications unavailable/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/network unavailable/i),
    ).toBeInTheDocument();
  });

  it("lists notifications and marks unread items", () => {
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            id: "1",
            title: "Approval pending",
            event_type: "APPROVAL_PENDING",
            severity: "WARNING",
            message: "A request needs your approval.",
            request_reference: "DCT-2026-000001",
            is_read: false,
            created_at: new Date().toISOString(),
            deep_link: "/director/approvals/1",
          },
        ],
        meta: {},
      },
    });

    renderPage();

    expect(
      screen.getByText("Approval pending"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Unread").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("DCT-2026-000001"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /mark read/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /approval pending/i,
      }),
    ).toHaveAttribute(
      "href",
      "/director/approvals/1",
    );
  });

  it("can mark one notification as read", async () => {
    const markRead = vi.fn();
    useMarkNotificationReadMock.mockReturnValue({
      mutate: markRead,
      isPending: false,
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
            created_at: new Date().toISOString(),
          },
        ],
        meta: {},
      },
    });

    renderPage();

    await userEvent.click(
      screen.getByRole("button", {
        name: /mark read/i,
      }),
    );

    expect(markRead).toHaveBeenCalledWith("1");
  });

  it("can mark one notification as unread", async () => {
    const markUnread = vi.fn();
    useMarkNotificationUnreadMock.mockReturnValue({
      mutate: markUnread,
      isPending: false,
    });
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
        meta: {},
      },
    });

    renderPage();

    await userEvent.click(
      screen.getByRole("button", {
        name: /mark unread/i,
      }),
    );

    expect(markUnread).toHaveBeenCalledWith("1");
  });

  it("can mark all notifications as read", async () => {
    const markAllRead = vi.fn();
    useNotificationUnreadCountMock.mockReturnValue({
      data: {
        unread_count: 3,
      },
    });
    useMarkAllNotificationsReadMock.mockReturnValue({
      mutate: markAllRead,
      isPending: false,
    });
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      data: {
        items: [],
        meta: {},
      },
    });

    renderPage();

    await userEvent.click(
      screen.getByRole("button", {
        name: /mark all read/i,
      }),
    );

    expect(markAllRead).toHaveBeenCalled();
  });

  it("shows an empty state when there are no notifications", () => {
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      data: {
        items: [],
        meta: {},
      },
    });

    renderPage();

    expect(
      screen.getByText("No notifications"),
    ).toBeInTheDocument();
  });

  it("toggles the preferences panel", async () => {
    useNotificationsMock.mockReturnValue({
      isLoading: false,
      data: {
        items: [],
        meta: {},
      },
    });
    useNotificationPreferencesMock.mockReturnValue(
      {
        isLoading: false,
        data: {
          in_app_enabled: true,
          email_enabled: false,
          muted_event_types: [],
          available_event_types: [
            {
              value: "SLA_WARNING",
              label: "SLA Warning",
            },
          ],
        },
      },
    );

    renderPage();

    expect(
      screen.queryByText(
        /notification preferences/i,
      ),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /preferences/i,
      }),
    );

    expect(
      screen.getByText(
        "In-app notifications",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("SLA Warning"),
    ).toBeInTheDocument();
  });
});
