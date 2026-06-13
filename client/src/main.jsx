import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { ThemeProvider } from "@context/ThemeProvider";
import { CallProvider } from "@context/CallContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 Minutes
      cacheTime: 30 * 60 * 1000, // 30 Minutes caching
      refetchOnWindowFocus: false, // Don't trigger refetch on tab focus
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CallProvider>
          <BrowserRouter>
            <Toaster
              position="bottom-left"
              toastOptions={{
                style: {
                  background: "#182229",
                  color: "#f1f5f9",
                  fontSize: "13px",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.35)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  maxWidth: "350px",
                },
                success: {
                  icon: null,
                },
                error: {
                  icon: null,
                },
                loading: {
                  icon: null,
                },
              }}
            />
            <App />
          </BrowserRouter>
        </CallProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
