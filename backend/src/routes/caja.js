import { db, transaccion } from '../db.js';
import { HttpError, bad, dinero, texto, ahora, r2 } from '../util.js';

const OPERADORES = ['Administrador', 'Encargado'];

export function cajaAbierta() {
  return db.prepare(`SELECT c.*, u.Nombre_Usuario, e.Nombre || ' ' || e.Apellido AS Responsable
    FROM cajas c JOIN usuarios u ON u.ID_Usuario = c.ID_Usuario JOIN empleados e ON e.ID_Empleado = u.ID_Empleado
    WHERE c.Estado_Caja = 'Abierta' ORDER BY c.ID_Caja DESC LIMIT 1`).get();
}

/** Resumen de una caja: totales, desglose por medio de pago y efectivo esperado en el cajón. */
export function resumenCaja(c) {
  const mov = db.prepare('SELECT Tipo_Movimiento t, COALESCE(SUM(Monto),0) total FROM movimientos_caja WHERE ID_Caja = ? GROUP BY Tipo_Movimiento').all(c.ID_Caja);
  const ingresos = r2(mov.find((m) => m.t === 'Ingreso')?.total);
  const egresos = r2(mov.find((m) => m.t === 'Egreso')?.total);

  const filas = db.prepare(`SELECT mp.Nombre metodo, m.Tipo_Movimiento tipo, COALESCE(SUM(d.Monto),0) total
    FROM movimientos_caja m JOIN detalles_movimientos_pago d ON d.ID_Movimiento_Caja = m.ID_Movimiento_Caja
    JOIN metodos_pago mp ON mp.ID_Metodo_Pago = d.ID_Metodo_Pago WHERE m.ID_Caja = ? GROUP BY mp.Nombre, m.Tipo_Movimiento`).all(c.ID_Caja);
  const porMetodo = {};
  for (const f of filas) {
    porMetodo[f.metodo] ??= { metodo: f.metodo, ingresos: 0, egresos: 0 };
    porMetodo[f.metodo][f.tipo === 'Ingreso' ? 'ingresos' : 'egresos'] = r2(f.total);
  }
  const ef = porMetodo.Efectivo || { ingresos: 0, egresos: 0 };
  const v = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(v.Total_Venta),0) total FROM ventas v
    JOIN movimientos_caja m ON m.ID_Movimiento_Caja = v.ID_Movimiento_Caja WHERE m.ID_Caja = ?`).get(c.ID_Caja);
  const cierre = db.prepare(`SELECT Efectivo_Esperado esperado, Efectivo_Contado contado, Diferencia diferencia, Observaciones observaciones
    FROM cierres_caja WHERE ID_Caja = ?`).get(c.ID_Caja);

  return {
    idCaja: c.ID_Caja, estado: c.Estado_Caja, responsable: c.Responsable, usuario: c.Nombre_Usuario,
    fechaApertura: c.Fecha_Apertura, fechaCierre: c.Fecha_Cierre, saldoInicial: r2(c.Saldo_Inicial),
    ingresos, egresos, saldoCalculado: r2(c.Saldo_Inicial + ingresos - egresos),
    efectivoEsperado: r2(c.Saldo_Inicial + ef.ingresos - ef.egresos),
    porMetodo: Object.values(porMetodo), ventas: { cantidad: v.n, total: r2(v.total) },
    cierre: cierre ? { ...cierre, esperado: r2(cierre.esperado), contado: r2(cierre.contado), diferencia: r2(cierre.diferencia) } : null,
  };
}

export function registrarCaja(r) {
  r.add('GET', '/api/caja/actual', () => {
    const c = cajaAbierta();
    return { caja: c ? resumenCaja(c) : null };
  });

  // Proceso 1: Apertura de caja
  r.add('POST', '/api/caja/apertura', ({ body, user }) => {
    const saldoC = dinero(body.saldoInicial, 'El monto inicial', { min: 0, max: 10_000_000 });
    const abierta = cajaAbierta();
    if (abierta) throw new HttpError(409, `Ya hay una caja abierta (responsable: ${abierta.Responsable}). Debe cerrarse antes de abrir otra.`);

    const previa = db.prepare(`SELECT c.ID_Caja, c.Saldo_Final, cc.Efectivo_Contado FROM cajas c LEFT JOIN cierres_caja cc ON cc.ID_Caja = c.ID_Caja
      WHERE c.Estado_Caja = 'Cerrada' ORDER BY c.ID_Caja DESC LIMIT 1`).get();
    const referencia = previa ? r2(previa.Efectivo_Contado ?? previa.Saldo_Final) : null;

    const idCaja = transaccion(() => {
      const res = db.prepare(`INSERT INTO cajas (ID_Usuario, Fecha_Apertura, Estado_Caja, Saldo_Inicial, Saldo_Final) VALUES (?,?, 'Abierta', ?, ?)`)
        .run(user.ID_Usuario, ahora(), saldoC / 100, saldoC / 100);
      return Number(res.lastInsertRowid);
    });

    const resp = { caja: resumenCaja(cajaAbierta()), mensaje: 'Caja abierta correctamente' };
    if (referencia !== null && Math.round(referencia * 100) !== saldoC) {
      const dif = r2(saldoC / 100 - referencia);
      resp.alerta = `El monto inicial difiere del cierre anterior ($${referencia.toLocaleString('es-AR')}) en ${dif > 0 ? '+' : ''}$${dif.toLocaleString('es-AR')}.`;
    }
    resp.idCaja = idCaja;
    return resp;
  }, { roles: OPERADORES });

  // Proceso 2: Cierre de caja (compara efectivo esperado vs contado)
  r.add('POST', '/api/caja/cierre', ({ body, user }) => {
    const contadoC = dinero(body.efectivoContado, 'El efectivo contado', { min: 0, max: 100_000_000 });
    const obs = texto(body.observaciones, 'Las observaciones', { max: 200, opcional: true });
    const c = cajaAbierta();
    if (!c) throw new HttpError(409, 'No hay ninguna caja abierta para cerrar');

    const res = resumenCaja(c);
    const esperadoC = Math.round(res.efectivoEsperado * 100);
    const difC = contadoC - esperadoC;
    transaccion(() => {
      db.prepare(`UPDATE cajas SET Estado_Caja = 'Cerrada', Fecha_Cierre = ? WHERE ID_Caja = ? AND Estado_Caja = 'Abierta'`).run(ahora(), c.ID_Caja);
      db.prepare('INSERT INTO cierres_caja (ID_Caja, ID_Usuario, Efectivo_Esperado, Efectivo_Contado, Diferencia, Observaciones) VALUES (?,?,?,?,?,?)')
        .run(c.ID_Caja, user.ID_Usuario, esperadoC / 100, contadoC / 100, difC / 100, obs || null);
    });
    const cerrada = db.prepare(`SELECT c.*, u.Nombre_Usuario, e.Nombre || ' ' || e.Apellido AS Responsable FROM cajas c
      JOIN usuarios u ON u.ID_Usuario = c.ID_Usuario JOIN empleados e ON e.ID_Empleado = u.ID_Empleado WHERE c.ID_Caja = ?`).get(c.ID_Caja);
    return { caja: resumenCaja(cerrada), mensaje: difC === 0 ? 'Caja cerrada. El efectivo coincide exactamente.' : 'Caja cerrada con diferencia de efectivo.' };
  }, { roles: OPERADORES });

  r.add('GET', '/api/caja/historial', () => {
    const filas = db.prepare(`SELECT c.ID_Caja id, c.Fecha_Apertura apertura, c.Fecha_Cierre cierre, c.Estado_Caja estado, c.Saldo_Inicial inicial, c.Saldo_Final final,
      e.Nombre || ' ' || e.Apellido responsable, cc.Efectivo_Esperado esperado, cc.Efectivo_Contado contado, cc.Diferencia diferencia, cc.Observaciones observaciones
      FROM cajas c JOIN usuarios u ON u.ID_Usuario = c.ID_Usuario JOIN empleados e ON e.ID_Empleado = u.ID_Empleado
      LEFT JOIN cierres_caja cc ON cc.ID_Caja = c.ID_Caja ORDER BY c.ID_Caja DESC LIMIT 30`).all();
    const f2 = (x) => (x === null ? null : r2(x));
    return { historial: filas.map((f) => ({ ...f, inicial: r2(f.inicial), final: f2(f.final), esperado: f2(f.esperado), contado: f2(f.contado), diferencia: f2(f.diferencia) })) };
  }, { roles: OPERADORES });
}
