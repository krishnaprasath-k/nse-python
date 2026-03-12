import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import ConfigPage from "./pages/ConfigPage.jsx";
import "./index.css";
import "./pages/ConfigPage.css";
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
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/config" element={<ConfigPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
