import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth, HOME } from '../auth.jsx';
import { Aviso } from '../components/Comunes.jsx';

export default function Login() {
  const { usuario, login } = useAuth();
  const nav = useNavigate();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={usuario.debeCambiar ? '/cambiar-contrasena' : HOME[usuario.rol]} replace />;

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    setError('');
    if (!user.trim() || !pass) return setError('Completá usuario y contraseña');
    setEnviando(true);
    try {
      const u = await login(user.trim(), pass);
      nav(u.debeCambiar ? '/cambiar-contrasena' : HOME[u.rol], { replace: true });
    } catch (err) {
      setError(err.message);
      setPass('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <div className="card shadow login-card w-100">
        <div className="card-body p-4">
          <h3 className="text-center mb-1">🏪 Maxikiosco Apolo</h3>
          <p className="text-center text-muted">Iniciá sesión para continuar</p>
          <Aviso onClose={() => setError('')}>{error}</Aviso>
          <form onSubmit={enviar} noValidate>
            <div className="mb-3">
              <label htmlFor="usuario" className="form-label">Usuario</label>
              <input id="usuario" className="form-control" value={user} onChange={(e) => setUser(e.target.value)} maxLength={50} autoComplete="username" autoFocus />
            </div>
            <div className="mb-3">
              <label htmlFor="clave" className="form-label">Contraseña</label>
              <input id="clave" type="password" className="form-control" value={pass} onChange={(e) => setPass(e.target.value)} maxLength={200} autoComplete="current-password" />
            </div>
            <button className="btn btn-primary w-100" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
