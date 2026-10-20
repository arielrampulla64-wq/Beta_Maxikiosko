// Pruebas de integración: se ejecutan con "npm test" sobre una COPIA temporal de la base.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apolo-'));
fs.copyFileSync(path.join(import.meta.dirname, '..', 'data', 'maxikiosco_apolo.sqlite'), path.join(tmp, 'maxikiosco_apolo.sqlite'));
process.env.DATA_DIR = tmp;
process.env.TOKEN_SECRET = 'secreto-de-prueba';

let server, base;
before(async () => {
  const { crearServidor } = await import('../src/server.js');
  server = crearServidor();
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => { server.close(); });

async function api(ruta, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + ruta, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  return { status: res.status, data: await res.json() };
}
const PASS = 'Apolo2026!';
async function login(usuario, contrasena = PASS) {
  const r = await api('/api/auth/login', { method: 'POST', body: { usuario, contrasena } });
  return r;
}
const consulta = (sql, ...p) => { const d = new DatabaseSync(path.join(tmp, 'maxikiosco_apolo.sqlite')); try { return d.prepare(sql).all(...p); } finally { d.close(); } };

let admin, enc, emp;

test('login: correcto, incorrecto y sin token', async () => {
  const a = await login('arampulla'); assert.equal(a.status, 200); assert.equal(a.data.usuario.rol, 'Administrador'); assert.equal(a.data.usuario.debeCambiar, true);
  admin = a.data.token;
  enc = (await login('eapaza')).data.token; emp = (await login('vargote')).data.token;
  assert.equal((await login('arampulla', 'mala')).status, 401);
  assert.equal((await login('noexiste')).status, 401);
  assert.equal((await api('/api/productos')).status, 401);
  assert.equal((await api('/api/productos', { token: 'basura.basura' })).status, 401);
});

test('cambio de contraseña: validaciones y efecto real', async () => {
  const cambiar = (body, token = admin) => api('/api/auth/cambiar-contrasena', { method: 'POST', body, token });
  assert.equal((await cambiar({ actual: 'incorrecta', nueva: 'Nueva1234' })).status, 400);
  assert.equal((await cambiar({ actual: PASS, nueva: 'corta1' })).status, 400);
  assert.equal((await cambiar({ actual: PASS, nueva: 'sololetrasaqui' })).status, 400);
  assert.equal((await cambiar({ actual: PASS, nueva: '123456789' })).status, 400);
  assert.equal((await cambiar({ actual: PASS, nueva: PASS })).status, 400);
  assert.equal((await cambiar({ actual: PASS, nueva: 'arampulla99' })).status, 400);
  assert.equal((await cambiar({ actual: PASS, nueva: 'Nueva1234' })).status, 200);
  assert.equal((await login('arampulla', PASS)).status, 401);
  const ok = await login('arampulla', 'Nueva1234');
  assert.equal(ok.status, 200); assert.equal(ok.data.usuario.debeCambiar, false);
  admin = ok.data.token;
});

test('bloqueo tras 5 intentos fallidos', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await login('jpereyra', 'x' + i)).status, 401);
  assert.equal((await login('jpereyra', PASS)).status, 429);
});

test('productos: permisos por rol', async () => {
  const nuevo = { codigo: 'p100', nombre: 'Chicle Menta', stockActual: 10, stockMinimo: 2, precio: 350.5 };
  assert.equal((await api('/api/productos', { method: 'POST', body: nuevo, token: emp })).status, 403);
  assert.equal((await api('/api/productos/1', { method: 'PUT', body: nuevo, token: emp })).status, 403);
  assert.equal((await api('/api/productos/1/estado', { method: 'PATCH', body: { activo: false }, token: emp })).status, 403);
  assert.equal((await api('/api/productos/1/estado', { method: 'PATCH', body: { activo: false }, token: enc })).status, 403);
  assert.equal((await api('/api/productos/1/historial-precios', { token: emp })).status, 403);
  const c = await api('/api/productos', { method: 'POST', body: nuevo, token: enc });
  assert.equal(c.status, 200); assert.equal(c.data.producto.codigo, 'P100'); assert.equal(c.data.producto.precio, 350.5);
  assert.equal((await api('/api/productos', { method: 'POST', body: nuevo, token: admin })).status, 409);
  assert.equal((await api('/api/productos', { method: 'POST', body: { ...nuevo, codigo: 'P101', nombre: 'chicle menta' }, token: admin })).status, 409);
});

