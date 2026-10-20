import { HttpError } from './util.js';

export function createRouter() {
  const routes = [];
  return {
    /** opts: { public: true } o { roles: ['Administrador', ...] } */
    add(method, path, handler, opts = {}) {
      const keys = [];
      const re = new RegExp('^' + path.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
      routes.push({ method, re, keys, handler, opts });
    },
    match(method, pathname) {
      let existe = false;
      for (const r of routes) {
        const m = r.re.exec(pathname);
        if (!m) continue;
        existe = true;
        if (r.method !== method) continue;
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { route: r, params };
      }
      return existe ? { noMethod: true } : null;
    },
  };
}

const LIMITE = 100 * 1024;
export function leerJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const partes = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > LIMITE) { reject(new HttpError(413, 'El contenido enviado es demasiado grande')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => {
      try {
        const txt = Buffer.concat(partes).toString('utf8');
        const obj = txt ? JSON.parse(txt) : {};
        if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) throw new Error();
        resolve(obj);
      } catch { reject(new HttpError(400, 'El formato de los datos enviados no es válido')); }
    });
    req.on('error', () => reject(new HttpError(400, 'No se pudo leer la solicitud')));
  });
}
