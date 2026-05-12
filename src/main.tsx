import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import { PWAUpdatePrompt } from "./components/PWAUpdatePrompt";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-center" richColors />
      <PWAUpdatePrompt />
    </BrowserRouter>
  </React.StrictMode>,
);
