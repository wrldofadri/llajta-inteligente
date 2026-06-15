import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import 'leaflet/dist/leaflet.css';
import logoMap from '../assets/Logo.png';
import api, { API_URL } from '../api';

// --- GENERADOR DE PINES ---
const obtenerIcono = (id_categoria) => {
    let emoji = '📍';
    let color = '#38B6FF'; 
    if (id_categoria === 1) { emoji = '🗑️'; color = '#ef4444'; }
    if (id_categoria === 2) { emoji = '🚧'; color = '#f59e0b'; }
    if (id_categoria === 3) { emoji = '🚦'; color = '#8b5cf6'; } 

    return L.divIcon({
        className: 'custom-pin',
        html: `<div style="background: linear-gradient(135deg, ${color} 0%, #0f172a 200%); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 4px solid white; box-shadow: 0 8px 16px rgba(0,0,0,0.25); font-size: 22px; transition: transform 0.2s;">${emoji}</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 44],
        popupAnchor: [0, -44]
    });
};

const ClickEnMapa = ({ setPosicion, activo }) => {
    useMapEvents({ click(e) { if(activo) setPosicion(e.latlng); } });
    return null;
};

const VolarA = ({ coordenadas }) => {
    const map = useMap();
    useEffect(() => { if (coordenadas) map.flyTo(coordenadas, 16, { animate: true, duration: 1.5 }); }, [coordenadas, map]);
    return null;
};

const DashboardCiudadano = () => {
    const centroCochabamba = [-17.3895, -66.1568];
    const navigate = useNavigate();

    const [todasIncidencias, setTodasIncidencias] = useState([]);
    const [misReportes, setMisReportes] = useState([]);
    
    // NUEVO ESTADO: Controla el filtro del mapa
    const [mostrarSoloMisReportes, setMostrarSoloMisReportes] = useState(false);
    const [filtroCategoria, setFiltroCategoria] = useState('');
    
    const [vistaActiva, setVistaActiva] = useState('inicio'); 
    const [reporteSeleccionado, setReporteSeleccionado] = useState(null);
    const [posicionNueva, setPosicionNueva] = useState(null);
    const [enfocarMapaEn, setEnfocarMapaEn] = useState(centroCochabamba);

    const [idCategoria, setIdCategoria] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [foto, setFoto] = useState(null);

    const cargarDatos = async () => {
        try {
            const resTodas = await api.get('/incidencias/todas');
            setTodasIncidencias(resTodas.data);
            const resMis = await api.get('/incidencias/mis-reportes');
            setMisReportes(resMis.data);
        } catch (error) {
            if(error.response?.status === 401) { localStorage.removeItem('token'); navigate('/auth'); }
        }
    };

    useEffect(() => { cargarDatos(); }, []);

    const abrirImagen = (url) => {
        Swal.fire({
            imageUrl: url,
            imageAlt: 'Evidencia',
            showConfirmButton: false,
            showCloseButton: true,
            width: 'auto',
            background: 'transparent',
            backdrop: 'rgba(15, 23, 42, 0.95)',
            customClass: { image: 'img-lightbox' } 
        });
    };

    const verDetalle = (reporte) => {
        setReporteSeleccionado(reporte);
        setPosicionNueva(null); // Limpiar pin fantasma
        setVistaActiva('detalle');
        setEnfocarMapaEn([reporte.latitud, reporte.longitud]);
    };

    const iniciarNuevoReporte = () => {
        setVistaActiva('nuevo');
        setPosicionNueva(null); setIdCategoria(''); setDescripcion(''); setFoto(null); setReporteSeleccionado(null);
        setEnfocarMapaEn(centroCochabamba);
    };

    const usarMiUbicacion = () => {
        if (!navigator.geolocation) return Swal.fire('No disponible', 'Tu navegador no permite geolocalizacion.', 'warning');
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                const position = { lat: coords.latitude, lng: coords.longitude };
                setPosicionNueva(position);
                setEnfocarMapaEn([position.lat, position.lng]);
                Swal.fire({ icon: 'success', title: 'Ubicacion detectada', timer: 1200, showConfirmButton: false });
            },
            () => Swal.fire('Permiso requerido', 'Permite tu ubicacion o marca el punto manualmente.', 'info'),
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    const iniciarEdicion = (reporte) => {
        setReporteSeleccionado(reporte); 
        setIdCategoria(reporte.id_categoria);
        setDescripcion(reporte.descripcion);
        setPosicionNueva({ lat: reporte.latitud, lng: reporte.longitud });
        setFoto(null); 
        setVistaActiva('editar');
        setEnfocarMapaEn([reporte.latitud, reporte.longitud]);
    };

    const handleRegistrar = async (e) => {
        e.preventDefault();
        if (!posicionNueva) return Swal.fire({ icon: 'warning', title: 'Falta Ubicación', text: 'Marca la ubicación en el mapa.', confirmButtonColor: '#38B6FF' });
        
        const formData = new FormData();
        formData.append('id_categoria', idCategoria);
        formData.append('descripcion', descripcion);
        formData.append('latitud', posicionNueva.lat);
        formData.append('longitud', posicionNueva.lng);
        formData.append('foto', foto);

        try {
            await api.post('/incidencias/registrar', formData);
            Swal.fire({ icon: 'success', title: '¡Enviado!', text: 'Reporte enviado a la central.', timer: 2000, showConfirmButton: false });
            iniciarNuevoReporte(); setVistaActiva('lista'); cargarDatos(); 
        } catch (error) { Swal.fire({ icon: 'error', title: 'Oops...', text: error.response?.data?.error || 'No se pudo enviar', confirmButtonColor: '#38B6FF' }); }
    };

    const handleActualizar = async (e) => {
        e.preventDefault();
        if (!posicionNueva) return Swal.fire({ icon: 'warning', title: 'Falta Ubicación', text: 'Marca la ubicación en el mapa.', confirmButtonColor: '#38B6FF' });

        const formData = new FormData();
        formData.append('id_categoria', idCategoria);
        formData.append('descripcion', descripcion);
        formData.append('latitud', posicionNueva.lat);
        formData.append('longitud', posicionNueva.lng);
        if (foto) formData.append('foto', foto);

        try {
            await api.put(`/incidencias/${reporteSeleccionado.id_incidencia}`, formData);
            Swal.fire({ icon: 'success', title: '¡Actualizado!', text: 'El reporte fue corregido exitosamente.', timer: 2000, showConfirmButton: false });
            setPosicionNueva(null); setReporteSeleccionado(null); setVistaActiva('lista'); cargarDatos(); 
        } catch { Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar.', confirmButtonColor: '#38B6FF' }); }
    };

    const handleCancelar = async (id) => {
        const result = await Swal.fire({
            title: '¿Eliminar reporte?',
            text: "¡No podrás revertir esto!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            borderRadius: '16px'
        });

        if (!result.isConfirmed) return;

        try {
            await api.delete(`/incidencias/${id}`);
            Swal.fire({ icon: 'success', title: 'Eliminado', text: 'El reporte ha sido eliminado.', timer: 2000, showConfirmButton: false });
            
            // LIMPIEZA DE PINES FANTASMAS
            setPosicionNueva(null);
            setReporteSeleccionado(null);
            setVistaActiva('lista'); 
            cargarDatos();
        } catch { Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar el reporte.', confirmButtonColor: '#38B6FF' }); }
    };

    const renderizarPanelCentral = () => {
        if (vistaActiva === 'inicio') {
            const reportesPendientes = misReportes.filter(r => r.id_estado === 1).length;
            const reportesResueltos = misReportes.filter(r => r.id_estado === 3).length;
            return (
                <>
                    <div className="panel-header"><h3 style={{color: '#0f172a'}}>Hola, Qhochala ✨</h3></div>
                    <div className="panel-body">
                        <div className="stats-grid">
                            <div className="stat-card destacada">
                                <div><h2 style={{color: 'white'}}>{misReportes.length}</h2><p style={{color: '#94a3b8'}}>Impactos en tu ciudad</p></div>
                                <div style={{fontSize: '4rem'}}>🏙️</div>
                            </div>
                            <div className="stat-card"><h2 style={{color: '#f59e0b'}}>{reportesPendientes}</h2><p>En Revisión</p></div>
                            <div className="stat-card"><h2 style={{color: '#10b981'}}>{reportesResueltos}</h2><p>Solucionados</p></div>
                        </div>
                        <button onClick={iniciarNuevoReporte} className="btn-primario" style={{padding: '20px', fontSize: '1.2rem', display: 'flex', justifyContent: 'center', gap: '10px'}}>
                            <span>🚀</span> Reportar un nuevo problema
                        </button>
                    </div>
                </>
            );
        }

        if (vistaActiva === 'lista') {
            return (
                <>
                    <div className="panel-header"><h3>Tus Reportes</h3></div>
                    <div className="panel-body">
                        {misReportes.length === 0 ? <p style={{color: '#64748b'}}>Aún no has reportado nada.</p> : null}
                        {misReportes.map(rep => (
                            <div className="tarjeta-reporte" key={rep.id_incidencia} onClick={() => verDetalle(rep)}>
                                <div className="tarjeta-header">
                                    <h4>{rep.categoria_nombre}</h4>
                                    <span className={`badge estado-${rep.id_estado}`}>{rep.estado_nombre || 'Pendiente'}</span>
                                </div>
                                <p style={{color: '#475569', margin: '0 0 15px 0', fontSize: '1rem', lineHeight: '1.5'}}>{rep.descripcion}</p>
                            </div>
                        ))}
                    </div>
                </>
            );
        }

        if (vistaActiva === 'detalle' && reporteSeleccionado) {
            const rep = reporteSeleccionado;
            return (
                <>
                    <div className="panel-header" style={{display:'flex', gap:'20px', alignItems:'center'}}>
                        <button onClick={() => { setVistaActiva('lista'); setReporteSeleccionado(null); }} className="btn-secundario" style={{width:'auto', padding:'12px 20px', borderRadius: '12px'}}>← Volver</button>
                        <h3 style={{margin: 0}}>Detalle</h3>
                    </div>
                    <div className="panel-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                            <h2 style={{margin:0, color:'#0f172a', fontSize: '1.8rem', fontWeight: '800'}}>{rep.categoria_nombre}</h2>
                            <span className={`badge estado-${rep.id_estado}`}>{rep.estado_nombre}</span>
                        </div>
                        <p style={{ margin: '0 0 25px 0', color: '#334155', fontSize: '1.1rem', lineHeight: '1.7' }}>{rep.descripcion}</p>
                        {rep.foto_reporte && (
                             <img src={`${API_URL}/uploads/${rep.foto_reporte}`} alt="Evidencia" className="foto-evidencia" onClick={() => abrirImagen(`${API_URL}/uploads/${rep.foto_reporte}`)} />
                        )}
                        {rep.id_estado === 1 && (
                            <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                                <button onClick={() => iniciarEdicion(rep)} className="btn-secundario" style={{ flex: 1 }}>✏️ Editar</button>
                                <button onClick={() => handleCancelar(rep.id_incidencia)} className="btn-peligro" style={{ flex: 1 }}>🗑️ Eliminar</button>
                            </div>
                        )}
                    </div>
                </>
            );
        }

        if (vistaActiva === 'nuevo' || vistaActiva === 'editar') {
            const esEdicion = vistaActiva === 'editar';
            return (
                <>
                    <div className="panel-header"><h3>{esEdicion ? 'Editar Reporte' : 'Nuevo Reporte'}</h3></div>
                    <div className="panel-body">
                        {!posicionNueva && !esEdicion ? (
                            <div style={{padding: '50px 20px', textAlign:'center', background:'#f8fafc', borderRadius:'24px', border:'2px dashed #cbd5e1', color:'#0f172a'}}>
                                <h2 style={{fontSize: '4rem', margin: '0 0 15px 0'}}>🗺️</h2>
                                <h3 style={{margin: '0 0 10px 0', fontSize: '1.4rem'}}>Ubicación del problema</h3>
                                <p style={{margin: '0 0 18px', fontWeight: '500', color: '#64748b'}}>Usa tu GPS o toca el mapa para establecer el pin.</p>
                                <button type="button" className="btn-primario" onClick={usarMiUbicacion}>Usar mi ubicacion actual</button>
                            </div>
                        ) : (
                            <form onSubmit={esEdicion ? handleActualizar : handleRegistrar} className="formulario-moderno" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={{fontSize:'0.95rem', fontWeight:'700', color:'#0f172a', marginBottom:'10px', display:'block'}}>Tipo de Incidencia</label>
                                    <select value={idCategoria} onChange={(e) => setIdCategoria(Number(e.target.value))} required>
                                        <option value="">Seleccionar...</option>
                                        <option value="1">🗑️ Basura acumulada</option>
                                        <option value="2">🚧 Bache o vía dañada</option>
                                        <option value="3">🚦 Semáforo averiado</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{fontSize:'0.95rem', fontWeight:'700', color:'#0f172a', marginBottom:'10px', display:'block'}}>Descripción</label>
                                    <textarea placeholder="Da detalles para ayudar a las autoridades..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required rows="4" />
                                </div>
                                <div>
                                    <label style={{fontSize:'0.95rem', fontWeight:'700', color:'#0f172a', marginBottom:'10px', display:'block'}}>Foto Evidencia {esEdicion && <span style={{color:'#94a3b8'}}>(Opcional)</span>}</label>
                                    {foto ? (
                                        <img src={URL.createObjectURL(foto)} alt="Preview" className="foto-preview" onClick={() => abrirImagen(URL.createObjectURL(foto))} />
                                    ) : (esEdicion && reporteSeleccionado?.foto_reporte) ? (
                                        <img src={`${API_URL}/uploads/${reporteSeleccionado.foto_reporte}`} alt="Actual" className="foto-preview" onClick={() => abrirImagen(`${API_URL}/uploads/${reporteSeleccionado.foto_reporte}`)} />
                                    ) : null}
                                    <label className="file-upload-label" style={{marginTop: '15px'}}>
                                        <input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files[0])} required={!esEdicion} />
                                        <span className="upload-icon">📸</span>
                                        <span className="upload-text">{foto ? 'Cambiar foto' : 'Toca para subir una imagen'}</span>
                                    </label>
                                </div>
                                <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                                    <button type="button" onClick={() => { setPosicionNueva(null); setVistaActiva(esEdicion ? 'detalle' : 'lista'); }} className="btn-secundario">Cancelar</button>
                                    <button type="submit" className="btn-primario">{esEdicion ? 'Actualizar Reporte' : 'Enviar Reporte'}</button>
                                </div>
                            </form>
                        )}
                    </div>
                </>
            );
        }
    };

    // Filtramos qué incidencias se dibujarán en el mapa
    const baseIncidencias = mostrarSoloMisReportes ? misReportes : todasIncidencias;
    const incidenciasAMostrar = filtroCategoria
        ? baseIncidencias.filter((incidencia) => String(incidencia.id_categoria) === filtroCategoria)
        : baseIncidencias;

    return (
        <div className="dashboard-moderno">
            <div className="sidebar-moderna">
                <div className="brand-logo">
                    <img src={logoMap} alt="Logo" />
                    <h2>Llajta<br/>Inteligente</h2>
                </div>
                <div className="menu-navegacion">
                    <div className={`menu-item ${vistaActiva === 'inicio' ? 'activo' : ''}`} onClick={() => {setVistaActiva('inicio'); setPosicionNueva(null); setReporteSeleccionado(null); setEnfocarMapaEn(centroCochabamba);}}><span>📱</span> Inicio</div>
                    <div className={`menu-item ${vistaActiva === 'lista' || vistaActiva === 'detalle' ? 'activo' : ''}`} onClick={() => {setVistaActiva('lista'); setPosicionNueva(null); setReporteSeleccionado(null); setEnfocarMapaEn(centroCochabamba);}}><span>📋</span> Mis Reportes</div>
                    <div className={`menu-item ${vistaActiva === 'nuevo' || vistaActiva === 'editar' ? 'activo' : ''}`} onClick={iniciarNuevoReporte}><span>➕</span> Nuevo</div>
                </div>
                <div style={{padding: '20px'}}>
                    <div className="menu-item" style={{color: '#ef4444', justifyContent: 'center', background: '#fef2f2'}} onClick={() => { localStorage.removeItem('token'); navigate('/auth'); }}>Cerrar Sesión</div>
                </div>
            </div>

            <div className="contenido-principal">
                <div className="panel-dinamico">{renderizarPanelCentral()}</div>

                <div className="contenedor-mapa">
                    
                    {/* --- TOGGLE DE FILTRO SOBRE EL MAPA --- */}
                    <div className="filtro-mapa">
                        <span style={{ opacity: mostrarSoloMisReportes ? 0.5 : 1 }}>🌍 Todos</span>
                        <label className="switch">
                            <input 
                                type="checkbox" 
                                checked={mostrarSoloMisReportes} 
                                onChange={(e) => setMostrarSoloMisReportes(e.target.checked)} 
                            />
                            <span className="slider"></span>
                        </label>
                        <span style={{ opacity: mostrarSoloMisReportes ? 1 : 0.5, color: mostrarSoloMisReportes ? '#38B6FF' : '#0f172a' }}>👤 Mis Aportes</span>
                        <select className="filtro-categoria" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} aria-label="Filtrar categoria">
                            <option value="">Todas</option><option value="1">Basura</option><option value="2">Baches</option><option value="3">Semaforos</option>
                        </select>
                    </div>

                    <MapContainer center={centroCochabamba} zoom={14} style={{ width: '100%', height: '100%', zIndex: 1 }}>
                        <LayersControl position="topright">
                            <LayersControl.BaseLayer checked name="🗺️ Mapa Urbano">
                                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; OpenStreetMap' />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name="🛰️ Vista Satelital">
                                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name="🌑 Modo Oscuro">
                                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                            </LayersControl.BaseLayer>
                        </LayersControl>
                        
                        <ClickEnMapa setPosicion={setPosicionNueva} activo={vistaActiva === 'nuevo' || vistaActiva === 'editar'} />
                        <VolarA coordenadas={enfocarMapaEn} />

                        {/* Dibujamos las incidencias filtradas */}
                        {incidenciasAMostrar.map((incidencia) => (
                            <Marker key={incidencia.id_incidencia} position={[incidencia.latitud, incidencia.longitud]} icon={obtenerIcono(incidencia.id_categoria)}>
                                <Popup>
                                    <strong style={{fontSize:'1.1rem', color: '#0f172a', fontFamily: 'Inter, sans-serif'}}>{incidencia.descripcion}</strong>
                                    <p style={{margin:'5px 0 0 0', fontSize:'0.85rem', color:'#64748b'}}>Por: {incidencia.ciudadano}</p>
                                </Popup>
                            </Marker>
                        ))}

                        {posicionNueva && (
                            <Marker position={posicionNueva} icon={obtenerIcono(idCategoria || 0)}>
                                <Popup>📍 {vistaActiva === 'editar' ? 'Nueva ubicación' : 'Pin de Reporte'}</Popup>
                            </Marker>
                        )}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};

export default DashboardCiudadano;
