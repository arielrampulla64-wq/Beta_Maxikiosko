import { db } from '../db.js';
import { hoy, r2 } from '../util.js';
import { cajaAbierta, resumenCaja } from './caja.js';

export function registrarDashboard(r) {
  r.add('GET', '/api/dashboard', ({ user }) => {
    const c = cajaAbierta();
    const out = {
      caja: c ? resumenCaja(c) : null,
      stockBajo: db.prepare(`SELECT ID_Producto id, Nombre nombre, Stock_Actual stock, Stock_Minimo minimo FROM productos
        WHERE Estado = 1 AND Stock_Actual <= Stock_Minimo ORDER BY Stock_Actual - Stock_Minimo, Nombre LIMIT 8`).all(),
      totalStockBajo: db.prepare('SELECT COUNT(*) n FROM productos WHERE Estado = 1 AND Stock_Actual <= Stock_Minimo').get().n,
    };
    if (user.Rol !== 'Empleado') {
      const v = db.prepare('SELECT COUNT(*) n, COALESCE(SUM(Total_Venta),0) t FROM ventas WHERE Fecha_Hora >= ?').get(`${hoy()} 00:00:00`);
      out.ventasHoy = { cantidad: v.n, total: r2(v.t) };
    }
    if (user.Rol === 'Administrador') {
      const p = db.prepare('SELECT SUM(Estado=1) activos, SUM(Estado=0) inactivos FROM productos').get();
      out.productos = { activos: p.activos || 0, inactivos: p.inactivos || 0 };
      out.ultimaDiferencia = db.prepare('SELECT Diferencia d, ID_Caja id FROM cierres_caja ORDER BY ID_Cierre DESC LIMIT 1').get() || null;
    }
    return out;
  });
}
