import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export const HOME = { Administrador: '/admin', Encargado: '/encargado', Empleado: '/empleado' };

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(!!localStorage.getItem('token'));

  const refrescar = useCallback(async () => {
    try {
      const { usuario } = await api('/auth/me');
      setUsuario(usuario);
      return usuario;
    } catch {
      localStorage.removeItem('token');
      setUsuario(null);
      return null;
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('token')) refrescar();
    const salir = () => setUsuario(null);
    window.addEventListener('auth:logout', salir);
    return () => window.removeEventListener('auth:logout', salir);
  }, [refrescar]);

  const login = async (usuario, contrasena) => {
    const data = await api('/auth/login', { method: 'POST', body: { usuario, contrasena } });
    localStorage.setItem('token', data.token);
    setUsuario(data.usuario);
    return data.usuario;
  };
  const logout = () => { localStorage.removeItem('token'); setUsuario(null); };

  return <AuthCtx.Provider value={{ usuario, cargando, login, logout, refrescar }}>{children}</AuthCtx.Provider>;
}
