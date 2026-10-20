import './tz.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { db, migrar, DATA_DIR, DB_PATH } from './db.js';
import { initSecret, verifyToken } from './security.js';
import { createRouter, leerJson } from './http.js';
import { HttpError } from './util.js';
import { registrarAuth, SQL_USUARIO } from './routes/auth.js';
import { registrarProductos } from './routes/productos.js';
import { registrarCaja } from './routes/caja.js';
import { registrarVentas } from './routes/ventas.js';
import { registrarDashboard } from './routes/dashboard.js';

migrar();
initSecret(DATA_DIR);

const router = createRouter();
registrarAuth(router);
registrarProductos(router);
registrarCaja(router);
registrarVentas(router);
registrarDashboard(router);

const STATIC_DIR = process.env.STATIC_DIR || path.join(import.meta.dirname, '..', '..', 'frontend', 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.map': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };

function enviar(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

function autenticar(req) {
  const h = req.headers.authorization || '';
  const payload = h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
  if (!payload) throw new HttpError(401, 'Tu sesión expiró. Volvé a iniciar sesión.');
  // El rol y el estado se leen de la base en cada pedido: si cambian, se aplican al instante.
  const u = db.prepare(`${SQL_USUARIO} WHERE u.ID_Usuario = ?`).get(payload.uid);
  if (!u || u.Estado !== 1) throw new HttpError(401, 'Usuario inactivo o inexistente');
  return u;
}

function estatico(req, res, pathname) {
  if (!fs.existsSync(STATIC_DIR)) return enviar(res, 404, { error: 'Frontend no compilado. Ejecutá "npm run build" en la carpeta frontend, o usá "npm run dev".' });
  let file = path.join(STATIC_DIR, path.normalize(decodeURIComponent(pathname)));
  if (!file.startsWith(STATIC_DIR)) return enviar(res, 403, { error: 'Prohibido' });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(STATIC_DIR, 'index.html'); // SPA
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(file).pipe(res);
}

async function manejar(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return estatico(req, res, url.pathname);

    const m = router.match(req.method, url.pathname);
    if (!m) throw new HttpError(404, 'Ruta no encontrada');
    if (m.noMethod) throw new HttpError(405, 'Método no permitido');

    const ctx = { params: m.params, query: url.searchParams, body: {}, user: null, ip: req.socket.remoteAddress };
    const { opts } = m.route;
    if (!opts.public) {
      ctx.user = autenticar(req);
      if (opts.roles && !opts.roles.includes(ctx.user.Rol)) throw new HttpError(403, 'No tenés permiso para realizar esta acción');
    }
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) ctx.body = await leerJson(req);
    enviar(res, 200, (await m.route.handler(ctx)) ?? { ok: true });
  } catch (e) {
    if (e instanceof HttpError) return enviar(res, e.status, { error: e.message });
    const msg = String(e?.message || '');
    if (/UNIQUE/i.test(msg)) return enviar(res, 409, { error: 'Ya existe un registro con esos datos' });
    if (/CHECK|FOREIGN KEY|NOT NULL/i.test(msg)) return enviar(res, 400, { error: 'Alguno de los datos está fuera del rango permitido' });
    console.error('[error]', e);
    enviar(res, 500, { error: 'Error interno del servidor' });
  }
}

export function crearServidor() { return http.createServer(manejar); }

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const PORT = Number(process.env.PORT) || 3001;
  crearServidor().listen(PORT, () => {
    console.log(`Maxikiosco Apolo - API lista en http://localhost:${PORT}`);
    console.log(`Base de datos: ${DB_PATH}`);
  });
  const cerrar = () => { try { db.close(); } catch { /* */ } process.exit(0); };
  process.on('SIGINT', cerrar); process.on('SIGTERM', cerrar);
}