test('productos: rechaza negativos, infinitos, NaN, decimales y basura', async () => {
  const base1 = { codigo: 'X1', nombre: 'Prueba', stockActual: 5, stockMinimo: 1, precio: 100 };
  const malos = [
    { precio: -5 }, { precio: 0 }, { precio: 'abc' }, { precio: null }, { precio: 1.234 }, { precio: 1e12 }, { precio: '1e5' }, { precio: '-3' },
    { stockActual: -1 }, { stockActual: 2.5 }, { stockActual: 'NaN' }, { stockActual: 1e9 }, { stockMinimo: 0 }, { stockMinimo: -2 },
    { nombre: '' }, { nombre: 'x'.repeat(31) }, { codigo: 'a b' }, { codigo: '' }, { nombre: 123 },
  ];
  for (const m of malos) {
    const r = await api('/api/productos', { method: 'POST', body: { ...base1, ...m }, token: admin });
    assert.equal(r.status, 400, `debería rechazar ${JSON.stringify(m)} → ${r.status} ${JSON.stringify(r.data)}`);
  }
  // "1e999" en JSON crudo se parsea como Infinity
  const inf = await api('/api/productos', { method: 'POST', body: '{"codigo":"X2","nombre":"Inf","stockActual":5,"stockMinimo":1,"precio":1e999}', token: admin });
  assert.equal(inf.status, 400);
  assert.equal((await api('/api/productos', { method: 'POST', body: '{roto', token: admin })).status, 400);
  assert.equal((await api('/api/productos', { method: 'POST', body: '[1,2]', token: admin })).status, 400);
});

test('productos: edición, historial de precios y baja (solo admin)', async () => {
  const lista = (await api('/api/productos', { token: enc })).data.productos;
  const p = lista.find((x) => x.codigo === 'P100');
  const ed = await api(`/api/productos/${p.id}`, { method: 'PUT', body: { codigo: 'P100', nombre: 'Chicle Menta', stockActual: 12, stockMinimo: 2, precio: 400 }, token: enc });
  assert.equal(ed.status, 200); assert.equal(ed.data.producto.precio, 400);
  const h = await api(`/api/productos/${p.id}/historial-precios`, { token: enc });
  assert.equal(h.data.historial.length, 2); assert.equal(h.data.historial[0].anterior, 350.5);
  assert.equal((await api(`/api/productos/${p.id}/estado`, { method: 'PATCH', body: { activo: false }, token: admin })).status, 200);
  assert.ok(!(await api('/api/productos', { token: emp })).data.productos.some((x) => x.id === p.id), 'empleado no ve inactivos');
  assert.ok((await api('/api/productos?inactivos=1', { token: admin })).data.productos.some((x) => x.id === p.id));
  assert.equal((await api('/api/productos/9999', { method: 'PUT', body: { codigo: 'ZZ', nombre: 'ZZ', stockActual: 1, stockMinimo: 1, precio: 1 }, token: enc })).status, 404);
  assert.equal((await api('/api/productos/abc', { method: 'PUT', body: {}, token: enc })).status, 400);
});

test('ventas sin caja abierta / caja ya abierta del seed', async () => {
  const v = await api('/api/ventas', { method: 'POST', token: emp, body: { items: [{ idProducto: 1, cantidad: 1 }], pagos: [{ idMetodoPago: 1, monto: 1200 }] } });
  // la base trae la caja #2 abierta
  assert.equal(v.status, 200);
  const ap = await api('/api/caja/apertura', { method: 'POST', body: { saldoInicial: 1000 }, token: enc });
  assert.equal(ap.status, 409);
});

