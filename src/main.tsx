import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PanelProvider } from "./contexts/PanelContext";
import { DetachedPanelRoot, getPanelIdFromUrl } from "./components/panels";
import "./index.css";

const panelId = getPanelIdFromUrl();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {panelId ? (
      <DetachedPanelRoot panelId={panelId} />
    ) : (
      <PanelProvider>
        <App />
      </PanelProvider>
    )}
  </React.StrictMode>,
);
