import { db, transaccion } from '../db.js';
import { HttpError, bad, texto, entero, dinero, ahora, r2 } from '../util.js';

const EDITORES = ['Administrador', 'Encargado'];

const SEL = `SELECT ID_Producto AS id, Codigo_Producto AS codigo, Nombre AS nombre, Stock_Actual AS stockActual,
  Stock_Minimo AS stockMinimo, Precio AS precio, Estado AS estado FROM productos`;
const fmt = (p) => ({ ...p, precio: r2(p.precio), activo: p.estado === 1, bajoStock: p.stockActual <= p.stockMinimo });

function leerProducto(b) {
  const codigo = texto(b.codigo, 'El código', { max: 30 });
  if (!/^[A-Za-z0-9._-]+$/.test(codigo)) throw bad('El código solo admite letras, números, punto, guion y guion bajo');
  return {
    codigo: codigo.toUpperCase(),
    nombre: texto(b.nombre, 'El nombre', { max: 30 }),
    stockActual: entero(b.stockActual, 'El stock actual', { min: 0, max: 1_000_000 }),
    stockMinimo: entero(b.stockMinimo, 'El stock mínimo', { min: 1, max: 1_000_000 }),
    precioC: dinero(b.precio, 'El precio', { min: 0.01 }),
  };
}

function validarDuplicados(p, idActual = 0) {
  if (db.prepare('SELECT 1 FROM productos WHERE Codigo_Producto = ? AND ID_Producto <> ?').get(p.codigo, idActual))
    throw new HttpError(409, `Ya existe un producto con el código ${p.codigo}`);
  if (db.prepare('SELECT 1 FROM productos WHERE lower(Nombre) = lower(?) AND ID_Producto <> ?').get(p.nombre, idActual))
    throw new HttpError(409, `Ya existe un producto llamado "${p.nombre}"`);
}

function idParam(params) {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw bad('Identificador de producto inválido');
  return id;
}

export function registrarProductos(r) {
  // Todos los roles pueden consultar. El Empleado solo ve productos activos.
  r.add('GET', '/api/productos', ({ query, user }) => {
    const q = (query.get('q') || '').trim().slice(0, 50).replace(/[\\%_]/g, (m) => '\\' + m);
    const verInactivos = user.Rol !== 'Empleado' && query.get('inactivos') === '1';
    const filas = db.prepare(`${SEL} WHERE (Nombre LIKE ? ESCAPE '\\' OR Codigo_Producto LIKE ? ESCAPE '\\')
      ${verInactivos ? '' : 'AND Estado = 1'} ORDER BY Nombre COLLATE NOCASE LIMIT 500`).all(`%${q}%`, `%${q}%`);
    return { productos: filas.map(fmt) };
  });

  r.add('POST', '/api/productos', ({ body, user }) => {
    const p = leerProducto(body);
    validarDuplicados(p);
    const id = transaccion(() => {
      const res = db.prepare('INSERT INTO productos (Codigo_Producto, Nombre, Stock_Actual, Stock_Minimo, Precio, Estado) VALUES (?,?,?,?,?,1)')
        .run(p.codigo, p.nombre, p.stockActual, p.stockMinimo, p.precioC / 100);
      db.prepare('INSERT INTO historial_precios (ID_Producto, Precio_Anterior, Precio_Nuevo, ID_Usuario, Fecha) VALUES (?,?,?,?,?)')
        .run(res.lastInsertRowid, null, p.precioC / 100, user.ID_Usuario, ahora());
      return Number(res.lastInsertRowid);
    });
    return { producto: fmt(db.prepare(`${SEL} WHERE ID_Producto = ?`).get(id)), mensaje: 'Producto registrado correctamente' };
  }, { roles: EDITORES });

  r.add('PUT', '/api/productos/:id', ({ params, body, user }) => {
    const id = idParam(params);
    const actual = db.prepare('SELECT * FROM productos WHERE ID_Producto = ?').get(id);
    if (!actual) throw new HttpError(404, 'El producto no existe');
    const p = leerProducto(body);
    validarDuplicados(p, id);
    transaccion(() => {
      db.prepare('UPDATE productos SET Codigo_Producto=?, Nombre=?, Stock_Actual=?, Stock_Minimo=?, Precio=? WHERE ID_Producto=?')
        .run(p.codigo, p.nombre, p.stockActual, p.stockMinimo, p.precioC / 100, id);
      if (Math.round(actual.Precio * 100) !== p.precioC)
        db.prepare('INSERT INTO historial_precios (ID_Producto, Precio_Anterior, Precio_Nuevo, ID_Usuario, Fecha) VALUES (?,?,?,?,?)')
          .run(id, actual.Precio, p.precioC / 100, user.ID_Usuario, ahora());
    });
    return { producto: fmt(db.prepare(`${SEL} WHERE ID_Producto = ?`).get(id)), mensaje: 'Producto actualizado correctamente' };
  }, { roles: EDITORES });

  // Dar de baja / reactivar: solo los dueños (Administrador)
  r.add('PATCH', '/api/productos/:id/estado', ({ params, body }) => {
    const id = idParam(params);
    if (body.activo !== true && body.activo !== false) throw bad('Estado inválido');
    const res = db.prepare('UPDATE productos SET Estado = ? WHERE ID_Producto = ?').run(body.activo ? 1 : 0, id);
    if (!res.changes) throw new HttpError(404, 'El producto no existe');
    return { producto: fmt(db.prepare(`${SEL} WHERE ID_Producto = ?`).get(id)), mensaje: body.activo ? 'Producto reactivado' : 'Producto dado de baja' };
  }, { roles: ['Administrador'] });

  r.add('GET', '/api/productos/:id/historial-precios', ({ params }) => {
    const id = idParam(params);
    const filas = db.prepare(`SELECT h.Fecha AS fecha, h.Precio_Anterior AS anterior, h.Precio_Nuevo AS nuevo, u.Nombre_Usuario AS usuario
      FROM historial_precios h JOIN usuarios u ON u.ID_Usuario = h.ID_Usuario WHERE h.ID_Producto = ? ORDER BY h.ID_Historial DESC LIMIT 50`).all(id);
    return { historial: filas.map((f) => ({ ...f, anterior: f.anterior === null ? null : r2(f.anterior), nuevo: r2(f.nuevo) })) };
  }, { roles: EDITORES });
}
