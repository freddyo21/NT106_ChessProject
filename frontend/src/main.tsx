import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ServerDiscoveryGate } from "./ServerDiscoveryGate";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ServerDiscoveryGate>
      <HashRouter>
        <App />
      </HashRouter>
    </ServerDiscoveryGate>
  </React.StrictMode>
);