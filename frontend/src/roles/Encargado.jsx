// PANTALLA DEL ENCARGADO: opera caja, carga/edita productos y vende. No da de baja productos.
import Shell from '../components/Shell.jsx';
import { Tarjeta, StockBajo, EstadoCaja, useDashboard, Aviso } from '../components/Comunes.jsx';
import Productos from '../pages/Productos.jsx';
import Caja from '../pages/Caja.jsx';
import Ventas from '../pages/Ventas.jsx';
import { pesos } from '../utils.js';

const LINKS = [
  { to: '/encargado', label: 'Mi turno', end: true },
  { to: '/encargado/ventas', label: 'Vender' },
  { to: '/encargado/caja', label: 'Caja' },
  { to: '/encargado/productos', label: 'Productos' },
];
const PERMISOS_PRODUCTOS = { crear: true, editar: true, baja: false, historial: true };
const PERMISOS_CAJA = { abrir: true, cerrar: true, historial: true };

function Inicio() {
  const { d, error } = useDashboard();
  if (error) return <Aviso>{error}</Aviso>;
  if (!d) return <p>Cargando…</p>;
  return (
    <>
      <h4 className="mb-3">📋 Mi turno</h4>
      <div className="row g-3 mb-3">
        <Tarjeta titulo="Ventas de hoy" valor={pesos(d.ventasHoy.total)} sub={`${d.ventasHoy.cantidad} operaciones`} color="success" />
        <Tarjeta titulo="Stock bajo" valor={d.totalStockBajo} sub="productos a reponer" color={d.totalStockBajo ? 'warning' : 'secondary'} />
        <Tarjeta titulo="Efectivo en caja" valor={d.caja ? pesos(d.caja.efectivoEsperado) : '—'} sub={d.caja ? 'esperado en cajón' : 'caja cerrada'} />
      </div>
      <div className="row g-3"><div className="col-md-6"><EstadoCaja caja={d.caja} /></div><div className="col-md-6"><StockBajo d={d} /></div></div>
    </>
  );
}

export default function Encargado({ seccion }) {
  return (
    <Shell titulo="Panel del Encargado" tema="bg-primary" links={LINKS}>
      {seccion === 'inicio' && <Inicio />}
      {seccion === 'productos' && <Productos permisos={PERMISOS_PRODUCTOS} />}
      {seccion === 'caja' && <Caja permisos={PERMISOS_CAJA} />}
      {seccion === 'ventas' && <Ventas />}
    </Shell>
  );
}
