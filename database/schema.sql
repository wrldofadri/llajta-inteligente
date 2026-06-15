-- Llajta Inteligente - Esquema completo para MySQL 8.0+
-- Ejecutar con una cuenta que pueda crear bases de datos, tablas y vistas.
-- Las contrasenas NO se insertan en texto plano: se generan con bcrypt desde Node.js.

CREATE DATABASE IF NOT EXISTS llajta_inteligente
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE llajta_inteligente;

SET NAMES utf8mb4;
SET time_zone = '-04:00';

-- =========================================================
-- SEGURIDAD Y USUARIOS
-- =========================================================

CREATE TABLE IF NOT EXISTS roles (
  id_rol TINYINT UNSIGNED NOT NULL,
  nombre VARCHAR(40) NOT NULL,
  descripcion VARCHAR(255) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_rol),
  UNIQUE KEY uq_roles_nombre (nombre)
) ENGINE=InnoDB;

INSERT INTO roles (id_rol, nombre, descripcion) VALUES
  (1, 'Ciudadano', 'Registra y consulta incidencias urbanas'),
  (2, 'Operador', 'Atiende incidencias asignadas y carga evidencias'),
  (3, 'Administrador', 'Administra usuarios, catalogos y configuracion'),
  (4, 'Supervisor', 'Revisa, reasigna y valida trabajos')
AS nuevo
ON DUPLICATE KEY UPDATE
  nombre = nuevo.nombre,
  descripcion = nuevo.descripcion,
  activo = TRUE;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_rol TINYINT UNSIGNED NOT NULL DEFAULT 1,
  nombre_completo VARCHAR(150) NOT NULL,
  correo VARCHAR(190) NOT NULL,
  contrasena VARCHAR(255) NOT NULL COMMENT 'Hash bcrypt; nunca texto plano',
  telefono VARCHAR(30) NULL,
  documento_identidad VARCHAR(30) NULL,
  foto_perfil VARCHAR(255) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  correo_verificado BOOLEAN NOT NULL DEFAULT FALSE,
  intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_hasta DATETIME NULL,
  ultimo_acceso DATETIME NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eliminado_en DATETIME NULL,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuarios_correo (correo),
  UNIQUE KEY uq_usuarios_documento (documento_identidad),
  KEY idx_usuarios_rol_activo (id_rol, activo),
  CONSTRAINT fk_usuarios_rol
    FOREIGN KEY (id_rol) REFERENCES roles (id_rol)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sesiones_refresh (
  id_sesion BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL COMMENT 'SHA-256 del refresh token',
  ip_origen VARCHAR(45) NULL,
  agente_usuario VARCHAR(500) NULL,
  expira_en DATETIME NOT NULL,
  revocado_en DATETIME NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_sesion),
  UNIQUE KEY uq_sesiones_token_hash (token_hash),
  KEY idx_sesiones_usuario_expira (id_usuario, expira_en),
  CONSTRAINT fk_sesiones_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- CATALOGOS DE OPERACION
-- =========================================================

CREATE TABLE IF NOT EXISTS categorias (
  id_categoria SMALLINT UNSIGNED NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  descripcion VARCHAR(500) NULL,
  area_responsable VARCHAR(120) NOT NULL,
  icono VARCHAR(50) NULL,
  color CHAR(7) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY uq_categorias_nombre (nombre),
  UNIQUE KEY uq_categorias_slug (slug)
) ENGINE=InnoDB;

INSERT INTO categorias
  (id_categoria, nombre, slug, descripcion, area_responsable, icono, color)
VALUES
  (1, 'Basura acumulada', 'basura', 'Microbasurales, contenedores llenos y residuos en espacios publicos', 'Servicios de limpieza', 'trash', '#EF4444'),
  (2, 'Bache o via danada', 'baches', 'Baches, hundimientos y deterioro de calzadas', 'Mantenimiento vial', 'road-barrier', '#F59E0B'),
  (3, 'Semaforo averiado', 'semaforos', 'Semaforos apagados, danados o descoordinados', 'Transito y senalizacion', 'traffic-light', '#8B5CF6')
