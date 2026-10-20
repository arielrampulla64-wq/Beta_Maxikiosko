const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
export const pesos = (n) => fmt.format(Number(n) || 0);

/** Deja solo dígitos: imposible escribir negativos, letras, "e", "-" o "Infinity". */
export const soloEnteros = (v, max = 9) => String(v).replace(/\D/g, '').slice(0, max);

/** Monto: solo dígitos y un punto/coma con hasta 2 decimales. */
export function soloDinero(v) {
  let s = String(v).replace(',', '.').replace(/[^\d.]/g, '');
  const i = s.indexOf('.');
  let ent = i >= 0 ? s.slice(0, i) : s;
  const dec = i >= 0 ? s.slice(i + 1).replace(/\./g, '').slice(0, 2) : null;
  ent = ent.slice(0, 9).replace(/^0+(?=\d)/, '');
  return dec === null ? ent : `${ent || '0'}.${dec}`;
}
export const aCentavos = (s) => (s === '' || s === '.' ? 0 : Math.round(parseFloat(s) * 100));
export const fechaCorta = (f) => (f ? f.slice(8, 10) + '/' + f.slice(5, 7) + ' ' + f.slice(11, 16) : '—');
