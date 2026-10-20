// Utilidades: fechas, dinero y validaciones estrictas.
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const bad = (msg) => new HttpError(400, msg);

const p2 = (n) => String(n).padStart(2, '0');
export function ahora() {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
export const hoy = () => ahora().slice(0, 10);

// Dinero: se trabaja en centavos (enteros) para evitar errores de coma flotante.
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Número entero estricto. Rechaza negativos, decimales, NaN, Infinity, "1e5", etc. */
export function entero(v, campo, { min = 0, max = 1_000_000 } = {}) {
  let n;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d{1,9}$/.test(v.trim())) n = Number(v.trim());
  else throw bad(`${campo} debe ser un número entero válido`);
  if (!Number.isSafeInteger(n)) throw bad(`${campo} debe ser un número entero válido`);
  if (n < min) throw bad(`${campo} no puede ser menor a ${min}`);
  if (n > max) throw bad(`${campo} no puede ser mayor a ${max.toLocaleString('es-AR')}`);
  return n;
}

/** Monto en pesos estricto (máx. 2 decimales, finito, no negativo). Devuelve CENTAVOS. */
export function dinero(v, campo, { min = 0, max = 99_999_999.99 } = {}) {
  let n;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw bad(`${campo} debe ser un número finito`);
    n = v;
  } else if (typeof v === 'string' && /^\d{1,9}([.,]\d{1,2})?$/.test(v.trim())) {
    n = Number(v.trim().replace(',', '.'));
  } else throw bad(`${campo} debe ser un monto válido (solo números, hasta 2 decimales)`);
  if (n < 0) throw bad(`${campo} no puede ser negativo`);
  const c = Math.round(n * 100);
  if (Math.abs(c - n * 100) > 1e-6) throw bad(`${campo} admite hasta 2 decimales`);
  if (c < Math.round(min * 100)) throw bad(`${campo} debe ser como mínimo $${min}`);
  if (c > Math.round(max * 100)) throw bad(`${campo} no puede superar $${max.toLocaleString('es-AR')}`);
  return c;
}

export function texto(v, campo, { min = 1, max = 30, opcional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (opcional) return '';
    throw bad(`${campo} es obligatorio`);
  }
  if (typeof v !== 'string') throw bad(`${campo} debe ser texto`);
  const t = v.trim().replace(/\s+/g, ' ');
  if (/[\u0000-\u001f\u007f]/.test(t)) throw bad(`${campo} contiene caracteres no permitidos`);
  if (t.length < min) throw bad(`${campo} es obligatorio`);
  if (t.length > max) throw bad(`${campo} no puede superar los ${max} caracteres`);
  return t;
}
