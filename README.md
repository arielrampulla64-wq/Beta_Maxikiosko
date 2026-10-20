# Maxikiosco Apolo — Sistema de gestión

Backend: **Node.js + SQLite** (sin librerías externas) · Frontend: **React + Bootstrap (Vite)**

## Requisitos
- **Node.js 22.13 o superior** (`node -v`). Trae SQLite incorporado, por eso el backend no necesita `npm install`.

## Cómo ejecutarlo (2 terminales)

**Terminal 1 – Backend**
```
cd backend
npm start
```
Queda en http://localhost:3001. La primera vez ajusta la base automáticamente (ver "Cambios a la base").

**Terminal 2 – Frontend**
```
cd frontend
npm install
npm run dev
```
Abrir http://localhost:5173

> Alternativa a una sola terminal: `cd frontend && npm run build`, y luego `cd backend && npm start`
> → todo queda en http://localhost:3001.

## Usuarios de prueba
Contraseña inicial de todos: **Apolo2026!** (el sistema obliga a cambiarla en el primer ingreso)

| Usuario | Rol |
|---|---|
| arampulla | Administrador (dueño) |
| eapaza, jpereyra | Encargado |
| vargote, ffernandez | Empleado |

## Qué puede hacer cada rol (cada uno tiene su propia pantalla)
| Función | Administrador | Encargado | Empleado |
|---|:-:|:-:|:-:|
| Login / cambiar contraseña | ✅ | ✅ | ✅ |
| Ver productos | ✅ (incl. dados de baja) | ✅ (incl. dados de baja) | ✅ solo activos, sin editar |
| Crear / editar productos y precios | ✅ | ✅ | ❌ |
| Dar de baja / reactivar productos | ✅ | ❌ | ❌ |
| Historial de precios | ✅ | ✅ | ❌ |
| Abrir / cerrar caja, historial de cajas | ✅ | ✅ | ❌ (solo ve el estado) |
| Registrar ventas | ✅ | ✅ | ✅ |

Los permisos se validan **en el backend** (no solo se ocultan botones): si alguien intenta llamar a la API sin permiso recibe 403.

## Procesos del PDF implementados
- **Proceso 1 – Apertura de caja** (alerta si el monto difiere del cierre anterior)
- **Proceso 2 – Cierre de caja** (efectivo esperado vs. contado, diferencia guardada)
- **Proceso 4 – Registro de productos** (alta, edición, baja, no duplicados, historial de precios)
- **Proceso 5 – Gestión de ventas** (stock automático, pagos mixtos, total calculado por el servidor)

## Validaciones
Imposible ingresar negativos, letras, `e`, `Infinity`, NaN ni más de 2 decimales (el formulario ni siquiera los deja escribir),
y además el servidor los rechaza si alguien los manda directamente. Cantidades máx. 9999 y nunca más que el stock.

## Cambios a la base de datos (se aplican solos, una sola vez)
1. `productos.Stock_Actual` ahora permite **0** (antes `>= 1` impedía vender la última unidad).
2. Contraseñas: los hashes de ejemplo se reemplazan por contraseñas reales cifradas (scrypt).
3. Columnas nuevas: `usuarios.Debe_Cambiar_Contrasena`, `ventas.ID_Usuario` (quién vendió).
4. Tablas nuevas: `historial_precios` y `cierres_caja` (diferencias de cierre).

> Nota: la base original trae la **caja #2 abierta** desde el 05/10. Hay que cerrarla (con Encargado/Administrador) antes de abrir una nueva.

## Pruebas automáticas del backend
```
cd backend
npm test
```
Usan una copia temporal de la base: no tocan tus datos.

## Estructura
```
backend/
  data/maxikiosco_apolo.sqlite   <- la base (todos los cambios se guardan acá)
  src/server.js                  <- servidor + autenticación + permisos por rol
  src/db.js                      <- conexión y migración
  src/routes/                    <- auth, productos, caja, ventas, dashboard
  test/api.test.js
frontend/src/
  roles/Admin.jsx Encargado.jsx Empleado.jsx   <- una pantalla por rol
  pages/   Login, CambiarPassword, Productos, Caja, Ventas
```