AS nuevo
ON DUPLICATE KEY UPDATE
  nombre = nuevo.nombre,
  slug = nuevo.slug,
  descripcion = nuevo.descripcion,
  area_responsable = nuevo.area_responsable,
  icono = nuevo.icono,
  color = nuevo.color,
  activo = TRUE;

CREATE TABLE IF NOT EXISTS estados (
  id_estado TINYINT UNSIGNED NOT NULL,
  nombre VARCHAR(50) NOT NULL,
  descripcion VARCHAR(255) NULL,
  color CHAR(7) NULL,
  es_final BOOLEAN NOT NULL DEFAULT FALSE,
  orden_visual TINYINT UNSIGNED NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_estado),
  UNIQUE KEY uq_estados_nombre (nombre),
  UNIQUE KEY uq_estados_orden (orden_visual)
) ENGINE=InnoDB;

INSERT INTO estados
  (id_estado, nombre, descripcion, color, es_final, orden_visual)
VALUES
  (1, 'Pendiente', 'Reporte recibido y pendiente de asignacion', '#D97706', FALSE, 1),
  (2, 'En Proceso', 'Reporte asignado y actualmente atendido', '#0284C7', FALSE, 2),
  (3, 'Resuelto', 'Trabajo terminado y validado', '#16A34A', TRUE, 3),
  (4, 'Rechazado', 'Reporte invalido, duplicado o fuera de competencia', '#DC2626', TRUE, 4),
  (5, 'Cancelado', 'Reporte cancelado por el ciudadano o administrador', '#64748B', TRUE, 5)
AS nuevo
ON DUPLICATE KEY UPDATE
  nombre = nuevo.nombre,
  descripcion = nuevo.descripcion,
  color = nuevo.color,
  es_final = nuevo.es_final,
  orden_visual = nuevo.orden_visual,
  activo = TRUE;

CREATE TABLE IF NOT EXISTS prioridades (
  id_prioridad TINYINT UNSIGNED NOT NULL,
  nombre VARCHAR(40) NOT NULL,
  nivel TINYINT UNSIGNED NOT NULL,
  descripcion VARCHAR(255) NULL,
  horas_primera_respuesta SMALLINT UNSIGNED NOT NULL,
  horas_resolucion SMALLINT UNSIGNED NOT NULL,
  color CHAR(7) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_prioridad),
  UNIQUE KEY uq_prioridades_nombre (nombre),
  UNIQUE KEY uq_prioridades_nivel (nivel),
  CONSTRAINT chk_prioridad_nivel CHECK (nivel BETWEEN 1 AND 4)
) ENGINE=InnoDB;

INSERT INTO prioridades
  (id_prioridad, nombre, nivel, descripcion, horas_primera_respuesta, horas_resolucion, color)
VALUES
  (1, 'Baja', 1, 'Sin peligro inmediato; atencion programable', 72, 240, '#22C55E'),
  (2, 'Media', 2, 'Afectacion urbana moderada', 24, 120, '#EAB308'),
  (3, 'Alta', 3, 'Riesgo importante para personas o circulacion', 8, 48, '#F97316'),
  (4, 'Critica', 4, 'Peligro inmediato o bloqueo de un servicio esencial', 2, 12, '#DC2626')
AS nuevo
ON DUPLICATE KEY UPDATE
  nombre = nuevo.nombre,
  nivel = nuevo.nivel,
  descripcion = nuevo.descripcion,
  horas_primera_respuesta = nuevo.horas_primera_respuesta,
  horas_resolucion = nuevo.horas_resolucion,
  color = nuevo.color,
  activo = TRUE;