test('cierre de caja: permisos, validaciones y diferencia', async () => {
  assert.equal((await api('/api/caja/cierre', { method: 'POST', body: { efectivoContado: 1 }, token: emp })).status, 403);
  for (const m of [-1, 'abc', null, 1e999, 1.234, '1e3']) {
    const body = typeof m === 'number' && !Number.isFinite(m) ? '{"efectivoContado":1e999}' : { efectivoContado: m };
    assert.equal((await api('/api/caja/cierre', { method: 'POST', body, token: enc })).status, 400, `cierre con ${m}`);
  }
  const act = (await api('/api/caja/actual', { token: emp })).data.caja;
  assert.equal(act.idCaja, 2);
  const esperado = act.efectivoEsperado;
  const c = await api('/api/caja/cierre', { method: 'POST', body: { efectivoContado: esperado - 100, observaciones: 'Faltan $100' }, token: enc });
  assert.equal(c.status, 200); assert.equal(c.data.caja.cierre.diferencia, -100); assert.equal(c.data.caja.estado, 'Cerrada');
  assert.equal((await api('/api/caja/cierre', { method: 'POST', body: { efectivoContado: 5 }, token: admin })).status, 409);
  const reg = consulta('SELECT * FROM cierres_caja WHERE ID_Caja = 2');
  assert.equal(reg.length, 1); assert.equal(reg[0].Diferencia, -100);
});

test('vender con caja cerrada se rechaza; apertura valida montos', async () => {
  const body = { items: [{ idProducto: 1, cantidad: 1 }], pagos: [{ idMetodoPago: 1, monto: 1200 }] };
  assert.equal((await api('/api/ventas', { method: 'POST', body, token: emp })).status, 409);
  assert.equal((await api('/api/caja/apertura', { method: 'POST', body: { saldoInicial: 1000 }, token: emp })).status, 403);
  for (const m of [-1, 'abc', null, 1.999, 99999999999, '1e3', {}]) assert.equal((await api('/api/caja/apertura', { method: 'POST', body: { saldoInicial: m }, token: enc })).status, 400, `apertura con ${JSON.stringify(m)}`);
  assert.equal((await api('/api/caja/apertura', { method: 'POST', body: '{"saldoInicial":1e999}', token: enc })).status, 400);
  const ok = await api('/api/caja/apertura', { method: 'POST', body: { saldoInicial: 25000.5 }, token: enc });
  assert.equal(ok.status, 200); assert.equal(ok.data.caja.saldoInicial, 25000.5); assert.ok(ok.data.alerta, 'debe alertar diferencia con el cierre anterior');
  assert.equal(ok.data.caja.estado, 'Abierta');
  assert.equal((await api('/api/caja/apertura', { method: 'POST', body: { saldoInicial: 5 }, token: admin })).status, 409);
});

