import { useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import api, { API_URL } from '../api';
import logoMap from '../assets/Logo.png';
import 'leaflet/dist/leaflet.css';

const roleConfig = {
  2: { label: 'Operador', title: 'Centro de operaciones' },
  3: { label: 'Administrador', title: 'Control municipal' },
  4: { label: 'Supervisor', title: 'Supervision y calidad' },
};

const DashboardGestion = () => {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const role = Number(usuario.rol);
  const config = roleConfig[role] || roleConfig[2];
  const [view, setView] = useState('resumen');
  const [summary, setSummary] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [catalogs, setCatalogs] = useState({ categorias: [], estados: [], prioridades: [], zonas: [] });
  const [crews, setCrews] = useState({ cuadrillas: [], operadores: [] });
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({ buscar: '', estado: '', categoria: '', prioridad: '' });
  const [loading, setLoading] = useState(true);
  const [evidence, setEvidence] = useState(null);
  const [route, setRoute] = useState([]);

  const handleError = (error, fallback = 'No se pudo completar la accion') => {
    if (error.response?.status === 401) {
      localStorage.clear(); navigate('/auth'); return;
    }
    Swal.fire('Error', error.response?.data?.error || fallback, 'error');
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [api.get('/gestion/resumen'), api.get('/gestion/incidencias'), api.get('/incidencias/catalogos'), api.get('/gestion/cuadrillas')];
      if (role === 3) requests.push(api.get('/gestion/usuarios'));
      const [summaryRes, incidentsRes, catalogsRes, crewsRes, usersRes] = await Promise.all(requests);
      setSummary(summaryRes.data); setIncidents(incidentsRes.data); setCatalogs(catalogsRes.data); setCrews(crewsRes.data);
      if (usersRes) setUsers(usersRes.data);
    } catch (error) { handleError(error, 'No se pudo cargar el panel'); }
    finally { setLoading(false); }
  }, [role]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadDetail = async (incident) => {
    setSelected(incident);
    try { const { data } = await api.get(`/incidencias/${incident.id_incidencia}/detalle`); setDetail(data); }
    catch (error) { handleError(error, 'No se pudo abrir el detalle'); }
  };

  const filtered = useMemo(() => incidents.filter((item) => {
    const text = `${item.codigo || ''} ${item.descripcion} ${item.ciudadano}`.toLowerCase();
    return (!filters.buscar || text.includes(filters.buscar.toLowerCase()))
      && (!filters.estado || String(item.id_estado) === filters.estado)
      && (!filters.categoria || String(item.id_categoria) === filters.categoria)
      && (!filters.prioridad || String(item.id_prioridad) === filters.prioridad);
  }), [incidents, filters]);

  const assignIncident = async () => {
    const operatorOptions = Object.fromEntries(crews.operadores.map((o) => [o.id_usuario, o.nombre_completo]));
    const { value: operatorId } = await Swal.fire({ title: 'Asignar operador', input: 'select', inputOptions: operatorOptions, inputPlaceholder: 'Selecciona un operador', showCancelButton: true });
    if (!operatorId) return;
    try {
      await api.post(`/gestion/incidencias/${selected.id_incidencia}/asignar`, { id_operador: Number(operatorId), instrucciones: 'Atender segun prioridad y registrar evidencia final.' });
      Swal.fire('Asignada', 'La incidencia fue enviada al operador.', 'success'); await loadData(); await loadDetail(selected);
    } catch (error) { handleError(error); }
  };

  const changePriority = async () => {
    const options = Object.fromEntries(catalogs.prioridades.map((p) => [p.id_prioridad, p.nombre]));
    const { value } = await Swal.fire({ title: 'Cambiar prioridad', input: 'select', inputOptions: options, inputValue: selected.id_prioridad, showCancelButton: true });
    if (!value) return;
    try { await api.patch(`/gestion/incidencias/${selected.id_incidencia}/prioridad`, { id_prioridad: Number(value) }); await loadData(); await loadDetail({ ...selected, id_prioridad: Number(value) }); }
    catch (error) { handleError(error); }
  };

  const updateStatus = async (status) => {
    const form = new FormData(); form.append('id_estado', status); form.append('observacion', status === 2 ? 'Trabajo iniciado' : 'Trabajo concluido y enviado a revision');
    if (evidence) form.append('evidencia', evidence);
    try {
      await api.patch(`/gestion/incidencias/${selected.id_incidencia}/estado`, form);
      setEvidence(null); Swal.fire('Actualizado', status === 2 ? 'La tarea esta en proceso.' : 'Trabajo enviado a validacion.', 'success');
      await loadData(); await loadDetail(selected);
    } catch (error) { handleError(error); }
  };

  const calculateRoute = () => {
    if (!navigator.geolocation) return Swal.fire('No disponible', 'El navegador no permite geolocalizacion.', 'warning');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${coords.longitude},${coords.latitude};${selected.longitud},${selected.latitud}?overview=full&geometries=geojson`;
        const response = await fetch(url); const data = await response.json();
        if (!data.routes?.length) throw new Error('Sin ruta');
        setRoute(data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]));
        Swal.fire('Ruta calculada', `${(data.routes[0].distance / 1000).toFixed(1)} km estimados`, 'success');
      } catch { Swal.fire('Ruta no disponible', 'No se pudo calcular la ruta.', 'error'); }
    }, () => Swal.fire('Permiso requerido', 'Permite tu ubicacion para calcular la ruta.', 'info'), { enableHighAccuracy: true });
  };

  const editCategory = async (category) => {
    const { value } = await Swal.fire({ title: `Editar ${category.nombre}`, input: 'text', inputLabel: 'Area responsable', inputValue: category.area_responsable, showCancelButton: true });
    if (!value) return;
    try { await api.patch(`/gestion/categorias/${category.id_categoria}`, { area_responsable: value }); await loadData(); }
    catch (error) { handleError(error); }
  };

  const editSla = async (priority) => {
    const { value } = await Swal.fire({ title: `SLA ${priority.nombre}`, input: 'number', inputLabel: 'Horas maximas de resolucion', inputValue: priority.horas_resolucion, showCancelButton: true, inputAttributes: { min: 1 } });
    if (!value) return;
    try { await api.patch(`/gestion/prioridades/${priority.id_prioridad}`, { horas_resolucion: Number(value) }); await loadData(); }
    catch (error) { handleError(error); }
  };

  const validateWork = async (result) => {
    const { value: observations } = await Swal.fire({ title: result === 'aprobado' ? 'Aprobar trabajo' : 'Enviar observacion', input: 'textarea', inputLabel: 'Observaciones', showCancelButton: true, inputValidator: (v) => result !== 'aprobado' && !v ? 'Escribe una observacion' : undefined });
    if (observations === undefined) return;
    try { await api.post(`/gestion/incidencias/${selected.id_incidencia}/validar`, { resultado: result, observaciones: observations }); await loadData(); await loadDetail(selected); Swal.fire('Registrado', 'La validacion fue guardada.', 'success'); }
    catch (error) { handleError(error); }
  };

  const createUser = async (event) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); data.id_rol = Number(data.id_rol);
    try { await api.post('/gestion/usuarios', data); event.currentTarget.reset(); await loadData(); Swal.fire('Creado', 'La cuenta esta lista para iniciar sesion.', 'success'); }
    catch (error) { handleError(error); }
  };

  const toggleUser = async (user) => {
    try { await api.patch(`/gestion/usuarios/${user.id_usuario}`, { activo: !user.activo }); await loadData(); }
    catch (error) { handleError(error); }
  };

  const downloadPdf = async () => {
    try {
      const response = await api.get('/gestion/reportes/pdf', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `reporte-incidencias-${new Date().toISOString().slice(0, 10)}.pdf`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { handleError(error, 'No se pudo generar el PDF'); }
  };

  const logout = () => { localStorage.clear(); navigate('/auth'); };

  const navItems = [
    ['resumen', 'Resumen'], ['incidencias', role === 2 ? 'Mis tareas' : 'Incidencias'],
    ...(role === 3 ? [['usuarios', 'Usuarios'], ['cuadrillas', 'Cuadrillas'], ['configuracion', 'Configuracion']] : []),
    ...([3, 4].includes(role) ? [['reportes', 'Reportes']] : []),
  ];

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar">
        <div className="ops-brand"><img src={logoMap} alt="Llajta"/><div><strong>Llajta</strong><span>Inteligente</span></div></div>
        <div className="role-chip">{config.label}</div>
        <nav>{navItems.map(([key, label]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>)}</nav>
        <button className="logout-button" onClick={logout}>Cerrar sesion</button>
      </aside>

      <main className="ops-main">
        <header className="ops-header"><div><span>Municipio de Cochabamba</span><h1>{config.title}</h1></div><div className="user-pill"><b>{usuario.nombre}</b><small>{config.label}</small></div></header>
        {loading ? <div className="loading-state">Cargando informacion municipal...</div> : null}

        {!loading && view === 'resumen' && summary && <>
          <section className="metric-grid">
            {[['Total',summary.totales.total],['Pendientes',summary.totales.pendientes],['En proceso',summary.totales.en_proceso],['Por validar',summary.totales.por_validar],['Resueltas',summary.totales.resueltas],['Urgentes',summary.totales.urgentes]].map(([label,value],i)=><article className={`metric-card tone-${i}`} key={label}><span>{label}</span><strong>{value || 0}</strong></article>)}
          </section>
          <section className="ops-grid two-columns">
            <article className="ops-card"><div className="card-heading"><div><small>Actividad territorial</small><h2>Zonas criticas</h2></div></div><MapContainer center={[-17.3895,-66.1568]} zoom={13} className="ops-map"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{summary.heatmap.map((p,i)=><Circle key={i} center={[Number(p.celda_latitud),Number(p.celda_longitud)]} radius={Math.max(120,Number(p.intensidad)*90)} pathOptions={{color:'#ef4444',fillColor:'#f97316',fillOpacity:.32}}><Popup>{p.intensidad} incidencias activas</Popup></Circle>)}</MapContainer></article>
            <article className="ops-card"><div className="card-heading"><div><small>Distribucion</small><h2>Incidencias por categoria</h2></div></div><div className="bar-list">{summary.categorias.map(c=><div key={c.nombre}><span>{c.nombre}<b>{c.total}</b></span><i><em style={{width:`${Math.min(100,(c.total/Math.max(1,summary.totales.total))*100)}%`,background:c.color}}/></i></div>)}</div><h3 className="subheading">Actividad reciente</h3>{summary.ultimas.map(i=><button className="activity-row" key={i.id_incidencia} onClick={()=>{setView('incidencias');loadDetail(i)}}><span>{i.codigo}</span><b>{i.categoria_nombre}</b><small>{i.estado_nombre}</small></button>)}</article>
          </section>
        </>}

        {!loading && view === 'incidencias' && <section className="ops-grid incident-layout">
          <article className="ops-card incident-list-card"><div className="card-heading"><div><small>Gestion urbana</small><h2>{role === 2 ? 'Tareas asignadas' : 'Bandeja de incidencias'}</h2></div><span>{filtered.length} resultados</span></div>
            <div className="filter-row"><input placeholder="Buscar codigo, ciudadano..." value={filters.buscar} onChange={e=>setFilters({...filters,buscar:e.target.value})}/><select value={filters.estado} onChange={e=>setFilters({...filters,estado:e.target.value})}><option value="">Todos los estados</option>{catalogs.estados.map(x=><option key={x.id_estado} value={x.id_estado}>{x.nombre}</option>)}</select><select value={filters.categoria} onChange={e=>setFilters({...filters,categoria:e.target.value})}><option value="">Todas las categorias</option>{catalogs.categorias.map(x=><option key={x.id_categoria} value={x.id_categoria}>{x.nombre}</option>)}</select></div>
            <div className="incident-scroll">{filtered.map(item=><button key={item.id_incidencia} className={`incident-row ${selected?.id_incidencia===item.id_incidencia?'selected':''}`} onClick={()=>loadDetail(item)}><div><small>{item.codigo}</small><strong>{item.categoria_nombre}</strong><p>{item.descripcion}</p></div><div className="incident-meta"><span style={{background:item.estado_color}}>{item.estado_nombre}</span><b className={`priority p-${item.prioridad_nivel}`}>{item.prioridad_nombre}</b></div></button>)}</div>
          </article>
          <article className="ops-card detail-card">{!selected ? <div className="empty-detail"><strong>Selecciona una incidencia</strong><span>Aqui veras ubicacion, evidencia, historial y acciones.</span></div> : <><div className="detail-hero"><div><small>{selected.codigo}</small><h2>{selected.categoria_nombre}</h2><p>{selected.descripcion}</p></div><span style={{background:selected.estado_color}}>{selected.estado_nombre}</span></div>{selected.foto_reporte&&<img className="detail-photo" src={`${API_URL}/uploads/${selected.foto_reporte}`} alt="Evidencia"/>}<div className="detail-facts"><span><small>Ciudadano</small>{selected.ciudadano}</span><span><small>Prioridad</small>{selected.prioridad_nombre}</span><span><small>Zona</small>{selected.zona_nombre||'Sin zona'}</span><span><small>Asignado</small>{selected.operador||'Sin operador'}</span></div><MapContainer center={[Number(selected.latitud),Number(selected.longitud)]} zoom={16} className="detail-map"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Marker position={[Number(selected.latitud),Number(selected.longitud)]}/>{route.length>0&&<Polyline positions={route} pathOptions={{color:'#0284c7',weight:5}}/>}</MapContainer>
            <div className="action-stack">{role===2&&<button className="secondary" onClick={calculateRoute}>Calcular ruta optima</button>}{[3,4].includes(role)&&<><button onClick={assignIncident}>Asignar o reasignar</button><button className="secondary" onClick={changePriority}>Cambiar prioridad</button></>}{role===2&&selected.id_estado===1&&<button onClick={()=>updateStatus(2)}>Iniciar trabajo</button>}{role===2&&selected.id_estado===2&&<><label className="evidence-input">Evidencia final<input type="file" accept="image/*" onChange={e=>setEvidence(e.target.files[0])}/><span>{evidence?.name||'Seleccionar fotografia'}</span></label><button onClick={()=>updateStatus(6)}>Enviar a validacion</button></>}{[3,4].includes(role)&&selected.id_estado===6&&<><button onClick={()=>validateWork('aprobado')}>Aprobar solucion</button><button className="secondary" onClick={()=>validateWork('observado')}>Solicitar correccion</button></>}</div>
            {detail?.historial?.length>0&&<div className="timeline"><h3>Historial</h3>{detail.historial.map(h=><div key={h.id_historial}><i/><span><b>{h.estado_nuevo}</b><small>{h.observacion} · {new Date(h.creado_en).toLocaleString()}</small></span></div>)}</div>}</>}</article>
        </section>}

        {!loading && view === 'usuarios' && role === 3 && <section className="ops-grid users-layout"><article className="ops-card"><div className="card-heading"><div><small>Accesos</small><h2>Usuarios del sistema</h2></div></div><div className="data-table">{users.map(user=><div className="data-row" key={user.id_usuario}><span><b>{user.nombre_completo}</b><small>{user.correo}</small></span><span>{user.rol_nombre}</span><button className={user.activo?'danger-link':'success-link'} onClick={()=>toggleUser(user)}>{user.activo?'Desactivar':'Activar'}</button></div>)}</div></article><article className="ops-card form-card"><h2>Nueva cuenta</h2><form onSubmit={createUser}><input name="nombre_completo" placeholder="Nombre completo" required/><input name="correo" type="email" placeholder="Correo" required/><input name="telefono" placeholder="Telefono"/><select name="id_rol" required><option value="">Selecciona rol</option><option value="1">Ciudadano</option><option value="2">Operador</option><option value="4">Supervisor</option><option value="3">Administrador</option></select><input name="contrasena" type="password" minLength="10" placeholder="Contrasena temporal" required/><button>Crear usuario</button></form></article></section>}

        {!loading && view === 'cuadrillas' && role === 3 && <section className="ops-grid three-columns">{crews.cuadrillas.map(c=><article className="ops-card crew-card" key={c.id_cuadrilla}><span>{c.categoria_nombre}</span><h2>{c.nombre}</h2><p>{c.descripcion}</p><b>{c.miembros} miembros activos</b></article>)}</section>}
        {!loading && view === 'configuracion' && role === 3 && <section className="ops-grid two-columns"><article className="ops-card"><div className="card-heading"><div><small>Catalogo operativo</small><h2>Categorias y responsables</h2></div></div>{catalogs.categorias.map(c=><button className="config-row" key={c.id_categoria} onClick={()=>editCategory(c)}><span style={{background:c.color}}/><div><b>{c.nombre}</b><small>{c.area_responsable}</small></div><em>Editar</em></button>)}</article><article className="ops-card"><div className="card-heading"><div><small>Tiempos de atencion</small><h2>Acuerdos de servicio (SLA)</h2></div></div>{catalogs.prioridades.map(p=><button className="config-row" key={p.id_prioridad} onClick={()=>editSla(p)}><span style={{background:p.color}}/><div><b>{p.nombre}</b><small>{p.horas_primera_respuesta} h respuesta · {p.horas_resolucion} h resolucion</small></div><em>Editar</em></button>)}</article></section>}
        {!loading && view === 'reportes' && <section className="ops-card report-center"><small>Transparencia y planificacion</small><h2>Reporte consolidado municipal</h2><p>Descarga un documento PDF con las incidencias, sus prioridades, estados, ciudadanos y tiempos registrados.</p><button onClick={downloadPdf}>Descargar reporte PDF</button></section>}
      </main>
    </div>
  );
};

export default DashboardGestion;
