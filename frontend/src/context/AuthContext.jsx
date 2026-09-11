import React, { createContext, useContext, useState, useEffect } from "react";
import { verificarTokenSSO } from "../api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("anticipos_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("anticipos_token") || "");
  const [cargando, setCargando] = useState(true);

  // Inicialización y verificación estricta de token
  useEffect(() => {
    let cancelado = false;

    const verificarSesionInicial = async () => {
      const savedToken = localStorage.getItem("anticipos_token");
      if (savedToken) {
        try {
          const res = await verificarTokenSSO(savedToken);
          if (res.valid && res.user && !cancelado) {
            setUser(res.user);
            localStorage.setItem("anticipos_user", JSON.stringify(res.user));
          } else if (!cancelado) {
            setUser(null);
            localStorage.removeItem("anticipos_user");
            localStorage.removeItem("anticipos_token");
          }
        } catch {
          if (!cancelado) {
            setUser(null);
            localStorage.removeItem("anticipos_user");
            localStorage.removeItem("anticipos_token");
          }
        }
      } else {
        setUser(null);
      }
      if (!cancelado) setCargando(false);
    };

    verificarSesionInicial();

    return () => {
      cancelado = true;
    };
  }, []);

  // Protocolo Handshake SSO en RAM con Pandora / Cerberus
  useEffect(() => {
    // 1. Al cargar la ventana, si fue abierta desde Pandora (window.opener), solicitar token
    if (window.opener) {
      console.log("SSO: Solicitando handshake en memoria a Cerberus / Pandora...");
      try {
        window.opener.postMessage("CERBERUS_REQUEST_SSO_TOKEN", "https://pandora.pcmejia.com");
      } catch (e) {
        console.warn("No se pudo enviar postMessage a opener:", e);
      }
    }

    // 2. Escuchar la entrega del token desde Pandora
    const handleSSOEvent = async (event) => {
      // Validar origen seguro de Pandora o localhost
      if (event.origin !== "https://pandora.pcmejia.com" && !event.origin.includes("localhost")) {
        return;
      }

      const data = event.data;
      if (data && data.type === "CERBERUS_SSO_TOKEN_DELIVERY" && data.token) {
        console.log("🔐 SSO: Token JWT recibido de Cerberus.");
        const ssoToken = data.token;
        setToken(ssoToken);
        localStorage.setItem("anticipos_token", ssoToken);

        try {
          setCargando(true);
          const res = await verificarTokenSSO(ssoToken);
          if (res.valid && res.user) {
            setUser(res.user);
            localStorage.setItem("anticipos_user", JSON.stringify(res.user));
          }
        } catch (err) {
          console.error("Error verificando token SSO:", err);
        } finally {
          setCargando(false);
        }
      }
    };

    window.addEventListener("message", handleSSOEvent);
    return () => window.removeEventListener("message", handleSSOEvent);
  }, []);

  const loginManual = (usuarioData, tokenStr = "mock_session_token") => {
    setUser(usuarioData);
    setToken(tokenStr);
    localStorage.setItem("anticipos_user", JSON.stringify(usuarioData));
    localStorage.setItem("anticipos_token", tokenStr);
  };

  const logout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem("anticipos_user");
    localStorage.removeItem("anticipos_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        cargando,
        isAuthenticated: Boolean(user),
        loginManual,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
};
