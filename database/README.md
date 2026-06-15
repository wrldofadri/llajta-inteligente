# Base de datos de Llajta Inteligente

## Crear el esquema en MySQL Workbench

1. Abre `database/schema.sql` en MySQL Workbench.
2. Conectate a `Local instance MySQL80`.
3. Ejecuta todo el archivo con el boton del rayo.
4. Actualiza `SCHEMAS` y verifica que aparezca `llajta_inteligente`.

El script es reutilizable: usa `CREATE TABLE IF NOT EXISTS` y actualiza los
catalogos principales sin borrar los datos existentes.

Si una ejecucion anterior se detuvo a mitad, no necesitas borrar la base de
datos. Corrige el archivo y vuelve a ejecutar `schema.sql` completo: las tablas
existentes se conservaran y se crearan solamente las que falten.

## Contrasenas

La columna `usuarios.contrasena` almacena un hash bcrypt. El SQL no contiene
usuarios ni contrasenas de ejemplo para evitar credenciales inseguras.

La aplicacion debe generar el hash de esta manera:

```js
const bcrypt = require('bcrypt');

const hash = await bcrypt.hash(contrasena, 12);
```

Para validar el inicio de sesion:

```js
const esValida = await bcrypt.compare(contrasenaIngresada, usuario.contrasena);
```

No se debe aplicar SHA, MD5 ni cifrado reversible a las contrasenas. Tampoco se
debe aplicar un segundo hash desde MySQL: `bcrypt` en Node.js se encarga de todo.

## Crear el primer administrador

1. Copia `backend/.env.example` como `backend/.env` y completa las credenciales.
2. Define una `ADMIN_PASSWORD` de al menos 12 caracteres.
3. Desde la carpeta `backend`, ejecuta:

```powershell
npm run create-admin
```

El comando crea el usuario con rol administrador (`id_rol = 3`) y guarda
solamente el hash bcrypt con costo 12. No muestra la contrasena ni el hash.

## Identificadores compatibles con el proyecto actual

| Catalogo | ID | Valor |
| --- | ---: | --- |
| Rol | 1 | Ciudadano |
| Rol | 2 | Operador |
| Rol | 3 | Administrador |
| Rol | 4 | Supervisor |
| Categoria | 1 | Basura acumulada |
| Categoria | 2 | Bache o via danada |
| Categoria | 3 | Semaforo averiado |
| Estado | 1 | Pendiente |
| Estado | 2 | En Proceso |
| Estado | 3 | Resuelto |

## Cobertura

El esquema incluye usuarios y roles, incidencias geolocalizadas, prioridades y
SLA, zonas, cuadrillas, asignaciones, evidencias, historial de estados,
supervision, comentarios, notificaciones, auditoria y vistas para estadisticas,
rendimiento y mapas de calor.
