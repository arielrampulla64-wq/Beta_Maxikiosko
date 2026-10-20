import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, HOME } from '../auth.jsx';
import { Aviso } from '../components/Comunes.jsx';

export default function CambiarPassword() {
  const { usuario, refrescar, logout } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    setError('');
    if (!f.actual) return setError('Ingresá tu contraseña actual');
    if (f.nueva.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres');
    if (!/[A-Za-z]/.test(f.nueva) || !/\d/.test(f.nueva)) return setError('La nueva contraseña debe tener al menos una letra y un número');
    if (f.nueva !== f.repetir) return setError('Las contraseñas nuevas no coinciden');
    setEnviando(true);
    try {
      const r = await api('/auth/cambiar-contrasena', { method: 'POST', body: { actual: f.actual, nueva: f.nueva } });
      setOk(r.mensaje);
      setF({ actual: '', nueva: '', repetir: '' });
      await refrescar();
      setTimeout(() => nav(HOME[usuario.rol], { replace: true }), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <div className="card shadow login-card w-100">
        <div className="card-body p-4">
          <h4 className="mb-1">🔑 Cambiar contraseña</h4>
          {usuario.debeCambiar && <Aviso tipo="warning">Por seguridad, debés cambiar tu contraseña inicial antes de continuar.</Aviso>}
          <Aviso onClose={() => setError('')}>{error}</Aviso>
          <Aviso tipo="success">{ok}</Aviso>
          <form onSubmit={enviar} noValidate>
            <div className="mb-3">
              <label htmlFor="actual" className="form-label">Contraseña actual</label>
              <input id="actual" type="password" className="form-control" value={f.actual} onChange={set('actual')} maxLength={200} autoComplete="current-password" />
            </div>
            <div className="mb-3">
              <label htmlFor="nueva" className="form-label">Nueva contraseña</label>
              <input id="nueva" type="password" className="form-control" value={f.nueva} onChange={set('nueva')} maxLength={64} autoComplete="new-password" />
              <div className="form-text">Mínimo 8 caracteres, con al menos una letra y un número.</div>
            </div>
            <div className="mb-3">
              <label htmlFor="repetir" className="form-label">Repetir nueva contraseña</label>
              <input id="repetir" type="password" className="form-control" value={f.repetir} onChange={set('repetir')} maxLength={64} autoComplete="new-password" />
            </div>
            <button className="btn btn-primary w-100" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar contraseña'}</button>
          </form>
          <div className="text-center mt-3">
            {usuario.debeCambiar ? <button className="btn btn-link" onClick={logout}>Salir</button> : <Link to={HOME[usuario.rol]}>← Volver</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}
