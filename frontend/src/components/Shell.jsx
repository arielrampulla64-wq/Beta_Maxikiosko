import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

// Marco de cada pantalla de rol: barra superior + menú propio del rol.
export default function Shell({ titulo, tema, links, children }) {
  const { usuario, logout } = useAuth();
  return (
    <>
      <nav className={`navbar navbar-expand-md navbar-dark ${tema} mb-4`}>
        <div className="container">
          <span className="navbar-brand fw-bold">🏪 Apolo · {titulo}</span>
          <ul className="navbar-nav me-auto flex-row flex-wrap gap-2">
            {links.map((l) => (
              <li className="nav-item" key={l.to}>
                <NavLink end={l.end} to={l.to} className={({ isActive }) => 'nav-link px-2' + (isActive ? ' active fw-bold' : '')}>{l.label}</NavLink>
              </li>
            ))}
          </ul>
          <div className="d-flex align-items-center gap-2 text-white small">
            <span>{usuario.nombre} <span className="badge bg-light text-dark">{usuario.rol}</span></span>
            <Link to="/cambiar-contrasena" className="btn btn-sm btn-outline-light">Cambiar contraseña</Link>
            <button className="btn btn-sm btn-light" onClick={logout}>Salir</button>
          </div>
        </div>
      </nav>
      <main className="container pb-5">{children}</main>
    </>
  );
}