test('ventas: totales, stock, pagos mixtos y validaciones', async () => {
  const antes = (await api('/api/productos', { token: emp })).data.productos.find((p) => p.id === 1);
  const mal = async (body, texto) => { const r = await api('/api/ventas', { method: 'POST', body, token: emp }); assert.ok(r.status >= 400 && r.status < 500, `${texto}: ${r.status} ${JSON.stringify(r.data)}`); return r; };
  const pago = [{ idMetodoPago: 1, monto: 1200 }];
  await mal({ items: [], pagos: pago }, 'sin items');
  await mal({ items: [{ idProducto: 1, cantidad: 0 }], pagos: pago }, 'cantidad 0');
  await mal({ items: [{ idProducto: 1, cantidad: -3 }], pagos: pago }, 'cantidad negativa');
  await mal({ items: [{ idProducto: 1, cantidad: 1.5 }], pagos: pago }, 'cantidad decimal');
  await mal({ items: [{ idProducto: 1, cantidad: 'abc' }], pagos: pago }, 'cantidad texto');
  await mal({ items: [{ idProducto: 1, cantidad: 99999 }], pagos: pago }, 'cantidad enorme');
  await mal({ items: [{ idProducto: 1, cantidad: 51 }], pagos: [{ idMetodoPago: 1, monto: 61200 }] }, 'más que el stock');
  await mal({ items: [{ idProducto: 9999, cantidad: 1 }], pagos: pago }, 'producto inexistente');
  await mal({ items: [{ idProducto: 1, cantidad: 1 }], pagos: [{ idMetodoPago: 1, monto: -1200 }] }, 'pago negativo');
  await mal({ items: [{ idProducto: 1, cantidad: 1 }], pagos: [{ idMetodoPago: 1, monto: 1100 }] }, 'pago menor');
  await mal({ items: [{ idProducto: 1, cantidad: 1 }], pagos: [{ idMetodoPago: 1, monto: 1300 }] }, 'pago mayor');
  await mal({ items: [{ idProducto: 1, cantidad: 1 }], pagos: [{ idMetodoPago: 99, monto: 1200 }] }, 'método inexistente');
  await mal({ items: [{ idProducto: 1, cantidad: 1 }], pagos: [] }, 'sin pagos');
  const inf = await api('/api/ventas', { method: 'POST', token: emp, body: '{"items":[{"idProducto":1,"cantidad":1}],"pagos":[{"idMetodoPago":1,"monto":1e999}]}' });
  assert.equal(inf.status, 400);
  const despues0 = (await api('/api/productos', { token: emp })).data.productos.find((p) => p.id === 1);
  assert.equal(despues0.stockActual, antes.stockActual, 'las ventas rechazadas no deben tocar el stock');

  // Venta válida: 2 x Coca (1200) + 1 x Alfajor (900) = 3300, pago mixto. Producto repetido se unifica.
  const r = await api('/api/ventas', { method: 'POST', token: emp, body: { items: [{ idProducto: 1, cantidad: 1 }, { idProducto: 1, cantidad: 1 }, { idProducto: 3, cantidad: 1 }], pagos: [{ idMetodoPago: 1, monto: 2000 }, { idMetodoPago: 5, monto: '1300' }] } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.total, 3300);
  const p1 = (await api('/api/productos', { token: emp })).data.productos.find((p) => p.id === 1);
  assert.equal(p1.stockActual, antes.stockActual - 2);
  const caja = (await api('/api/caja/actual', { token: emp })).data.caja;
  assert.equal(caja.ventas.cantidad, 1); assert.equal(caja.ingresos, 3300);
  assert.equal(caja.efectivoEsperado, 25000.5 + 2000);
  assert.equal(caja.saldoCalculado, 25000.5 + 3300);
  assert.equal(caja.porMetodo.find((m) => m.metodo === 'QR').ingresos, 1300);
  const hist = (await api('/api/ventas', { token: emp })).data.ventas;
  assert.equal(hist.length, 2); assert.match(hist[0].detalle, /Coca Cola 500ml x2/);
});

test('no se puede vender más que el stock en dos ventas seguidas (stock llega a 0)', async () => {
  const p = (await api('/api/productos', { token: emp })).data.productos.find((x) => x.id === 6);
  const r1 = await api('/api/ventas', { method: 'POST', token: emp, body: { items: [{ idProducto: 6, cantidad: p.stockActual }], pagos: [{ idMetodoPago: 2, monto: p.stockActual * 2200 }] } });
  assert.equal(r1.status, 200, JSON.stringify(r1.data));
  const r2 = await api('/api/ventas', { method: 'POST', token: emp, body: { items: [{ idProducto: 6, cantidad: 1 }], pagos: [{ idMetodoPago: 2, monto: 2200 }] } });
  assert.equal(r2.status, 409);
  assert.equal((await api('/api/productos', { token: emp })).data.productos.find((x) => x.id === 6).stockActual, 0);
});

test('persistencia: todo quedó guardado en el archivo SQLite', async () => {
  assert.equal(consulta('SELECT COUNT(*) n FROM ventas')[0].n, 8);
  assert.equal(consulta('SELECT Stock_Actual s FROM productos WHERE ID_Producto = 6')[0].s, 0);
  assert.ok(consulta('SELECT * FROM cajas WHERE Estado_Caja = ? ORDER BY ID_Caja DESC', 'Abierta')[0].Saldo_Inicial === 25000.5);
  assert.equal(consulta('PRAGMA foreign_key_check').length, 0);
  assert.equal(consulta('PRAGMA integrity_check')[0].integrity_check, 'ok');
  const u = consulta("SELECT Contrasena FROM usuarios WHERE Nombre_Usuario = 'arampulla'")[0].Contrasena;
  assert.match(u, /^scrypt\$/); assert.ok(!u.includes('Nueva1234'));
});

test('dashboard y historial por rol', async () => {
  const d = await api('/api/dashboard', { token: emp }); assert.equal(d.status, 200); assert.equal(d.data.ventasHoy, undefined);
  const a = await api('/api/dashboard', { token: admin }); assert.ok(a.data.ventasHoy && a.data.productos);
  assert.equal((await api('/api/caja/historial', { token: emp })).status, 403);
  assert.equal((await api('/api/caja/historial', { token: enc })).status, 200);
  assert.equal((await api('/api/ruta-inexistente', { token: enc })).status, 404);
});
