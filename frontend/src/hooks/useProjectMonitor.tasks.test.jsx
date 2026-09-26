import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  useSiteTasks,
  useVisibleTasks,
} from "./useProjectMonitor";

const service = vi.hoisted(() => ({
  getProjectSites: vi.fn(),
}));

vi.mock("../services/projectMonitorService", () => ({
  projectMonitorService: service,
}));

const SITES = [
  {
    id: "s1",
    code: "CHK",
    tasks: ["STRUCTURES", "HR"],
    read_only: false,
  },
  {
    id: "s2",
    code: "OTH",
    tasks: ["REPORTS"],
    read_only: true,
  },
];

function wrapper({ children }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

describe("site task hooks", () => {
  it("useSiteTasks reports the tasks held on one site", async () => {
    service.getProjectSites.mockResolvedValue(SITES);
    const { result } = renderHook(() => useSiteTasks("s1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tasks).toEqual(["STRUCTURES", "HR"]);
    expect(result.current.has("HR")).toBe(true);
    expect(result.current.has("GIRDERS")).toBe(false);
    expect(result.current.readOnly).toBe(false);
  });

  it("useSiteTasks knows a read-only (Director) site", async () => {
    service.getProjectSites.mockResolvedValue(SITES);
    const { result } = renderHook(() => useSiteTasks("s2"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.readOnly).toBe(true);
  });

  it("useSiteTasks holds nothing for an unknown site", async () => {
    service.getProjectSites.mockResolvedValue(SITES);
    const { result } = renderHook(() => useSiteTasks("nope"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tasks).toEqual([]);
  });

  it("useVisibleTasks shows everything while the sites load", () => {
    service.getProjectSites.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useVisibleTasks(""), {
      wrapper,
    });

    expect(result.current.has("HR")).toBe(true);
    expect(result.current.has("GIRDERS")).toBe(true);
  });

  it("useVisibleTasks uses the chosen site's tasks", async () => {
    service.getProjectSites.mockResolvedValue(SITES);
    const { result } = renderHook(() => useVisibleTasks("s1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.has("STRUCTURES")).toBe(true);
    expect(result.current.has("REPORTS")).toBe(false);
  });

  it("with no site chosen, useVisibleTasks is the union over all sites", async () => {
    service.getProjectSites.mockResolvedValue(SITES);
    const { result } = renderHook(() => useVisibleTasks(""), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.has("HR")).toBe(true);
    expect(result.current.has("REPORTS")).toBe(true);
    expect(result.current.has("GIRDERS")).toBe(false);
  });
});

describe("useSiteTasks entry rights", () => {
  it("uses the tasks the API says may be entered", async () => {
    service.getProjectSites.mockResolvedValue([
      {
        id: "ho",
        code: "CHK",
        tasks: ["OVERVIEW", "STRUCTURES", "REPORTS"],
        enter_tasks: ["OVERVIEW"],
        read_only: false,
      },
    ]);
    const { result } = renderHook(() => useSiteTasks("ho"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.has("STRUCTURES")).toBe(true);
    expect(result.current.canEnter("OVERVIEW")).toBe(true);
    // Sees Structures, may not enter it.
    expect(result.current.canEnter("STRUCTURES")).toBe(false);
  });

  it("falls back to every held task, or none when read-only", async () => {
    service.getProjectSites.mockResolvedValue(SITES);

    const held = renderHook(() => useSiteTasks("s1"), { wrapper });
    await waitFor(() => expect(held.result.current.isLoading).toBe(false));
    expect(held.result.current.canEnter("STRUCTURES")).toBe(true);

    const readOnly = renderHook(() => useSiteTasks("s2"), {
      wrapper,
    });
    await waitFor(() =>
      expect(readOnly.result.current.isLoading).toBe(false),
    );
    expect(readOnly.result.current.canEnter("REPORTS")).toBe(false);
  });
});
