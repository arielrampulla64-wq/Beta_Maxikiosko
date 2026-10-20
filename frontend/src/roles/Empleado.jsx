// PANTALLA DEL EMPLEADO: vende y consulta. NO puede abrir/cerrar caja ni crear, editar o dar de baja productos.
import Shell from '../components/Shell.jsx';
import { StockBajo, EstadoCaja, useDashboard, Aviso } from '../components/Comunes.jsx';
import Productos from '../pages/Productos.jsx';
import Caja from '../pages/Caja.jsx';
import Ventas from '../pages/Ventas.jsx';
import { Link } from 'react-router-dom';

const LINKS = [
  { to: '/empleado', label: 'Inicio', end: true },
  { to: '/empleado/ventas', label: 'Vender' },
  { to: '/empleado/productos', label: 'Consultar productos' },
  { to: '/empleado/caja', label: 'Estado de caja' },
];
const SOLO_CONSULTA_PRODUCTOS = { crear: false, editar: false, baja: false, historial: false };
const SOLO_CONSULTA_CAJA = { abrir: false, cerrar: false, historial: false };

function Inicio() {
  const { d, error } = useDashboard();
  if (error) return <Aviso>{error}</Aviso>;
  if (!d) return <p>Cargando…</p>;
  return (
    <>
      <h4 className="mb-3">👋 ¡Buen turno!</h4>
      <div className="mb-3"><Link to="/empleado/ventas" className="btn btn-success btn-lg">🛒 Nueva venta</Link></div>
      <div className="row g-3"><div className="col-md-6"><EstadoCaja caja={d.caja} /></div><div className="col-md-6"><StockBajo d={d} /></div></div>
    </>
  );
}

export default function Empleado({ seccion }) {
  return (
    <Shell titulo="Panel del Empleado" tema="bg-success" links={LINKS}>
      {seccion === 'inicio' && <Inicio />}
      {seccion === 'productos' && <Productos permisos={SOLO_CONSULTA_PRODUCTOS} />}
      {seccion === 'caja' && <Caja permisos={SOLO_CONSULTA_CAJA} />}
      {seccion === 'ventas' && <Ventas />}
    </Shell>
  );
}
