# Guía de Diseño y Consistencia Visual: Beauchapp 🏆

Esta guía define las reglas de diseño para Beauchapp con el fin de evitar el "estilo promedio de IA" (sombras pesadas, gradientes coloridos, esquinas muy redondeadas) y lograr una interfaz limpia, funcional y utilitaria inspirada en productos como GitHub, Linear y Notion.

---

## 1. Filosofía de Diseño
*   **Minimalismo Utilitario**: Menos cajas contenedoras, más espacio en blanco y tipografía de alto contraste.
*   **Contraste sobre Adornos**: La jerarquía se define por el peso y color del texto, no por sombras o relieves.
*   **Sin Distracciones**: Evitar gradientes, efectos de cristal (glassmorphism), y animaciones complejas innecesarias.

---

## 2. Paleta de Colores (Tema Oscuro Consistente)
*   **Fondo Principal (Background)**: `#0f172a` (Slate 900 - Oscuro profundo).
*   **Fondo Secundario / Cabeceras (CardBg)**: `#1e293b` (Slate 800 - Contenedores planos).
*   **Texto Principal**: `#f8fafc` (Slate 50 - Blanco brillante de alta legibilidad).
*   **Texto Secundario / Muted**: `#94a3b8` (Slate 400 - Gris para etiquetas e información secundaria).
*   **Bordes / Divisores**: `#334155` (Slate 700 - Líneas finas y sólidas).
*   **Acento Primario**: `#4f46e5` (Indigo 600 - Para llamados a la acción primarios).
*   **Acento Secundario**: `#38bdf8` (Sky 400 - Para valores de ELO, enlaces e indicadores activos).

---

## 3. Elementos del Layout
*   **Bordes**: Radio de borde rectangular y afilado (`border-radius: 6px` o inferior).
*   **Sombras**: Completamente prohibidas. Todo el diseño es plano (Flat).
*   **Separadores**: Usar bordes inferiores simples (`borderBottomWidth: 1`, `borderColor: '#334155'`) en lugar de envolver cada elemento en una caja o tarjeta.
*   **Botones**: Rectangulares, con bordes de `6px`, colores planos y sin efectos de brillo.

---

## 4. Estructura de Componentes
*   **Listas e Historiales**: Renglones horizontales divididos por líneas finas (estilo commits de GitHub).
*   **Formularios**: Inputs limpios con fondo plano, borde simple y etiquetas directas.

---

## 5. Prohibiciones (Nunca Hacer)
*   ❌ Tarjetas flotando con sombras pronunciadas (`elevation` o `shadowOpacity` altas).
*   ❌ Fondos con gradientes de colores.
*   ❌ Esquinas muy redondeadas (ej. `borderRadius: 20` o superior en tarjetas).
*   ❌ Iconos gigantescos o decoraciones innecesarias.
