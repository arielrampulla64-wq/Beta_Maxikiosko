import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { pesos } from '../utils.js';

export function Aviso({ tipo = 'danger', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${tipo} d-flex justify-content-between align-items-start`} role="alert">
      <div>{children}</div>
      {onClose && <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} />}
    </div>
  );
}

export function Modal({ titulo, onClose, children, pie }) {
  return (
    <div className="modal d-block modal-backdrop-custom" role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{titulo}</h5>
            <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} />
          </div>
          <div className="modal-body">{children}</div>
          {pie && <div className="modal-footer">{pie}</div>}
        </div>
      </div>
    </div>
  );
}

export function Tarjeta({ titulo, valor, sub, color = 'primary' }) {
  return (
    <div className="col-6 col-lg-3">
      <div className={`card border-${color} h-100`}>
        <div className="card-body">
          <div className="text-muted small">{titulo}</div>
          <div className={`fs-4 fw-bold text-${color}`}>{valor}</div>
          {sub && <div className="small text-muted">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/** Carga el resumen del inicio (estado de caja, stock bajo y, según rol, ventas del día). */
export function useDashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/dashboard').then(setD).catch((e) => setError(e.message)); }, []);
  return { d, error };
}

export function StockBajo({ d }) {
  return (
    <div className="card h-100">
      <div className="card-header fw-bold">⚠️ Stock bajo ({d.totalStockBajo})</div>
      <ul className="list-group list-group-flush">
        {d.stockBajo.length === 0 && <li className="list-group-item text-muted">Todo el stock está por encima del mínimo.</li>}
        {d.stockBajo.map((p) => (
          <li key={p.id} className="list-group-item d-flex justify-content-between">
            <span>{p.nombre}</span>
            <span className={p.stock === 0 ? 'text-danger fw-bold' : 'text-warning fw-bold'}>{p.stock} / mín {p.minimo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EstadoCaja({ caja }) {
  return (
    <div className="card h-100">
      <div className="card-header fw-bold">💰 Caja</div>
      <div className="card-body">
        {!caja ? (
          <span className="badge bg-secondary fs-6">Cerrada</span>
        ) : (
          <>
            <span className="badge bg-success fs-6">Abierta</span>
            <div className="mt-2 small">Responsable: <b>{caja.responsable}</b></div>
            <div className="small">Desde: {caja.fechaApertura}</div>
            <div className="small">Ventas: <b>{caja.ventas.cantidad}</b> por <b>{pesos(caja.ventas.total)}</b></div>
          </>
        )}
      </div>
    </div>
  );
}
