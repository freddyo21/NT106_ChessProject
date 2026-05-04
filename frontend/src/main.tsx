import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { SocketProvider } from "./services/SocketContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <SocketProvider>
        <App />
      </SocketProvider>
    </HashRouter>
  </React.StrictMode>
);