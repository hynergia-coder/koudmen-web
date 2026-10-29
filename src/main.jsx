import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { configured, supabase } from "./lib/supabase";
import { loadCatalog } from "./lib/data";
import Setup from "./pages/Setup";
import "./styles.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

function render() {
  root.render(
    <React.StrictMode>
      {configured ? (
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      ) : (
        <Setup />
      )}
    </React.StrictMode>
  );
}

if (!configured) {
  render();
} else {
  // Charge services, communes, textes et réglages gérés depuis l'Admin (4 s maximum, sinon valeurs par défaut)
  const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
  Promise.race([loadCatalog(supabase).catch(() => {}), timeout]).finally(render);
}
