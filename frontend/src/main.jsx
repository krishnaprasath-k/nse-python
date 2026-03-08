import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes — data is "fresh", no refetch on re-render
      gcTime: 10 * 60 * 1000, // 10 minutes — keep cached data in memory
      refetchOnWindowFocus: false, // Don't refetch when user switches tabs back
      refetchOnReconnect: false, // Don't refetch on network reconnect
      retry: 1, // Only retry once on failure (avoids hammering on 429)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
