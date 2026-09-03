import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (
          error?.status === 401 ||
          error?.status === 403 ||
          // A 429 means the server is deliberately asking us to
          // slow down - silently retrying (react-query's default
          // backoff) just re-sends into the same still-exhausted
          // rate window, so a throttled request looked like the UI
          // "lagging" for a few seconds before finally erroring.
          // Fail fast instead and let the real message show.
          error?.status === 429
        ) {
          return false;
        }

        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});