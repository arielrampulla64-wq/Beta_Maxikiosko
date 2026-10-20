import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Aviso, Modal } from '../components/Comunes.jsx';
import { pesos, soloDinero, fechaCorta } from '../utils.js';

// permisos: { abrir, cerrar, historial }
export default function Caja({ permisos }) {
  const [caja, setCaja] = useState(undefined); // undefined = cargando, null = cerrada
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [alerta, setAlerta] = useState('');
  const [monto, setMonto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cierre, setCierre] = useState(null); // { contado, obs, error }
  const [resultado, setResultado] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setCaja((await api('/caja/actual')).caja);
      if (permisos.historial) setHistorial((await api('/caja/historial')).historial);
    } catch (e) { setError(e.message); }
  }, [permisos.historial]);
  useEffect(() => { cargar(); }, [cargar]);

  async function abrir(e) {
    e.preventDefault();
    if (enviando) return;
    setError(''); setOk(''); setAlerta('');
    if (monto === '' || monto === '.') return setError('Ingresá el monto inicial contado (puede ser 0)');
    setEnviando(true);
    try {
      const r = await api('/caja/apertura', { method: 'POST', body: { saldoInicial: monto } });
      setOk(r.mensaje); setAlerta(r.alerta || ''); setMonto('');
      await cargar();
    } catch (err) { setError(err.message); } finally { setEnviando(false); }
  }

  async function cerrar(e) {
    e.preventDefault();
    if (enviando) return;
    if (cierre.contado === '' || cierre.contado === '.') return setCierre({ ...cierre, error: 'Ingresá el efectivo contado (puede ser 0)' });
    setEnviando(true);
    try {
      const r = await api('/caja/cierre', { method: 'POST', body: { efectivoContado: cierre.contado, observaciones: cierre.obs } });
      setResultado(r); setCierre(null); setOk(r.mensaje);
      await cargar();
    } catch (err) { setCierre({ ...cierre, error: err.message }); } finally { setEnviando(false); }
  }

  return (
    <>
      <h4 className="mb-3">💰 Caja</h4>
      <Aviso onClose={() => setError('')}>{error}</Aviso>
      <Aviso tipo="success" onClose={() => setOk('')}>{ok}</Aviso>
      {alerta && <Aviso tipo="warning" onClose={() => setAlerta('')}>⚠️ {alerta}</Aviso>}
      {caja === undefined && <p>Cargando…</p>}

      {caja === null && (
        <div className="card mb-4"><div className="card-body">
          <span className="badge bg-secondary fs-6 mb-3">Caja cerrada</span>
          {permisos.abrir ? (
            <form onSubmit={abrir} noValidate className="row g-2 align-items-end">
              <div className="col-md-5">
                <label className="form-label">Efectivo inicial contado ($)</label>
                <input className="form-control" inputMode="decimal" placeholder="0.00" value={monto} onChange={(e) => setMonto(soloDinero(e.target.value))} />
              </div>
              <div className="col-md-3"><button className="btn btn-success w-100" disabled={enviando}>{enviando ? 'Abriendo…' : 'Abrir caja'}</button></div>
            </form>
          ) : <p className="mb-0 text-muted">La caja está cerrada. Un encargado o dueño debe abrirla para poder vender.</p>}
        </div></div>
      )}

      {caja && (
        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span><span className="badge bg-success me-2">Abierta</span>Caja #{caja.idCaja} · {caja.responsable} · desde {fechaCorta(caja.fechaApertura)}</span>
            {permisos.cerrar && <button className="btn btn-sm btn-danger" onClick={() => setCierre({ contado: '', obs: '', error: '' })}>Cerrar caja</button>}
          </div>
          <div className="card-body">
            <div className="row g-3 mb-3">
              <div className="col-6 col-md-3"><div className="text-muted small">Saldo inicial</div><div className="fs-5">{pesos(caja.saldoInicial)}</div></div>
              <div className="col-6 col-md-3"><div className="text-muted small">Ingresos</div><div className="fs-5 text-success">{pesos(caja.ingresos)}</div></div>
              <div className="col-6 col-md-3"><div className="text-muted small">Egresos</div><div className="fs-5 text-danger">{pesos(caja.egresos)}</div></div>
              <div className="col-6 col-md-3"><div className="text-muted small">Ventas ({caja.ventas.cantidad})</div><div className="fs-5">{pesos(caja.ventas.total)}</div></div>
            </div>
            <table className="table table-sm w-auto">
              <thead><tr><th>Medio de pago</th><th className="text-end">Ingresos</th><th className="text-end">Egresos</th></tr></thead>
              <tbody>
                {caja.porMetodo.length === 0 && <tr><td colSpan={3} className="text-muted">Sin movimientos todavía</td></tr>}
                {caja.porMetodo.map((m) => <tr key={m.metodo}><td>{m.metodo}</td><td className="text-end">{pesos(m.ingresos)}</td><td className="text-end">{pesos(m.egresos)}</td></tr>)}
              </tbody>
            </table>
            {permisos.cerrar && <div className="alert alert-info mb-0">Efectivo que debería haber en el cajón: <b>{pesos(caja.efectivoEsperado)}</b></div>}
          </div>
        </div>
      )}

      {resultado && (
        <Aviso tipo={resultado.caja.cierre.diferencia === 0 ? 'success' : 'warning'} onClose={() => setResultado(null)}>
          <b>Cierre de caja #{resultado.caja.idCaja}</b> — Esperado: {pesos(resultado.caja.cierre.esperado)} · Contado: {pesos(resultado.caja.cierre.contado)} ·
          Diferencia: <b>{pesos(resultado.caja.cierre.diferencia)}</b>
        </Aviso>
      )}

      {permisos.historial && (
        <div className="card">
          <div className="card-header fw-bold">Historial de cajas</div>
          <div className="table-responsive tabla-scroll">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead className="table-light"><tr><th>#</th><th>Responsable</th><th>Apertura</th><th>Cierre</th><th className="text-end">Inicial</th><th className="text-end">Esperado</th><th className="text-end">Contado</th><th className="text-end">Diferencia</th></tr></thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id}>
                    <td>{h.id}</td><td>{h.responsable}</td><td>{fechaCorta(h.apertura)}</td>
                    <td>{h.estado === 'Abierta' ? <span className="badge bg-success">Abierta</span> : fechaCorta(h.cierre)}</td>
                    <td className="text-end">{pesos(h.inicial)}</td>
                    <td className="text-end">{h.esperado === null ? '—' : pesos(h.esperado)}</td>
                    <td className="text-end">{h.contado === null ? '—' : pesos(h.contado)}</td>
                    <td className={`text-end fw-bold ${h.diferencia ? 'text-danger' : ''}`}>{h.diferencia === null ? '—' : pesos(h.diferencia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cierre && (
        <Modal titulo="Cerrar caja" onClose={() => setCierre(null)}>
          <Aviso>{cierre.error}</Aviso>
          <form onSubmit={cerrar} noValidate>
            <p className="text-muted small">Contá el efectivo físico del cajón e ingresalo. El sistema calculará la diferencia.</p>
            <label className="form-label">Efectivo contado ($)</label>
            <input className="form-control mb-3" inputMode="decimal" autoFocus value={cierre.contado} onChange={(e) => setCierre({ ...cierre, contado: soloDinero(e.target.value) })} />
            <label className="form-label">Observaciones (opcional)</label>
            <input className="form-control" maxLength={200} value={cierre.obs} onChange={(e) => setCierre({ ...cierre, obs: e.target.value })} />
            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" className="btn btn-secondary" onClick={() => setCierre(null)}>Cancelar</button>
              <button className="btn btn-danger" disabled={enviando}>{enviando ? 'Cerrando…' : 'Confirmar cierre'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
