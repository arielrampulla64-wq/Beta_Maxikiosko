// Todas las llamadas al backend pasan por acá.
export async function api(ruta, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  let res;
  try {
    res = await fetch('/api' + ruta, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verificá que el backend esté en ejecución.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* respuesta sin JSON */ }
  if (res.status === 401 && token) {
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('auth:logout'));
  }
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}
