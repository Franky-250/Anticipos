import { BrowserRouter, Route, Routes } from "react-router-dom";
import Sidebar from "./Sidebar";
import Dashboard from "./pages/Dashboard";
import Solicitudes from "./pages/Solicitudes";
import Estados from "./pages/Estados";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="contenido">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/solicitudes" element={<Solicitudes />} />
            <Route path="/estados" element={<Estados />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
