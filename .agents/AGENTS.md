# Reglas del Proyecto Beauchapp

1. **Verificar siempre con la versión moderna:** Antes de proponer o implementar cualquier código, configuración o decisión de diseño (especialmente relacionada a la base de datos o PocketBase), DEBES investigar en internet cómo se hace en la última versión estable (actualmente PocketBase v0.25+). NO asumas que la sintaxis antigua sigue siendo válida, ya que PocketBase introduce cambios mayores entre versiones (ej. hooks JS, migraciones JS, estructuración de configuraciones, etc).

2. **Archivos de prueba:** Si necesitas crear scripts de prueba (archivos temporales de JavaScript, tests de configuración, comprobaciones a la base de datos, etc.), DEBES guardarlos dentro de una carpeta dedicada a pruebas (ej. `/home/betty/beauchapp/tests/` o similar). NUNCA debes dejar scripts de prueba sueltos en carpetas importantes como `pb_hooks`, `pb_migrations` o la raíz del proyecto.

3. **Manejo de Base de Datos y PocketBase:**
- `pb_migrations`: Solo debe contener migraciones definitivas y válidas para el esquema y los datos iniciales.
- `pb_hooks`: Solo debe contener lógica de negocio que es parte fundamental de la aplicación.
- Mantener el diseño visual limpio y minimalista según las especificaciones del usuario.

4. **Scroll Defensivo y Viewports PWA (CSS):**
- La altura del elemento contenedor raíz (`#root`) debe ser de `100dvh` (Dynamic Viewport Height) para evitar que los elementos de navegación inferior queden cortados detrás de las barras de herramientas móviles en Safari/Chrome.
- Evitar rebotes de historial del navegador inyectando globalmente en la cabecera:
  - `overscroll-behavior-y: contain` (evita recargas por arrastre elástico del body).
  - `overscroll-behavior-x: none` (desactiva gestos de deslizamiento lateral de historial).
  - `-webkit-tap-highlight-color: transparent` (evita parpadeo gris al presionar en iOS).

5. **Layout Responsivo y Docking de Menú (PC vs Móvil):**
- Usar `useWindowDimensions` para detectar el tamaño de la pantalla responsivamente.
- Si el ancho de pantalla es $\ge 800\text{px}$ (Escritorio):
  - El menú lateral (`Sidebar`) debe quedar permanentemente anclado a la izquierda (`isDocked={true}`) en estilo plano y sin animaciones de desplazamiento o overlays.
  - El botón de hamburguesa ☰ en el `Header` debe ocultarse de la vista.
  - Ajustar el ancho máximo del contenedor principal a `1050px` para otorgar los 250px correspondientes al sidebar sin reducir el espacio útil de visualización del feed (800px).
- Si el ancho de pantalla es $< 800\text{px}$ (Móvil):
  - El `Sidebar` debe comportarse como cajón flotante deslizable mediante animación sobre el feed, acompañado de un backdrop oscuro y translúcido.

6. **Navegación Defensiva en Enlaces Profundos (Deep Links):**
- Al gestionar el botón de retroceso (`handleBack`), comprobar siempre si hay historial de navegación disponible (`navigation.canGoBack()`).
- Si es falso (por ejemplo, al entrar directo desde una URL compartida o escaneo de código), redirigir siempre a la pantalla contenedora jerárquica lógica para evitar bloqueos:
  - `ProblemDetail` / `ProblemEditor` $\rightarrow$ `ProblemsList`
  - `PostDetail` $\rightarrow$ `Home`
  - Vistas de perfiles/directorios (`UserProfile`, `Students`, `Communities`, `Centers`, `Teams`, `FollowList`) $\rightarrow$ `Directory`
  - Fallback por defecto $\rightarrow$ `Home`

7. **Estándar de Tiempos de Carga (Refresco):**
- Evitar el parpadeo de interfaces y asegurar que los indicadores de carga (spinners) sean claramente identificables por el usuario usando la utilidad `withMinimumDelay(asyncFn, minDurationMs = 400)`.
- Si el servidor responde rápido, la promesa esperará el tiempo remanente para completar los 400ms mínimos. Si la red es lenta y supera dicho umbral, no se añadirá ningún retraso artificial en producción.

8. **Alto Dinámico en Renderizadores de Markdown y KaTeX:**
- Para visualizadores embebidos (WebViews/iframes) de Markdown + LaTeX:
  - Implementar siempre un `ResizeObserver` en el DOM interno para notificar dinámicamente al componente React Native los cambios en el alto del renderizado.
  - Añadir listeners de eventos `load`/`error` a todas las etiquetas de imagen (`<img>`) generadas por el parser, forzando un recalculado al completarse la carga asíncrona de recursos visuales.
  - Desactivar las advertencias de desuso de `marked` pasando las opciones `{ mangle: false, headerIds: false }`.

9. **Directrices de Diseño Plano (Flat Design):**
- Respetar rigurosamente la regla del diseño plano: prohibido usar sombras (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, `elevation`) en tarjetas, menús contextuales, botones o barras. Usar bordes sólidos y colores de contraste.

