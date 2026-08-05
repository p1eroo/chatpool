import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { QueryProvider } from "@/providers/QueryProvider";
import "./index.css";

(function initTheme() {
  const saved = localStorage.getItem("chatpool-theme") ?? localStorage.getItem("theme");
  const theme = saved === "light" || saved === "dark" ? saved : "dark";
  document.documentElement.classList.toggle("dark", theme === "dark");
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>
);
