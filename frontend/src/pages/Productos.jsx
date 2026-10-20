import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Aviso, Modal } from '../components/Comunes.jsx';
import { pesos, soloEnteros, soloDinero, fechaCorta } from '../utils.js';

const VACIO = { codigo: '', nombre: '', stockActual: '', stockMinimo: '', precio: '' };

// permisos: { crear, editar, baja, historial } -> cada rol recibe solo lo que puede hacer.
export default function Productos({ permisos }) {
  const [lista, setLista] = useState([]);
  const [q, setQ] = useState('');
  const [inactivos, setInactivos] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState(null); // { id?, datos }
  const [errForm, setErrForm] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [hist, setHist] = useState(null);
  const puedeVerInactivos = permisos.editar || permisos.baja;
  const hayAcciones = permisos.editar || permisos.baja || permisos.historial;

  const cargar = useCallback(async () => {
    try {
      const r = await api(`/productos?q=${encodeURIComponent(q)}${inactivos ? '&inactivos=1' : ''}`);
      setLista(r.productos);
      setError('');
    } catch (e) { setError(e.message); }
  }, [q, inactivos]);

  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar]);

  function abrirForm(p) {
    setErrForm('');
    setForm(p
      ? { id: p.id, datos: { codigo: p.codigo, nombre: p.nombre, stockActual: String(p.stockActual), stockMinimo: String(p.stockMinimo), precio: String(p.precio) } }
      : { datos: { ...VACIO } });
  }
  const setCampo = (k, fn) => (e) => setForm({ ...form, datos: { ...form.datos, [k]: fn ? fn(e.target.value) : e.target.value } });

  async function guardar(e) {
    e.preventDefault();
    if (guardando) return;
    const d = form.datos;
    if (!/^[A-Za-z0-9._-]{1,30}$/.test(d.codigo.trim())) return setErrForm('Código inválido: usá letras, números, punto o guion (máx. 30)');
    if (!d.nombre.trim() || d.nombre.trim().length > 30) return setErrForm('El nombre es obligatorio (máx. 30 caracteres)');
    if (d.stockActual === '') return setErrForm('Ingresá el stock actual');
    if (d.stockMinimo === '' || Number(d.stockMinimo) < 1) return setErrForm('El stock mínimo debe ser al menos 1');
    if (d.precio === '' || Number(d.precio) <= 0) return setErrForm('El precio debe ser mayor a 0');
    setGuardando(true);
    setErrForm('');
    try {
      const body = { codigo: d.codigo.trim(), nombre: d.nombre.trim(), stockActual: Number(d.stockActual), stockMinimo: Number(d.stockMinimo), precio: d.precio };
      const r = form.id ? await api(`/productos/${form.id}`, { method: 'PUT', body }) : await api('/productos', { method: 'POST', body });
      setOk(r.mensaje);
      setForm(null);
      cargar();
    } catch (err) { setErrForm(err.message); } finally { setGuardando(false); }
  }

  async function cambiarEstado(p) {
    if (!window.confirm(p.activo ? `¿Dar de baja "${p.nombre}"? Dejará de aparecer en ventas.` : `¿Reactivar "${p.nombre}"?`)) return;
    try {
      const r = await api(`/productos/${p.id}/estado`, { method: 'PATCH', body: { activo: !p.activo } });
      setOk(r.mensaje);
      cargar();
    } catch (e) { setError(e.message); }
  }

  async function verHistorial(p) {
    try {
      const r = await api(`/productos/${p.id}/historial-precios`);
      setHist({ producto: p, filas: r.historial });
    } catch (e) { setError(e.message); }
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h4 className="mb-0">📦 Productos {!hayAcciones && <small className="text-muted fs-6">(solo consulta)</small>}</h4>
        {permisos.crear && <button className="btn btn-primary" onClick={() => abrirForm(null)}>+ Nuevo producto</button>}
      </div>
      <Aviso onClose={() => setError('')}>{error}</Aviso>
      <Aviso tipo="success" onClose={() => setOk('')}>{ok}</Aviso>
      <div className="row g-2 mb-3">
        <div className="col-md-6">
          <input className="form-control" placeholder="Buscar por nombre o código…" value={q} onChange={(e) => setQ(e.target.value.slice(0, 50))} />
        </div>
        {puedeVerInactivos && (
          <div className="col-md-6 d-flex align-items-center">
            <div className="form-check">
              <input id="inact" type="checkbox" className="form-check-input" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} />
              <label htmlFor="inact" className="form-check-label">Mostrar productos dados de baja</label>
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <div className="table-responsive tabla-scroll">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light"><tr>
              <th>Código</th><th>Nombre</th><th className="text-end">Precio</th><th className="text-end">Stock</th><th className="text-end">Mínimo</th><th>Estado</th>{hayAcciones && <th className="text-end">Acciones</th>}
            </tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-4">No hay productos para mostrar</td></tr>}
              {lista.map((p) => (
                <tr key={p.id} className={p.activo ? '' : 'table-secondary'}>
                  <td>{p.codigo}</td><td>{p.nombre}</td>
                  <td className="text-end">{pesos(p.precio)}</td>
                  <td className={`text-end fw-bold ${p.stockActual === 0 ? 'text-danger' : p.bajoStock ? 'text-warning' : ''}`}>{p.stockActual}</td>
                  <td className="text-end">{p.stockMinimo}</td>
                  <td>{p.activo ? (p.bajoStock ? <span className="badge bg-warning text-dark">Stock bajo</span> : <span className="badge bg-success">Activo</span>) : <span className="badge bg-secondary">De baja</span>}</td>
                  {hayAcciones && (
                    <td className="text-end text-nowrap">
                      {permisos.editar && <button className="btn btn-sm btn-outline-primary me-1" onClick={() => abrirForm(p)}>Editar</button>}
                      {permisos.historial && <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => verHistorial(p)}>Precios</button>}
                      {permisos.baja && <button className={`btn btn-sm ${p.activo ? 'btn-outline-danger' : 'btn-outline-success'}`} onClick={() => cambiarEstado(p)}>{p.activo ? 'Dar de baja' : 'Reactivar'}</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal titulo={form.id ? 'Editar producto' : 'Nuevo producto'} onClose={() => setForm(null)}>
          <Aviso onClose={() => setErrForm('')}>{errForm}</Aviso>
          <form onSubmit={guardar} noValidate>
            <div className="row g-3">
              <div className="col-5"><label className="form-label">Código</label><input className="form-control" maxLength={30} value={form.datos.codigo} onChange={setCampo('codigo')} /></div>
              <div className="col-7"><label className="form-label">Nombre</label><input className="form-control" maxLength={30} value={form.datos.nombre} onChange={setCampo('nombre')} /></div>
              <div className="col-4"><label className="form-label">Stock actual</label><input className="form-control" inputMode="numeric" value={form.datos.stockActual} onChange={setCampo('stockActual', (v) => soloEnteros(v, 7))} /></div>
              <div className="col-4"><label className="form-label">Stock mínimo</label><input className="form-control" inputMode="numeric" value={form.datos.stockMinimo} onChange={setCampo('stockMinimo', (v) => soloEnteros(v, 7))} /></div>
              <div className="col-4"><label className="form-label">Precio ($)</label><input className="form-control" inputMode="decimal" value={form.datos.precio} onChange={setCampo('precio', soloDinero)} /></div>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {hist && (
        <Modal titulo={`Historial de precios — ${hist.producto.nombre}`} onClose={() => setHist(null)}>
          <table className="table table-sm">
            <thead><tr><th>Fecha</th><th>Anterior</th><th>Nuevo</th><th>Usuario</th></tr></thead>
            <tbody>
              {hist.filas.map((h, i) => (
                <tr key={i}><td>{fechaCorta(h.fecha)}</td><td>{h.anterior === null ? '—' : pesos(h.anterior)}</td><td>{pesos(h.nuevo)}</td><td>{h.usuario}</td></tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}
