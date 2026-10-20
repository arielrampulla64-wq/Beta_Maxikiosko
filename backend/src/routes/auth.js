import { db } from '../db.js';
import { hashPassword, verifyPassword, signToken } from '../security.js';
import { HttpError, bad, texto } from '../util.js';

const FALLOS_MAX = 5;
const BLOQUEO_MS = 10 * 60 * 1000;
const intentos = new Map(); // "usuario|ip" -> { count, hasta }
const HASH_FALSO = hashPassword('falso-para-igualar-tiempos');

export function usuarioPublico(u) {
  return { id: u.ID_Usuario, usuario: u.Nombre_Usuario, nombre: `${u.Nombre} ${u.Apellido}`, rol: u.Rol, debeCambiar: u.Debe_Cambiar_Contrasena === 1 };
}
export const SQL_USUARIO = `SELECT u.ID_Usuario, u.Nombre_Usuario, u.Contrasena, u.Estado, u.Debe_Cambiar_Contrasena,
  r.Nombre AS Rol, e.Nombre, e.Apellido
  FROM usuarios u JOIN roles r ON r.ID_Rol = u.ID_Rol JOIN empleados e ON e.ID_Empleado = u.ID_Empleado`;

export function registrarAuth(r) {
  r.add('POST', '/api/auth/login', ({ body, ip }) => {
    const usuario = texto(body.usuario, 'Usuario', { max: 50 });
    const pass = body.contrasena;
    if (typeof pass !== 'string' || !pass || pass.length > 200) throw bad('Ingresá tu contraseña');

    const key = `${usuario.toLowerCase()}|${ip}`;
    const reg = intentos.get(key);
    if (reg?.hasta > Date.now()) throw new HttpError(429, 'Demasiados intentos fallidos. Esperá 10 minutos e intentá de nuevo.');

    const u = db.prepare(`${SQL_USUARIO} WHERE u.Nombre_Usuario = ? COLLATE NOCASE`).get(usuario);
    const ok = verifyPassword(pass, u ? u.Contrasena : HASH_FALSO);
    if (!u || !ok || u.Estado !== 1) {
      const count = (reg?.hasta && reg.hasta <= Date.now() ? 0 : reg?.count || 0) + 1;
      intentos.set(key, count >= FALLOS_MAX ? { count: 0, hasta: Date.now() + BLOQUEO_MS } : { count, hasta: 0 });
      throw new HttpError(401, 'Usuario o contraseña incorrectos');
    }
    intentos.delete(key);
    return { token: signToken({ uid: u.ID_Usuario }), usuario: usuarioPublico(u) };
  }, { public: true });

  r.add('GET', '/api/auth/me', ({ user }) => ({ usuario: usuarioPublico(user) }));

  r.add('POST', '/api/auth/cambiar-contrasena', ({ body, user }) => {
    const { actual, nueva } = body;
    if (typeof actual !== 'string' || !actual) throw bad('Ingresá tu contraseña actual');
    if (typeof nueva !== 'string') throw bad('Ingresá la nueva contraseña');
    if (nueva.length < 8 || nueva.length > 64) throw bad('La nueva contraseña debe tener entre 8 y 64 caracteres');
    if (!/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) throw bad('La nueva contraseña debe tener al menos una letra y un número');
    if (nueva.toLowerCase().includes(user.Nombre_Usuario.toLowerCase())) throw bad('La contraseña no puede contener tu nombre de usuario');

    const fila = db.prepare('SELECT Contrasena FROM usuarios WHERE ID_Usuario = ?').get(user.ID_Usuario);
    if (!verifyPassword(actual, fila.Contrasena)) throw new HttpError(400, 'La contraseña actual es incorrecta');
    if (nueva === actual) throw bad('La nueva contraseña debe ser distinta a la actual');

    db.prepare('UPDATE usuarios SET Contrasena = ?, Debe_Cambiar_Contrasena = 0 WHERE ID_Usuario = ?')
      .run(hashPassword(nueva), user.ID_Usuario);
    return { ok: true, mensaje: 'Contraseña actualizada correctamente' };
  });
}
