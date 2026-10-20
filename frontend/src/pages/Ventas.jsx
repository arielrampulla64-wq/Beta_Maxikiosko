import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Aviso } from '../components/Comunes.jsx';
import { pesos, soloEnteros, soloDinero, aCentavos, fechaCorta } from '../utils.js';

export default function Ventas() {
  const [productos, setProductos] = useState([]);
  const [q, setQ] = useState('');
  const [metodos, setMetodos] = useState([]);
  const [caja, setCaja] = useState(undefined);
  const [recientes, setRecientes] = useState([]);
  const [carrito, setCarrito] = useState([]); // { id, nombre, precio, stock, cantidad }
  const [pagos, setPagos] = useState([{ metodo: '', monto: '' }]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargarProductos = useCallback(async () => {
    try { setProductos((await api(`/productos?q=${encodeURIComponent(q)}`)).productos); } catch (e) { setError(e.message); }
  }, [q]);
  const cargarEstado = useCallback(async () => {
    try {
      setCaja((await api('/caja/actual')).caja);
      setRecientes((await api('/ventas')).ventas);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { const t = setTimeout(cargarProductos, 250); return () => clearTimeout(t); }, [cargarProductos]);
  useEffect(() => { cargarEstado(); api('/metodos-pago').then((r) => { setMetodos(r.metodos); setPagos([{ metodo: String(r.metodos[0]?.id || ''), monto: '' }]); }).catch((e) => setError(e.message)); }, [cargarEstado]);

  const totalC = carrito.reduce((a, l) => a + Math.round(l.precio * 100) * l.cantidad, 0);
  const pagosC = pagos.length === 1 ? [totalC] : pagos.map((p) => aCentavos(p.monto));
  const sumaPagosC = pagosC.reduce((a, b) => a + b, 0);
  const pagosOk = totalC > 0 && sumaPagosC === totalC && pagosC.every((c) => c > 0) && pagos.every((p) => p.metodo);
  const puedeVender = caja && carrito.length > 0 && pagosOk && !enviando;

  function agregar(p) {
    setOk('');
    setCarrito((c) => {
      const ex = c.find((l) => l.id === p.id);
      if (ex) return c.map((l) => (l.id === p.id ? { ...l, cantidad: Math.min(l.cantidad + 1, p.stockActual) } : l));
      return [...c, { id: p.id, nombre: p.nombre, precio: p.precio, stock: p.stockActual, cantidad: 1 }];
    });
  }
  const cambiarCantidad = (id, v) => setCarrito((c) => c.map((l) => (l.id === id ? { ...l, cantidad: Math.min(Number(soloEnteros(v, 4)) || 0, l.stock) } : l)));
  const normalizarCantidad = (id) => setCarrito((c) => c.map((l) => (l.id === id && l.cantidad < 1 ? { ...l, cantidad: 1 } : l)));
  const quitar = (id) => setCarrito((c) => c.filter((l) => l.id !== id));
  const setPago = (i, k, v) => setPagos((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  async function confirmar() {
    if (!puedeVender) return;
    setEnviando(true); setError(''); setOk('');
    try {
      const body = {
        items: carrito.map((l) => ({ idProducto: l.id, cantidad: l.cantidad })),
        pagos: pagos.map((p, i) => ({ idMetodoPago: Number(p.metodo), monto: (pagosC[i] / 100).toFixed(2) })),
      };
      const r = await api('/ventas', { method: 'POST', body });
      setOk(r.mensaje);
      setCarrito([]);
      setPagos([{ metodo: String(metodos[0]?.id || ''), monto: '' }]);
      await Promise.all([cargarProductos(), cargarEstado()]);
    } catch (e) {
      setError(e.message);
      cargarProductos(); cargarEstado(); // refresca stock por si cambió
    } finally { setEnviando(false); }
  }

  return (
    <>
      <h4 className="mb-3">🛒 Nueva venta</h4>
      <Aviso onClose={() => setError('')}>{error}</Aviso>
      <Aviso tipo="success" onClose={() => setOk('')}>{ok}</Aviso>
      {caja === null && <Aviso tipo="warning">La caja está cerrada: no se pueden registrar ventas. Pedile a un encargado o dueño que la abra.</Aviso>}

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">
              <input className="form-control" placeholder="Buscar producto por nombre o código…" value={q} onChange={(e) => setQ(e.target.value.slice(0, 50))} />
            </div>
            <div className="list-group list-group-flush tabla-scroll">
              {productos.length === 0 && <div className="list-group-item text-muted">Sin resultados</div>}
              {productos.map((p) => (
                <button key={p.id} type="button" className="list-group-item list-group-item-action producto-item d-flex justify-content-between align-items-center"
                  disabled={p.stockActual < 1 || !caja} onClick={() => agregar(p)}>
                  <span>{p.nombre} <small className="text-muted">({p.codigo})</small><br /><small className={p.stockActual === 0 ? 'text-danger' : 'text-muted'}>{p.stockActual === 0 ? 'Sin stock' : `Stock: ${p.stockActual}`}</small></span>
                  <span className="fw-bold">{pesos(p.precio)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card mb-3">
            <div className="card-header fw-bold">Detalle de la venta</div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <tbody>
                  {carrito.length === 0 && <tr><td className="text-muted p-3">Tocá un producto para agregarlo.</td></tr>}
                  {carrito.map((l) => (
                    <tr key={l.id}>
                      <td>{l.nombre}<br /><small className="text-muted">{pesos(l.precio)} c/u · máx {l.stock}</small></td>
                      <td style={{ width: 90 }}>
                        <input className="form-control form-control-sm text-center" inputMode="numeric" aria-label={`Cantidad de ${l.nombre}`}
                          value={l.cantidad === 0 ? '' : l.cantidad} onChange={(e) => cambiarCantidad(l.id, e.target.value)} onBlur={() => normalizarCantidad(l.id)} />
                      </td>
                      <td className="text-end fw-bold">{pesos(l.precio * l.cantidad)}</td>
                      <td style={{ width: 40 }}><button className="btn btn-sm btn-outline-danger" aria-label={`Quitar ${l.nombre}`} onClick={() => quitar(l.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-footer d-flex justify-content-between fs-5"><span>Total</span><b id="total-venta">{pesos(totalC / 100)}</b></div>
          </div>

          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between"><span className="fw-bold">Medio de pago</span>
              {pagos.length < 5 && <button className="btn btn-sm btn-outline-secondary" onClick={() => setPagos([...pagos, { metodo: String(metodos[0]?.id || ''), monto: '' }])}>+ Dividir pago</button>}
            </div>
            <div className="card-body">
              {pagos.map((p, i) => (
                <div className="row g-2 mb-2" key={i}>
                  <div className="col-6">
                    <select className="form-select" aria-label="Medio de pago" value={p.metodo} onChange={(e) => setPago(i, 'metodo', e.target.value)}>
                      {metodos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-4">
                    <input className="form-control" inputMode="decimal" aria-label="Monto del pago" disabled={pagos.length === 1} placeholder="0.00"
                      value={pagos.length === 1 ? (totalC / 100).toFixed(2) : p.monto} onChange={(e) => setPago(i, 'monto', soloDinero(e.target.value))} />
                  </div>
                  <div className="col-2">{pagos.length > 1 && <button className="btn btn-outline-danger w-100" onClick={() => setPagos(pagos.filter((_, j) => j !== i))}>✕</button>}</div>
                </div>
              ))}
              {pagos.length > 1 && totalC > 0 && sumaPagosC !== totalC && (
                <div className="text-danger small">{sumaPagosC < totalC ? `Faltan ${pesos((totalC - sumaPagosC) / 100)}` : `Sobran ${pesos((sumaPagosC - totalC) / 100)}`}</div>
              )}
            </div>
          </div>
          <button className="btn btn-success btn-lg w-100" disabled={!puedeVender} onClick={confirmar}>{enviando ? 'Registrando…' : 'Confirmar venta'}</button>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header fw-bold">Últimas ventas</div>
        <div className="table-responsive tabla-scroll">
          <table className="table table-sm mb-0">
            <thead className="table-light"><tr><th>#</th><th>Fecha</th><th>Vendedor</th><th>Detalle</th><th>Pago</th><th className="text-end">Total</th></tr></thead>
            <tbody>
              {recientes.length === 0 && <tr><td colSpan={6} className="text-muted text-center py-3">Todavía no hay ventas</td></tr>}
              {recientes.map((v) => <tr key={v.id}><td>{v.id}</td><td>{fechaCorta(v.fecha)}</td><td>{v.vendedor}</td><td>{v.detalle}</td><td>{v.pagos}</td><td className="text-end">{pesos(v.total)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
