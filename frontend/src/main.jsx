import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app/App";
import { AppProviders } from "./app/providers";

import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/auth.css";
import "./styles/admin.css";
import "./styles/user.css";

createRoot(
  document.getElementById("root"),
).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
