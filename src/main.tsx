import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppToaster } from "./components/AppToaster";
import { ConfirmProvider } from "./components/ui";
import { IdentityProvider } from "./components/IdentitySheet";
import { PwaRegister } from "./components/PwaRegister";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfirmProvider>
        <IdentityProvider>
          <App />
          <AppToaster />
          <PwaRegister />
        </IdentityProvider>
      </ConfirmProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
