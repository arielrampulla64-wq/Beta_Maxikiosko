// PANTALLA DEL DUEÑO (Administrador): control total.
import Shell from '../components/Shell.jsx';
import { Tarjeta, StockBajo, EstadoCaja, useDashboard, Aviso } from '../components/Comunes.jsx';
import Productos from '../pages/Productos.jsx';
import Caja from '../pages/Caja.jsx';
import Ventas from '../pages/Ventas.jsx';
import { pesos } from '../utils.js';

const LINKS = [
  { to: '/admin', label: 'Resumen', end: true },
  { to: '/admin/productos', label: 'Productos' },
  { to: '/admin/caja', label: 'Caja' },
  { to: '/admin/ventas', label: 'Ventas' },
];
const PERMISOS_PRODUCTOS = { crear: true, editar: true, baja: true, historial: true };
const PERMISOS_CAJA = { abrir: true, cerrar: true, historial: true };

function Inicio() {
  const { d, error } = useDashboard();
  if (error) return <Aviso>{error}</Aviso>;
  if (!d) return <p>Cargando…</p>;
  return (
    <>
      <h4 className="mb-3">📊 Resumen del negocio</h4>
      <div className="row g-3 mb-3">
        <Tarjeta titulo="Ventas de hoy" valor={pesos(d.ventasHoy.total)} sub={`${d.ventasHoy.cantidad} operaciones`} color="success" />
        <Tarjeta titulo="Productos activos" valor={d.productos.activos} sub={`${d.productos.inactivos} dados de baja`} />
        <Tarjeta titulo="Stock bajo" valor={d.totalStockBajo} color={d.totalStockBajo ? 'warning' : 'secondary'} />
        <Tarjeta titulo="Último cierre" valor={d.ultimaDiferencia ? pesos(d.ultimaDiferencia.d) : '—'} sub="diferencia de efectivo" color={d.ultimaDiferencia?.d ? 'danger' : 'secondary'} />
      </div>
      <div className="row g-3"><div className="col-md-6"><EstadoCaja caja={d.caja} /></div><div className="col-md-6"><StockBajo d={d} /></div></div>
    </>
  );
}

export default function Admin({ seccion }) {
  return (
    <Shell titulo="Panel del Dueño" tema="bg-dark" links={LINKS}>
      {seccion === 'inicio' && <Inicio />}
      {seccion === 'productos' && <Productos permisos={PERMISOS_PRODUCTOS} />}
      {seccion === 'caja' && <Caja permisos={PERMISOS_CAJA} />}
      {seccion === 'ventas' && <Ventas />}
    </Shell>
  );
}
