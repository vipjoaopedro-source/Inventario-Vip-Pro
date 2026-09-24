// Entry point for the offline Android app (Capacitor).
// Everything runs locally inside the device: no server, no network.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { routeTree } from "./routeTree.gen";
import "./styles.css";

const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  context: { queryClient },
  history: createMemoryHistory({ initialEntries: ["/"] }),
  defaultPreloadStaleTime: 0,
});

const el = document.getElementById("app")!;

createRoot(el).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
