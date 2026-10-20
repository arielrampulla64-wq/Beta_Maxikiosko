import { db, transaccion } from '../db.js';
import { HttpError, bad, entero, dinero, ahora, r2 } from '../util.js';
import { cajaAbierta } from './caja.js';

const fmtPesos = (c) => `$${(c / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

export function registrarVentas(r) {
  r.add('GET', '/api/metodos-pago', () => ({ metodos: db.prepare('SELECT ID_Metodo_Pago id, Nombre nombre FROM metodos_pago ORDER BY ID_Metodo_Pago').all() }));

  // Proceso 5: Gestión de ventas
  r.add('POST', '/api/ventas', ({ body, user }) => {
    const caja = cajaAbierta();
    if (!caja) throw new HttpError(409, 'No hay una caja abierta. Un encargado debe abrir la caja antes de vender.');

    if (!Array.isArray(body.items) || body.items.length < 1) throw bad('Agregá al menos un producto a la venta');
    if (body.items.length > 100) throw bad('Una venta no puede tener más de 100 renglones');
    if (!Array.isArray(body.pagos) || body.pagos.length < 1) throw bad('Indicá el medio de pago');
    if (body.pagos.length > 5) throw bad('Máximo 5 medios de pago por venta');

    // Unificar productos repetidos
    const cantidades = new Map();
    for (const it of body.items) {
      if (!it || typeof it !== 'object') throw bad('Producto inválido');
      const id = entero(it.idProducto, 'El producto', { min: 1, max: 1_000_000_000 });
      const cant = entero(it.cantidad, 'La cantidad', { min: 1, max: 9999 });
      cantidades.set(id, (cantidades.get(id) || 0) + cant);
    }
    // Unificar medios de pago repetidos
    const metodos = new Map();
    for (const pg of body.pagos) {
      if (!pg || typeof pg !== 'object') throw bad('Pago inválido');
      const id = entero(pg.idMetodoPago, 'El medio de pago', { min: 1, max: 1000 });
      const monto = dinero(pg.monto, 'El monto del pago', { min: 0.01, max: 99_999_999.99 });
      metodos.set(id, (metodos.get(id) || 0) + monto);
    }

    const resultado = transaccion(() => {
      // Los precios y el stock SIEMPRE se leen de la base (no se confía en el navegador).
      const lineas = [];
      let totalC = 0;
      for (const [id, cant] of cantidades) {
        const p = db.prepare('SELECT ID_Producto, Nombre, Precio, Stock_Actual, Estado FROM productos WHERE ID_Producto = ?').get(id);
        if (!p) throw new HttpError(404, `El producto #${id} no existe`);
        if (p.Estado !== 1) throw new HttpError(409, `"${p.Nombre}" está dado de baja y no se puede vender`);
        if (cant > p.Stock_Actual) throw new HttpError(409, `Stock insuficiente de "${p.Nombre}": disponible ${p.Stock_Actual}, pedido ${cant}`);
        const precioC = Math.round(p.Precio * 100);
        lineas.push({ id, cant, precioC, nombre: p.Nombre });
        totalC += precioC * cant;
      }
      if (totalC <= 0) throw bad('El total de la venta debe ser mayor a cero');

      for (const id of metodos.keys())
        if (!db.prepare('SELECT 1 FROM metodos_pago WHERE ID_Metodo_Pago = ?').get(id)) throw bad('Medio de pago inexistente');
      const pagadoC = [...metodos.values()].reduce((a, b) => a + b, 0);
      if (pagadoC !== totalC) throw bad(`Los pagos (${fmtPesos(pagadoC)}) no coinciden con el total de la venta (${fmtPesos(totalC)})`);

      const fecha = ahora();
      const mov = db.prepare(`INSERT INTO movimientos_caja (ID_Caja, Tipo_Movimiento, Monto, Fecha_Hora) VALUES (?, 'Ingreso', ?, ?)`)
        .run(caja.ID_Caja, totalC / 100, fecha).lastInsertRowid;
      const venta = db.prepare('INSERT INTO ventas (ID_Movimiento_Caja, Fecha_Hora, Total_Venta, ID_Usuario) VALUES (?,?,0,?)')
        .run(mov, fecha, user.ID_Usuario).lastInsertRowid;

      const insDet = db.prepare('INSERT INTO detalles_ventas (ID_Venta, ID_Producto, Cantidad, Precio_Unitario) VALUES (?,?,?,?)');
      const baja = db.prepare('UPDATE productos SET Stock_Actual = Stock_Actual - ? WHERE ID_Producto = ? AND Stock_Actual >= ?');
      for (const l of lineas) {
        insDet.run(venta, l.id, l.cant, l.precioC / 100);
        if (baja.run(l.cant, l.id, l.cant).changes !== 1) throw new HttpError(409, `Stock insuficiente de "${l.nombre}"`);
      }
      const insPago = db.prepare('INSERT INTO detalles_movimientos_pago (ID_Metodo_Pago, ID_Movimiento_Caja, Monto) VALUES (?,?,?)');
      for (const [idm, montoC] of metodos) insPago.run(idm, mov, montoC / 100);
      db.prepare('UPDATE ventas SET Total_Venta = ? WHERE ID_Venta = ?').run(totalC / 100, venta); // total exacto (sin ruido decimal)
      return { idVenta: Number(venta), total: totalC / 100, lineas: lineas.length };
    });
    return { ...resultado, mensaje: `Venta #${resultado.idVenta} registrada por ${fmtPesos(Math.round(resultado.total * 100))}` };
  });

  r.add('GET', '/api/ventas', ({ user }) => {
    const soloMias = user.Rol === 'Empleado';
    const filas = db.prepare(`SELECT v.ID_Venta id, v.Fecha_Hora fecha, v.Total_Venta total,
      COALESCE((SELECT e.Nombre || ' ' || e.Apellido FROM usuarios u JOIN empleados e ON e.ID_Empleado = u.ID_Empleado WHERE u.ID_Usuario = v.ID_Usuario), 'Sin dato') vendedor,
      (SELECT group_concat(p.Nombre || ' x' || d.Cantidad, ', ') FROM detalles_ventas d JOIN productos p ON p.ID_Producto = d.ID_Producto WHERE d.ID_Venta = v.ID_Venta) detalle,
      (SELECT group_concat(mp.Nombre, ' + ') FROM detalles_movimientos_pago dp JOIN metodos_pago mp ON mp.ID_Metodo_Pago = dp.ID_Metodo_Pago WHERE dp.ID_Movimiento_Caja = v.ID_Movimiento_Caja) pagos
      FROM ventas v ${soloMias ? 'WHERE v.ID_Usuario = ?' : ''} ORDER BY v.ID_Venta DESC LIMIT 30`).all(...(soloMias ? [user.ID_Usuario] : []));
    return { ventas: filas.map((f) => ({ ...f, total: r2(f.total) })) };
  });
}
