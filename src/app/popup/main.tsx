import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../shared/styles/index.css";
import Popup from "./Popup";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

function applyStoredTheme() {
  try {
    const theme = window.localStorage.getItem("pomodoroTheme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    }
  } catch (error) {
    console.warn("Failed to read local theme", error);
  }
}

applyStoredTheme();

createRoot(root).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
