# Beauchapp - Guía de Arquitectura de PocketBase ⚙️

Este documento registra las lecciones críticas aprendidas durante el desarrollo y migración a **PocketBase v0.25+**. Deberás consultar esta guía obligatoriamente antes de hacer modificaciones en el backend o en el esquema de la base de datos para evitar reintroducir errores críticos.

---

## 1. Reglas de Desarrollo de Hooks (`pb_hooks`)

PocketBase permite escribir la lógica de negocio usando JavaScript (Goja JSVM). Sin embargo, el comportamiento de este motor de JavaScript tiene diferencias importantes con Node.js o el navegador:

### ❌ Aislamiento de Scope (ReferenceError)
Las funciones definidas en el ámbito global del archivo (ej. `function validarAlgo() { ... }`) **NO son accesibles** de manera confiable dentro de los callbacks de los eventos (`onRecordCreateRequest`, etc.). El motor evalúa cada ejecución de un hook de manera aislada, por lo que arrojará un error `ReferenceError` si intentas llamar una función global.

**Solución correcta:**
- Define las funciones auxiliares *dentro* del propio closure del hook.
- O bien, extráelas a un archivo independiente (ej. `utils.js`) y expórtalas/impórtalas usando `require()`.

### ❌ `get()` vs `getString()`
A partir de la versión v0.23, la API para leer datos cambió. El método `e.record.get("campo")` ahora devuelve una interfaz (un objeto genérico). Si intentas llamar un método nativo de string como `.replace()` o `.toLowerCase()` directamente, PocketBase lanzará una excepción silenciada (`Something went wrong`).

**Solución correcta:**
Siempre usar los "Getters fuertemente tipados":
- `e.record.getString("campo")`
- `e.record.getInt("campo")`
- `e.record.getBool("campo")`

---

## 2. Autenticación y Superadministradores (`_superusers`)

En PocketBase v0.25 existen **dos sistemas de usuarios completamente independientes**:

1. **`users` (Colección de la App):** Donde se registran los estudiantes. En esta colección agregamos un campo booleano `isSuperadmin`. Este campo *solo le sirve a la aplicación móvil* para saber si debe mostrar o no botones administrativos (como crear un concurso). 
   - *Nota de seguridad:* Existe un hook en `main.pb.js` que impide que un usuario normal se dé permisos de `isSuperadmin=true` mediante la API.

2. **`_superusers` (Administradores del Sistema):** Son los únicos con acceso al panel de control en `http://127.0.0.1:8090/_/`. Sus cuentas **NO** existen en la colección `users`. Cualquier script externo (como `seed.js`) o despliegue automatizado que necesite manipular colecciones protegidas, debe autenticarse usando la colección `_superusers`.

---

## 3. Despliegues y Peligro de `pb_data`

### ❌ Nunca subir `pb_data`
La carpeta `pb_data/` contiene la base de datos local SQLite y todos los archivos subidos (avatares, etc.). **Está estrictamente prohibido** que un script de despliegue (ej. `deploy.sh`) o un `git push` suba esta carpeta al servidor de producción. Si se hace, se sobreescribirá la base de datos viva (borrando a todos los usuarios reales) por los datos locales de desarrollo.

**Solución correcta:**
La fuente de verdad del esquema (las tablas) es el directorio `pb_migrations/`.
- PocketBase aplicará estas migraciones automáticamente en producción al detectar una base de datos vacía o desactualizada.
- A partir de la v0.25, ya no importamos esquemas dinámicamente mediante JSON en los scripts; el motor de Goja usa el snapshot `1783056177_collections_snapshot.js` para levantar todas las tablas idénticas a como estaban en tu entorno local.

---

## 4. Frontend: Manejo de Fechas con Hermes (React Native)

El motor Hermes de React Native tiene problemas documentados al parsear cadenas de fecha que contienen espacios en blanco, un formato que PocketBase a veces arroja (ej. `2023-11-23 16:00:00.000Z`).

**Solución correcta:**
Antes de pasar cualquier fecha de PocketBase al constructor `new Date()` en el frontend, debes normalizarla reemplazando el espacio por la `T` estándar de la ISO-8601:
```typescript
const d = new Date(dateStr.replace(' ', 'T'));
```
*(Si no se hace, la aplicación crasheará en iOS y Android).*