CREATE TABLE IF NOT EXISTS zonas (
  id_zona SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  distrito VARCHAR(50) NULL,
  descripcion VARCHAR(255) NULL,
  centro_latitud DECIMAL(10,7) NULL,
  centro_longitud DECIMAL(10,7) NULL,
  poligono_geojson JSON NULL COMMENT 'GeoJSON opcional para clasificacion geografica',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_zona),
  UNIQUE KEY uq_zonas_nombre_distrito (nombre, distrito),
  CONSTRAINT chk_zona_latitud CHECK (centro_latitud IS NULL OR centro_latitud BETWEEN -90 AND 90),
  CONSTRAINT chk_zona_longitud CHECK (centro_longitud IS NULL OR centro_longitud BETWEEN -180 AND 180)
) ENGINE=InnoDB;

-- =========================================================
-- CUADRILLAS Y PERSONAL TECNICO
-- =========================================================

CREATE TABLE IF NOT EXISTS cuadrillas (
  id_cuadrilla BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_categoria SMALLINT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(255) NULL,
  telefono_contacto VARCHAR(30) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cuadrilla),
  UNIQUE KEY uq_cuadrillas_nombre (nombre),
  KEY idx_cuadrillas_categoria_activo (id_categoria, activo),
  CONSTRAINT fk_cuadrillas_categoria
    FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cuadrilla_miembros (
  id_cuadrilla BIGINT UNSIGNED NOT NULL,
  id_usuario BIGINT UNSIGNED NOT NULL,
  es_responsable BOOLEAN NOT NULL DEFAULT FALSE,
  incorporado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retirado_en DATETIME NULL,
  PRIMARY KEY (id_cuadrilla, id_usuario),
  KEY idx_miembros_usuario (id_usuario),
  CONSTRAINT fk_miembros_cuadrilla
    FOREIGN KEY (id_cuadrilla) REFERENCES cuadrillas (id_cuadrilla)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_miembros_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =========================================================
-- INCIDENCIAS
-- =========================================================

CREATE TABLE IF NOT EXISTS incidencias (
  id_incidencia BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(30) NULL COMMENT 'Codigo publico generado por la aplicacion, ej. INC-2026-000001',
  id_usuario BIGINT UNSIGNED NOT NULL,
  id_categoria SMALLINT UNSIGNED NOT NULL,
  id_estado TINYINT UNSIGNED NOT NULL DEFAULT 1,
  id_prioridad TINYINT UNSIGNED NOT NULL DEFAULT 2,
  id_zona SMALLINT UNSIGNED NULL,
  titulo VARCHAR(160) NULL,
  descripcion TEXT NOT NULL,
  direccion_referencia VARCHAR(255) NULL,
  latitud DECIMAL(10,7) NOT NULL,
  longitud DECIMAL(10,7) NOT NULL,
  foto_reporte VARCHAR(255) NOT NULL COMMENT 'Compatibilidad con el backend actual',
  origen ENUM('web', 'movil', 'operador', 'importacion') NOT NULL DEFAULT 'web',
  es_anonimo BOOLEAN NOT NULL DEFAULT FALSE,
  id_incidencia_duplicada BIGINT UNSIGNED NULL,
  motivo_rechazo VARCHAR(500) NULL,
  fecha_reporte DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_asignacion DATETIME NULL,
  fecha_inicio DATETIME NULL,
  fecha_resolucion DATETIME NULL,
  fecha_cierre DATETIME NULL,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eliminado_en DATETIME NULL,
  PRIMARY KEY (id_incidencia),
  UNIQUE KEY uq_incidencias_codigo (codigo),
  KEY idx_incidencias_usuario_fecha (id_usuario, fecha_reporte),
  KEY idx_incidencias_estado_prioridad (id_estado, id_prioridad),
  KEY idx_incidencias_categoria_estado (id_categoria, id_estado),
  KEY idx_incidencias_zona_fecha (id_zona, fecha_reporte),
  KEY idx_incidencias_coordenadas (latitud, longitud),
  KEY idx_incidencias_duplicada (id_incidencia_duplicada),
  FULLTEXT KEY ft_incidencias_texto (titulo, descripcion, direccion_referencia),
  CONSTRAINT fk_incidencias_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_incidencias_categoria
    FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_incidencias_estado
    FOREIGN KEY (id_estado) REFERENCES estados (id_estado)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_incidencias_prioridad
    FOREIGN KEY (id_prioridad) REFERENCES prioridades (id_prioridad)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_incidencias_zona
    FOREIGN KEY (id_zona) REFERENCES zonas (id_zona)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_incidencias_duplicada
    FOREIGN KEY (id_incidencia_duplicada) REFERENCES incidencias (id_incidencia)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_incidencia_latitud CHECK (latitud BETWEEN -90 AND 90),
  CONSTRAINT chk_incidencia_longitud CHECK (longitud BETWEEN -180 AND 180),
  CONSTRAINT chk_incidencia_descripcion CHECK (CHAR_LENGTH(TRIM(descripcion)) >= 10)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS incidencia_archivos (
  id_archivo BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_incidencia BIGINT UNSIGNED NOT NULL,
  id_usuario BIGINT UNSIGNED NOT NULL,
  tipo ENUM('reporte', 'avance', 'resolucion', 'supervision') NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  ruta_archivo VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  tamano_bytes BIGINT UNSIGNED NULL,
  descripcion VARCHAR(255) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eliminado_en DATETIME NULL,
  PRIMARY KEY (id_archivo),
  KEY idx_archivos_incidencia_tipo (id_incidencia, tipo),
  KEY idx_archivos_usuario (id_usuario),
  CONSTRAINT fk_archivos_incidencia
    FOREIGN KEY (id_incidencia) REFERENCES incidencias (id_incidencia)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_archivos_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asignaciones (
  id_asignacion BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_incidencia BIGINT UNSIGNED NOT NULL,
  id_cuadrilla BIGINT UNSIGNED NULL,
  id_operador BIGINT UNSIGNED NULL,
  asignado_por BIGINT UNSIGNED NOT NULL,
  instrucciones VARCHAR(1000) NULL,
  fecha_asignacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_aceptacion DATETIME NULL,
  fecha_finalizacion DATETIME NULL,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  motivo_reasignacion VARCHAR(500) NULL,
  PRIMARY KEY (id_asignacion),
  KEY idx_asignaciones_incidencia_activa (id_incidencia, activa),
  KEY idx_asignaciones_operador_activa (id_operador, activa),
  KEY idx_asignaciones_cuadrilla_activa (id_cuadrilla, activa),
  CONSTRAINT fk_asignaciones_incidencia
    FOREIGN KEY (id_incidencia) REFERENCES incidencias (id_incidencia)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_asignaciones_cuadrilla
    FOREIGN KEY (id_cuadrilla) REFERENCES cuadrillas (id_cuadrilla)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_asignaciones_operador
    FOREIGN KEY (id_operador) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_asignaciones_autor
    FOREIGN KEY (asignado_por) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS historial_estados (
  id_historial BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_incidencia BIGINT UNSIGNED NOT NULL,
  id_estado_anterior TINYINT UNSIGNED NULL,
  id_estado_nuevo TINYINT UNSIGNED NOT NULL,
  cambiado_por BIGINT UNSIGNED NULL,
  observacion VARCHAR(1000) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_historial),
  KEY idx_historial_incidencia_fecha (id_incidencia, creado_en),
  KEY idx_historial_usuario (cambiado_por),
  CONSTRAINT fk_historial_incidencia
    FOREIGN KEY (id_incidencia) REFERENCES incidencias (id_incidencia)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_historial_estado_anterior
    FOREIGN KEY (id_estado_anterior) REFERENCES estados (id_estado)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_historial_estado_nuevo
    FOREIGN KEY (id_estado_nuevo) REFERENCES estados (id_estado)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_historial_usuario
    FOREIGN KEY (cambiado_por) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comentarios_incidencia (
  id_comentario BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_incidencia BIGINT UNSIGNED NOT NULL,
  id_usuario BIGINT UNSIGNED NOT NULL,
  comentario TEXT NOT NULL,
  es_interno BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Visible solo para personal municipal',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  editado_en DATETIME NULL,
  eliminado_en DATETIME NULL,
  PRIMARY KEY (id_comentario),
  KEY idx_comentarios_incidencia_fecha (id_incidencia, creado_en),
  CONSTRAINT fk_comentarios_incidencia
    FOREIGN KEY (id_incidencia) REFERENCES incidencias (id_incidencia)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_comentarios_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS validaciones_supervisor (
  id_validacion BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_incidencia BIGINT UNSIGNED NOT NULL,
  id_supervisor BIGINT UNSIGNED NOT NULL,
  resultado ENUM('aprobado', 'observado', 'rechazado') NOT NULL,
  observaciones VARCHAR(1000) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_validacion),
  KEY idx_validaciones_incidencia_fecha (id_incidencia, creado_en),
  KEY idx_validaciones_supervisor (id_supervisor),
  CONSTRAINT fk_validaciones_incidencia
    FOREIGN KEY (id_incidencia) REFERENCES incidencias (id_incidencia)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_validaciones_supervisor
    FOREIGN KEY (id_supervisor) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =========================================================
-- NOTIFICACIONES, CONFIGURACION Y AUDITORIA
-- =========================================================

CREATE TABLE IF NOT EXISTS notificaciones (
  id_notificacion BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario BIGINT UNSIGNED NOT NULL,
  id_incidencia BIGINT UNSIGNED NULL,
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(160) NOT NULL,
  mensaje VARCHAR(1000) NOT NULL,
  url_destino VARCHAR(500) NULL,
  leida_en DATETIME NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_notificacion),
  KEY idx_notificaciones_usuario_leida (id_usuario, leida_en, creado_en),
  CONSTRAINT fk_notificaciones_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_notificaciones_incidencia
    FOREIGN KEY (id_incidencia) REFERENCES incidencias (id_incidencia)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS configuracion_sistema (
  clave VARCHAR(100) NOT NULL,
  valor JSON NOT NULL,
  descripcion VARCHAR(255) NULL,
  actualizado_por BIGINT UNSIGNED NULL,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (clave),
  CONSTRAINT fk_configuracion_usuario
    FOREIGN KEY (actualizado_por) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
  ('mapa.centro', JSON_OBJECT('latitud', -17.3895, 'longitud', -66.1568, 'zoom', 14), 'Centro inicial del mapa de Cochabamba'),
  ('archivos.limites', JSON_OBJECT('max_mb', 8, 'tipos', JSON_ARRAY('image/jpeg', 'image/png', 'image/webp')), 'Restricciones para evidencias'),
  ('incidencias.radio_duplicado_metros', JSON_OBJECT('valor', 50), 'Radio sugerido para detectar reportes duplicados')
AS nuevo
ON DUPLICATE KEY UPDATE
  valor = nuevo.valor,
  descripcion = nuevo.descripcion;

CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario BIGINT UNSIGNED NULL,
  accion VARCHAR(80) NOT NULL,
  entidad VARCHAR(80) NOT NULL,
  entidad_id VARCHAR(80) NULL,
  datos_anteriores JSON NULL,
  datos_nuevos JSON NULL,
  ip_origen VARCHAR(45) NULL,
  agente_usuario VARCHAR(500) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_auditoria),
  KEY idx_auditoria_entidad (entidad, entidad_id, creado_en),
  KEY idx_auditoria_usuario_fecha (id_usuario, creado_en),
  CONSTRAINT fk_auditoria_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- =========================================================
-- VISTAS PARA DASHBOARDS, ESTADISTICAS Y MAPA DE CALOR
-- =========================================================

CREATE OR REPLACE VIEW vw_incidencias_detalle AS
SELECT
  i.id_incidencia,
  i.codigo,
  i.id_usuario,
  u.nombre_completo AS ciudadano,
  i.id_categoria,
  c.nombre AS categoria_nombre,
  c.area_responsable,
  i.id_estado,
  e.nombre AS estado_nombre,
  e.es_final,
  i.id_prioridad,
  p.nombre AS prioridad_nombre,
  p.nivel AS prioridad_nivel,
  i.id_zona,
  z.nombre AS zona_nombre,
  z.distrito,
  i.titulo,
  i.descripcion,
  i.direccion_referencia,
  i.latitud,
  i.longitud,
  i.foto_reporte,
  i.fecha_reporte,
  i.fecha_asignacion,
  i.fecha_inicio,
  i.fecha_resolucion,
  TIMESTAMPDIFF(HOUR, i.fecha_reporte, COALESCE(i.fecha_resolucion, NOW())) AS horas_transcurridas,
  CASE
    WHEN i.fecha_resolucion IS NULL
      AND TIMESTAMPDIFF(HOUR, i.fecha_reporte, NOW()) > p.horas_resolucion THEN TRUE
    ELSE FALSE
  END AS sla_vencido
FROM incidencias i
JOIN usuarios u ON u.id_usuario = i.id_usuario
JOIN categorias c ON c.id_categoria = i.id_categoria
JOIN estados e ON e.id_estado = i.id_estado
JOIN prioridades p ON p.id_prioridad = i.id_prioridad
LEFT JOIN zonas z ON z.id_zona = i.id_zona
WHERE i.eliminado_en IS NULL;

CREATE OR REPLACE VIEW vw_estadisticas_por_zona AS
SELECT
  COALESCE(i.id_zona, 0) AS id_zona,
  COALESCE(z.nombre, 'Sin zona asignada') AS zona,
  i.id_categoria,
  c.nombre AS categoria,
  COUNT(*) AS total_reportes,
  SUM(i.id_estado = 1) AS pendientes,
  SUM(i.id_estado = 2) AS en_proceso,
  SUM(i.id_estado = 3) AS resueltos,
  SUM(i.id_estado IN (4, 5)) AS cerrados_sin_resolver,
  ROUND(AVG(CASE
    WHEN i.fecha_resolucion IS NOT NULL
    THEN TIMESTAMPDIFF(HOUR, i.fecha_reporte, i.fecha_resolucion)
  END), 2) AS promedio_horas_resolucion
FROM incidencias i
JOIN categorias c ON c.id_categoria = i.id_categoria
LEFT JOIN zonas z ON z.id_zona = i.id_zona
WHERE i.eliminado_en IS NULL
GROUP BY COALESCE(i.id_zona, 0), COALESCE(z.nombre, 'Sin zona asignada'), i.id_categoria, c.nombre;

CREATE OR REPLACE VIEW vw_mapa_calor AS
SELECT
  ROUND(latitud, 3) AS celda_latitud,
  ROUND(longitud, 3) AS celda_longitud,
  id_categoria,
  COUNT(*) AS intensidad,
  MAX(fecha_reporte) AS ultimo_reporte
FROM incidencias
WHERE eliminado_en IS NULL
  AND id_estado IN (1, 2)
GROUP BY ROUND(latitud, 3), ROUND(longitud, 3), id_categoria;

CREATE OR REPLACE VIEW vw_rendimiento_cuadrillas AS
SELECT
  c.id_cuadrilla,
  c.nombre AS cuadrilla,
  COUNT(a.id_asignacion) AS total_asignaciones,
  SUM(a.fecha_finalizacion IS NOT NULL) AS finalizadas,
  ROUND(AVG(CASE
    WHEN a.fecha_finalizacion IS NOT NULL
    THEN TIMESTAMPDIFF(HOUR, a.fecha_asignacion, a.fecha_finalizacion)
  END), 2) AS promedio_horas_atencion
FROM cuadrillas c
LEFT JOIN asignaciones a ON a.id_cuadrilla = c.id_cuadrilla
GROUP BY c.id_cuadrilla, c.nombre;

-- =========================================================
-- TRIGGERS DE TRAZABILIDAD BASICA
-- La aplicacion debe completar cambiado_por y observacion cuando corresponda.
-- =========================================================

DROP TRIGGER IF EXISTS trg_incidencia_creada;
DROP TRIGGER IF EXISTS trg_incidencia_estado_actualizado;
DROP TRIGGER IF EXISTS trg_incidencia_fechas_estado;
DROP TRIGGER IF EXISTS trg_asignacion_validar_insert;
DROP TRIGGER IF EXISTS trg_asignacion_validar_update;

DELIMITER $$

CREATE TRIGGER trg_incidencia_creada
AFTER INSERT ON incidencias
FOR EACH ROW
BEGIN
  INSERT INTO historial_estados
    (id_incidencia, id_estado_anterior, id_estado_nuevo, cambiado_por, observacion)
  VALUES
    (NEW.id_incidencia, NULL, NEW.id_estado, NEW.id_usuario, 'Incidencia registrada');
END$$

CREATE TRIGGER trg_incidencia_fechas_estado
BEFORE UPDATE ON incidencias
FOR EACH ROW
BEGIN
  IF NEW.id_estado <> OLD.id_estado THEN
    IF NEW.id_estado = 2 AND NEW.fecha_inicio IS NULL THEN
      SET NEW.fecha_inicio = CURRENT_TIMESTAMP;
    END IF;

    IF NEW.id_estado = 3 AND NEW.fecha_resolucion IS NULL THEN
      SET NEW.fecha_resolucion = CURRENT_TIMESTAMP;
      SET NEW.fecha_cierre = CURRENT_TIMESTAMP;
    END IF;

    IF NEW.id_estado IN (4, 5) AND NEW.fecha_cierre IS NULL THEN
      SET NEW.fecha_cierre = CURRENT_TIMESTAMP;
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_incidencia_estado_actualizado
AFTER UPDATE ON incidencias
FOR EACH ROW
BEGIN
  IF NEW.id_estado <> OLD.id_estado THEN
    INSERT INTO historial_estados
      (id_incidencia, id_estado_anterior, id_estado_nuevo, cambiado_por, observacion)
    VALUES
      (NEW.id_incidencia, OLD.id_estado, NEW.id_estado, NULL, 'Cambio de estado registrado automaticamente');
  END IF;
END$$

-- MySQL no permite usar en un CHECK columnas que tienen acciones de clave
-- foranea como ON DELETE SET NULL. Los triggers conservan la misma regla:
-- toda asignacion debe indicar una cuadrilla, un operador o ambos.
CREATE TRIGGER trg_asignacion_validar_insert
BEFORE INSERT ON asignaciones
FOR EACH ROW
BEGIN
  IF NEW.id_cuadrilla IS NULL AND NEW.id_operador IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La asignacion requiere una cuadrilla o un operador';
  END IF;
END$$

CREATE TRIGGER trg_asignacion_validar_update
BEFORE UPDATE ON asignaciones
FOR EACH ROW
BEGIN
  IF NEW.id_cuadrilla IS NULL AND NEW.id_operador IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La asignacion requiere una cuadrilla o un operador';
  END IF;
END$$

DELIMITER ;

-- Comprobacion rapida al terminar la ejecucion.
SELECT 'Esquema llajta_inteligente creado correctamente' AS resultado;
SELECT id_rol, nombre FROM roles ORDER BY id_rol;
SELECT id_categoria, nombre FROM categorias ORDER BY id_categoria;
SELECT id_estado, nombre FROM estados ORDER BY orden_visual;
SELECT id_prioridad, nombre, horas_resolucion FROM prioridades ORDER BY nivel;
