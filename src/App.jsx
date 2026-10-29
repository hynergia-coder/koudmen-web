import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import HelperProfile from "./pages/HelperProfile";
import Login from "./pages/Login";
import Account from "./pages/Account";
import HelperForm from "./pages/HelperForm";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Page from "./pages/Page";
import { useAuth } from "./lib/auth";

function Private({ children, admin }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="wrap page"><p className="muted">Chargement…</p></div>;
  if (!user) return <Navigate to="/connexion" replace />;
  if (admin && profile?.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/aidant/:id" element={<HelperProfile />} />
        <Route path="/page/:slug" element={<Page />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/mon-profil" element={<Private><Account /></Private>} />
        <Route path="/devenir-aidant" element={<Private><HelperForm /></Private>} />
        <Route path="/tableau-de-bord" element={<Private><Dashboard /></Private>} />
        <Route path="/admin" element={<Private admin><Admin /></Private>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
