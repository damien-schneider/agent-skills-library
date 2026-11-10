import type { ControlUiSkin } from "@ctrl-ui/react/skin";
import { SkinProvider } from "@ctrl-ui/react/skin-provider";
import { Toaster } from "@ctrl-ui/react/ui/toast";
import { TooltipProvider } from "@ctrl-ui/react/ui/tooltip";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app";
import { CaptureOverlay } from "./features/prompts/capture-overlay";
import "./index.css";

const DARK_QUERY = "(prefers-color-scheme: dark)";
/** Mirrors `data-skin` on `<html>`, which is what the skin stylesheet matches. */
const SKIN_ID = "adt";

const skin = {
  id: SKIN_ID,
  sidebarLayout: "inset",
  scrollAreaScrollbarVisibility: "hover",
} satisfies ControlUiSkin;

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
  <StrictMode>
    <SkinProvider skin={skin}>
      {captureOverlay ? (
        <CaptureOverlay />
      ) : (
        <TooltipProvider>
          <App />
          <Toaster />
        </TooltipProvider>
      )}
    </SkinProvider>
  </StrictMode>
);
