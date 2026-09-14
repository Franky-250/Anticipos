import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./Sidebar";
import HeaderBar from "./components/HeaderBar";
import Dashboard from "./pages/Dashboard";
import Solicitudes from "./pages/Solicitudes";
import Estados from "./pages/Estados";
import Aprobaciones from "./pages/Aprobaciones";
import Recaudo from "./pages/Recaudo";
import Colaboradores from "./pages/Colaboradores";
import Accesos from "./pages/Accesos";
import Topes from "./pages/Topes";
import NotFound404 from "./pages/NotFound404";
import "./App.css";

function AppContent() {
  const { isAuthenticated, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="pantalla-cargando-sso">
        <div className="spinner"></div>
        <p>Verificando autenticación con Pandora SSO...</p>
      </div>
    );
  }

  // Si no está autenticado estrictamente con Pandora, mostrar 404 en todo el sistema
  if (!isAuthenticated) {
    return <NotFound404 />;
  }

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <div className="app-contenido-wrapper">
          <HeaderBar />
          <main className="contenido">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/solicitudes" element={<Solicitudes />} />
              <Route path="/estados" element={<Estados />} />
              <Route path="/aprobaciones" element={<Aprobaciones />} />
              <Route path="/colaboradores" element={<Colaboradores />} />
              <Route path="/recaudo" element={<Recaudo />} />
              <Route path="/accesos" element={<Accesos />} />
              <Route path="/topes" element={<Topes />} />
              <Route path="*" element={<NotFound404 />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
