import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth, HOME } from './auth.jsx';
import Login from './pages/Login.jsx';
import CambiarPassword from './pages/CambiarPassword.jsx';
import Admin from './roles/Admin.jsx';
import Encargado from './roles/Encargado.jsx';
import Empleado from './roles/Empleado.jsx';

// Guardia de rutas: sin sesión -> login; con rol equivocado -> a SU propia pantalla.
function Privada({ rol, children }) {
  const { usuario, cargando } = useAuth();
  const loc = useLocation();
  if (cargando) return <div className="text-center mt-5">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.debeCambiar && loc.pathname !== '/cambiar-contrasena') return <Navigate to="/cambiar-contrasena" replace />;
  if (rol && usuario.rol !== rol) return <Navigate to={HOME[usuario.rol]} replace />;
  return children;
}

function Raiz() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="text-center mt-5">Cargando…</div>;
  return <Navigate to={usuario ? HOME[usuario.rol] : '/login'} replace />;
}

const PANTALLAS = [
  ['/admin', 'Administrador', Admin],
  ['/encargado', 'Encargado', Encargado],
  ['/empleado', 'Empleado', Empleado],
];
const SECCIONES = ['', '/productos', '/caja', '/ventas'];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Raiz />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cambiar-contrasena" element={<Privada><CambiarPassword /></Privada>} />
      {PANTALLAS.flatMap(([base, rol, Pantalla]) =>
        SECCIONES.map((s) => (
          <Route key={base + s} path={base + s} element={<Privada rol={rol}><Pantalla seccion={s.slice(1) || 'inicio'} /></Privada>} />
        ))
      )}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
