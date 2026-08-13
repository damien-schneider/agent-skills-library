import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app";
import { CaptureOverlay } from "./features/prompts/capture-overlay";
import "./index.css";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function syncTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
}

const media = window.matchMedia(DARK_QUERY);
syncTheme(media.matches);
media.addEventListener("change", (event) => syncTheme(event.matches));

const captureOverlay =
  isTauri() && getCurrentWindow().label === "capture-overlay";
document.documentElement.classList.toggle(
  "capture-overlay-window",
  captureOverlay
);

const container = document.getElementById("root");
if (!container) {
  throw new Error("Missing #root container");
}

createRoot(container).render(
  <StrictMode>{captureOverlay ? <CaptureOverlay /> : <App />}</StrictMode>
);
