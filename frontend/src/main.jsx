import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app/App";
import { AppProviders } from "./app/providers";
import { preventNumberInputScroll } from "./utils/preventNumberInputScroll";

import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/auth.css";
import "./styles/admin.css";
import "./styles/user.css";
import "./styles/charts.css";
import "./styles/project-monitor.css";

preventNumberInputScroll();

createRoot(
  document.getElementById("root"),
).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
