import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { hashPassword, esHashValido } from './security.js';

export const DATA_DIR = process.env.DATA_DIR || path.join(import.meta.dirname, '..', 'data');
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'maxikiosco_apolo.sqlite');
export const PASSWORD_INICIAL = 'Apolo2026!';

if (!fs.existsSync(DB_PATH)) {
  throw new Error(`No se encontró la base de datos en ${DB_PATH}. Copiá maxikiosco_apolo.sqlite a la carpeta backend/data/`);
}

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');

/** Ejecuta fn dentro de una transacción: o se guarda TODO o no se guarda NADA. */
export function transaccion(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ya revertida */ }
    throw e;
  }
}

const columnas = (tabla) => db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name);

/** Ajustes idempotentes sobre la base original (se pueden correr muchas veces sin problema). */
export function migrar() {
  // 1) Permitir stock 0: el original exigía Stock_Actual >= 1 y no dejaba vender la última unidad.
  const sqlProd = db.prepare("SELECT sql FROM sqlite_master WHERE name='productos'").get().sql;
  if (/Stock_Actual\s*>=\s*1/.test(sqlProd)) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    try {
      db.exec(`CREATE TABLE productos_nuevo (
        ID_Producto INTEGER PRIMARY KEY AUTOINCREMENT,
        Codigo_Producto TEXT NOT NULL UNIQUE,
        Nombre TEXT NOT NULL CHECK (length(Nombre) <= 30),
        Stock_Actual INTEGER NOT NULL CHECK (Stock_Actual >= 0),
        Stock_Minimo INTEGER NOT NULL CHECK (Stock_Minimo >= 1),
        Precio NUMERIC NOT NULL DEFAULT 0.00 CHECK (Precio >= 0),
        Estado INTEGER NOT NULL DEFAULT 1 CHECK (Estado IN (0,1))
      )`);
      db.exec('INSERT INTO productos_nuevo SELECT ID_Producto,Codigo_Producto,Nombre,Stock_Actual,Stock_Minimo,Precio,Estado FROM productos');
      db.exec('DROP TABLE productos');
      db.exec('ALTER TABLE productos_nuevo RENAME TO productos');
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    db.exec('PRAGMA foreign_keys = ON');
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Error de integridad tras migrar productos');
  }

  // 2) Columnas nuevas
  if (!columnas('usuarios').includes('Debe_Cambiar_Contrasena'))
    db.exec('ALTER TABLE usuarios ADD COLUMN Debe_Cambiar_Contrasena INTEGER NOT NULL DEFAULT 0');
  if (!columnas('ventas').includes('ID_Usuario'))
    db.exec('ALTER TABLE ventas ADD COLUMN ID_Usuario INTEGER REFERENCES usuarios(ID_Usuario)');

  // 3) Tablas nuevas (requeridas por el PDF: historial de precios y control de diferencias de cierre)
  db.exec(`
    CREATE TABLE IF NOT EXISTS historial_precios (
      ID_Historial INTEGER PRIMARY KEY AUTOINCREMENT,
      ID_Producto INTEGER NOT NULL REFERENCES productos(ID_Producto),
      Precio_Anterior NUMERIC,
      Precio_Nuevo NUMERIC NOT NULL CHECK (Precio_Nuevo >= 0),
      ID_Usuario INTEGER NOT NULL REFERENCES usuarios(ID_Usuario),
      Fecha TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cierres_caja (
      ID_Cierre INTEGER PRIMARY KEY AUTOINCREMENT,
      ID_Caja INTEGER NOT NULL UNIQUE REFERENCES cajas(ID_Caja),
      ID_Usuario INTEGER NOT NULL REFERENCES usuarios(ID_Usuario),
      Efectivo_Esperado NUMERIC NOT NULL,
      Efectivo_Contado NUMERIC NOT NULL CHECK (Efectivo_Contado >= 0),
      Diferencia NUMERIC NOT NULL,
      Observaciones TEXT
    );
  `);

  // 4) Los hashes de ejemplo de la base original no sirven para entrar: se reemplazan.
  const upd = db.prepare('UPDATE usuarios SET Contrasena=?, Debe_Cambiar_Contrasena=1 WHERE ID_Usuario=?');
  let n = 0;
  for (const u of db.prepare('SELECT ID_Usuario, Contrasena FROM usuarios').all()) {
    if (!esHashValido(u.Contrasena)) { upd.run(hashPassword(PASSWORD_INICIAL), u.ID_Usuario); n++; }
  }
  if (n) console.log(`[db] ${n} usuario(s) con contraseña inicial "${PASSWORD_INICIAL}" (se pedirá cambiarla al ingresar)`);
}
