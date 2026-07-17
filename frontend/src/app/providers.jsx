import {
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  ReactQueryDevtools,
} from "@tanstack/react-query-devtools";

import { AuthProvider } from "../context/AuthContext";
import { queryClient } from "./queryClient";

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
      </AuthProvider>

      {import.meta.env.DEV ? (
        <ReactQueryDevtools
          initialIsOpen={false}
        />
      ) : null}
    </QueryClientProvider>
  );
}