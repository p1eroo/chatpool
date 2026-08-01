import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { env } from "@/config/env";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: env.useMock ? 0 : 1,
      refetchOnWindowFocus: !env.useMock,
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
