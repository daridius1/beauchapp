# Reglas del Proyecto Beauchapp

1. **Verificar siempre con la versión moderna:** Antes de proponer o implementar cualquier código, configuración o decisión de diseño (especialmente relacionada a la base de datos o PocketBase), DEBES investigar en internet cómo se hace en la última versión estable (actualmente PocketBase v0.25+). NO asumas que la sintaxis antigua sigue siendo válida, ya que PocketBase introduce cambios mayores entre versiones (ej. hooks JS, migraciones JS, estructuración de configuraciones, etc).

2. **Archivos de prueba:** Si necesitas crear scripts de prueba (archivos temporales de JavaScript, tests de configuración, comprobaciones a la base de datos, etc.), DEBES guardarlos dentro de una carpeta dedicada a pruebas (ej. `/home/betty/beauchapp/tests/` o similar). NUNCA debes dejar scripts de prueba sueltos en carpetas importantes como `pb_hooks`, `pb_migrations` o la raíz del proyecto.

3. **Manejo de Base de Datos y PocketBase:**
- `pb_migrations`: Solo debe contener migraciones definitivas y válidas para el esquema y los datos iniciales.
- `pb_hooks`: Solo debe contener lógica de negocio que es parte fundamental de la aplicación.
- Mantener el diseño visual limpio y minimalista según las especificaciones del usuario.
