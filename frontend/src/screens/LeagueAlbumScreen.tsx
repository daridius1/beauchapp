import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  RefreshControl,
  Image,
  Modal,
  Animated,
  PanResponder,
  Easing,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import { Image as CachedImage } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import Toast from 'react-native-toast-message';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, Line, G, Circle, Use } from 'react-native-svg';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { getFileUrl } from '../services/pocketbase';
import {
  albumService,
  AlbumData,
  AlbumTeam,
  AlbumPlayer,
  DrawnSticker,
  BuyPackResult,
} from '../services/albumService';
import { withMinimumDelay } from '../utils/refresh';
import { TeamCrest } from '../components/leagues/TeamCrest';
import {
  getTeamColor,
  getAlbumPalette,
  AlbumPalette,
  shadeHex,
  POSITION_ORDER,
  PlayerPosition,
  FALLBACK_TEAM_COLOR,
} from '../constants/teamColors';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'LeagueAlbum'>;

// Tamaño por default de una lámina fuera de la grilla fija de la página (fallback de
// StickerCard cuando no se le pasa un `style` propio — hoy todos los llamadores reales
// pasan el suyo, ver GRID_CARD_ASPECT/REVEAL_CARD_WIDTH).
const CARD_WIDTH = 98;
const CARD_HEIGHT = 124;
// Tamaño de la lámina "hero" del sobre (ver el modal de revelado) — misma proporción
// que CARD_WIDTH/CARD_HEIGHT, pero más grande: es lo único que se ve en ese momento,
// a diferencia de la grilla del álbum donde conviven muchas a la vez.
const REVEAL_CARD_WIDTH = 180;
const REVEAL_CARD_HEIGHT = Math.round((180 * CARD_HEIGHT) / CARD_WIDTH);
// Lámina del modal de previsualización (click en una lámina ya pegada) — más grande
// que la del sobre: acá no compite con el contador ni el tag "Nueva/Repetida", así que
// puede ocupar más espacio.
const PREVIEW_CARD_WIDTH = 260;
const PREVIEW_CARD_HEIGHT = Math.round((PREVIEW_CARD_WIDTH * CARD_HEIGHT) / CARD_WIDTH);

// Proporción width/height de una lámina normal (vertical) — de acá sale el alto de
// TODA la grilla de una página (incluida la lámina de plantel "de lado", que ocupa 2
// columnas de ancho pero la MISMA altura, para que las filas queden parejas).
const GRID_CARD_ASPECT = 0.72;
// Separación entre láminas de la grilla — mismo valor usado en el cálculo de ancho por
// columna (ver TeamAlbumPage) y en styles.fixedGrid.
const GRID_GAP = 10;
// Columnas fijas de la grilla (3 de ancho x 2 de alto = CARDS_PER_PAGE).
const GRID_COLUMNS = 3;

// Grosor del margen blanco alrededor del recorte/foto de cada lámina — el "cartón" de
// una lámina de álbum real, que separa la imagen del borde recortado de la carta.
// Antes era un número fijo (6px): en una lámina chica ese margen se volvía un borde
// grueso en proporción. Un % fijo del ancho puro tampoco sirve: en una lámina GRANDE
// (colWidth real en pantallas anchas suele superar bastante los ~98px de referencia) el
// margen terminaba más grueso que el de siempre, que es justo lo que se pedía evitar —
// "delgado" quiere decir nunca más grueso que el de referencia, no "6px cada vez más
// grandes cuanto más grande la lámina". Por eso cardMarginFor tiene un TOPE en 6 (el
// valor de siempre) además del piso (CARD_MARGIN_MIN): solo se achica para láminas más
// chicas que la referencia, nunca crece más allá de eso.
// Bajado de 2 a 1: en una lámina chica de verdad, 2px ya se sentía como un piso "que no
// terminaba de achicarse" — 1 sigue siendo visible (el "cartón" no desaparece del todo)
// pero se nota más delgado.
const CARD_MARGIN_MIN = 1;
const CARD_MARGIN_MAX = 6;
const CARD_MARGIN_RATIO = CARD_MARGIN_MAX / CARD_WIDTH;
function cardMarginFor(cardWidth: number): number {
  return Math.max(CARD_MARGIN_MIN, Math.min(CARD_MARGIN_MAX, Math.round(cardWidth * CARD_MARGIN_RATIO)));
}

// paddingHorizontal de los rectángulos de nombre (cardTopNameRect/cardBottomNameRect)
// — separado a una constante porque TeamTopRow/PlayerBottomRow también lo necesitan en
// JS, para saber cuánto ancho le queda al texto antes de decidir el tamaño de letra.
const NAME_CHIP_PADDING_H = 8;
// paddingVertical de esos mismos rectángulos — misma razón que la de arriba: hace
// falta en JS para saber cuánto ALTO le queda al texto (ver fitFontSizeToRow). Antes
// era un número fijo (6, subido de 4 porque con 4 el texto de 2 líneas quedaba pegado
// al borde de arriba/abajo) que asumía el también-fijo CARD_EDGE_ROW_HEIGHT=40 de
// entonces — ahora que ese alto escala con la lámina (cardEdgeRowHeightFor), un padding
// fijo de 6 en una fila ya chica de por sí (ver su comentario) le dejaba cada vez menos
// aire relativo al texto, así que ROW_NAME_PADDING_RATIO lo calcula proporcional al
// alto real de la fila (misma proporción 6/40 de siempre) en vez de un número fijo.
const ROW_NAME_PADDING_RATIO = 6 / 40;
function rowNamePaddingFor(edgeRowHeight: number): number {
  return edgeRowHeight * ROW_NAME_PADDING_RATIO;
}
// Separación entre el borde de la lámina y el nombre del equipo de la lámina de
// escudo (CrestTeamName, el único que no va pegado al borde) — misma razón que la
// constante de arriba: la necesita en JS.
const NAME_CHIP_WRAP_INSET = 6;
// Separación entre los cuadrados de escudo/posición y el nombre del medio (TeamTopRow)
// — chica, pero a propósito: sin esto se tocan apenas no se superponen, sin nada de
// aire entre medio.
const BADGE_NAME_GAP = 4;
// fontSize/letterSpacing de cardBottomNameText, DUPLICADOS acá (no derivados del
// objeto de estilo) porque las funciones de medición necesitan los números en JS
// plano — y fijos acá en vez de en el style porque el canvas de medición usa el string
// tal cual. NAME_CHIP_FONT_SIZE es el tamaño de PARTIDA (nombres cortos, la mayoría) —
// el nombre del jugador (PlayerBottomRow) lo achica hasta NAME_CHIP_MIN_FONT_SIZE si
// hace falta para que el nombre entre completo en NAME_CHIP_MAX_LINES líneas.
const NAME_CHIP_FONT_SIZE = 11;
const NAME_CHIP_MIN_FONT_SIZE = 8;
const NAME_CHIP_MAX_LINES = 2;
const NAME_CHIP_LETTER_SPACING = 0.2;
// El nombre del equipo (TeamTopRow) parte de una letra más grande que la del jugador —
// el rectángulo del medio se queda con todo el ancho que sobra, así que hay más lugar
// — y usa el mismo fitFontSizeToRow para agrandarla al máximo que entre en 2 líneas
// (nombres cortos quedan grandes) o achicarla hasta NAME_CHIP_MIN_FONT_SIZE si hace
// falta (nombres largos, siempre sin recortar). Probado en 20 primero (quedaba un
// escudo enorme, ver CARD_EDGE_ROW_HEIGHT) y en 14 después (quedaba chico); 17 es el
// punto medio entre esos dos.
const TEAM_NAME_BAR_MAX_FONT_SIZE = 17;
// El nombre de equipo de la lámina de ESCUDO (CrestTeamName) flota solo, de punta a
// punta de la carta, encima del escudo — a diferencia de TeamTopRow no tiene una fila
// de alto fijo que lo separe del escudo, así que un tope de letra fijo (probamos 15)
// funciona para nombres de una línea pero con 2 líneas el texto crece hacia abajo y
// termina pisando el marco del escudo (crestFrame). Por eso acá el tope no es una
// constante: sale de cuánto alto REAL queda libre arriba del escudo (ver
// CREST_TEAM_NAME_AVAILABLE_HEIGHT) — así el nombre corto de un equipo queda grande y
// el largo se achica solo lo justo para no chocar, en vez de un tamaño único que le
// queda bien a unos y mal a otros.
const CREST_TEAM_NAME_MAX_FONT_SIZE = 20;
// Mismos valores que crestTeamNameWrap.top y crestFrame.top (ver esos estilos, más
// abajo) — la resta es el alto real disponible para el nombre antes de pisar el
// escudo. Repetidos acá porque fitCrestTeamNameFontSize necesita el número en JS
// plano, igual que NAME_CHIP_FONT_SIZE con measureTextAtSize.
const CREST_TEAM_NAME_TOP = 8;
const CREST_FRAME_TOP = 44;
// El -4 es aire a propósito, no margen de error: con 0 de aire, un nombre de 2 líneas
// que calza justo termina literalmente pegado al marco del escudo (se ve como que lo
// toca), aunque técnicamente no lo pise. Probado con "TOTTENHAM HOTSPUR": a 1.2x de
// interlineado el cálculo daba exactamente el alto disponible (0 de margen) y en la
// lámina real la letra SÍ tocaba el escudo — la aproximación de interlineado no
// alcanza a capturar el alto real de la tipografía. De ahí el 1.3x de abajo además de
// este descuento fijo.
const CREST_TEAM_NAME_AVAILABLE_HEIGHT = CREST_FRAME_TOP - CREST_TEAM_NAME_TOP - 4;
// El alto real de una línea de texto es más que su fontSize (ascendentes +
// descendentes) — 1.3x, más generoso que el 1.2x "de manual", porque en la práctica
// (ver comentario de arriba) el interlineado real de Oswald-Bold en 2 líneas resultó
// más alto que la aproximación estándar.
const CREST_TEAM_NAME_LINE_HEIGHT_RATIO = 1.3;
// Alto de las 2 filas pegadas a los bordes de una lámina de jugador/DT — arriba
// (TeamTopRow: escudo — nombre del equipo) y abajo (PlayerBottomRow: nombre del
// jugador — posición/DT), ambas con el mismo alto por simetría. Escudo/nombre/posición
// miden siempre esto, sin importar cuántas líneas termine usando el texto de al lado —
// esa parte sigue "fija" a propósito: se probó derivarlo del fontSize elegido (más alto
// con 2 líneas), pero el ancho de una lámina en la grilla puede ser bastante angosto —
// un cuadrado así de "ancho como su alto" le comía casi todo el ancho a la lámina y no
// dejaba nada para el rectángulo de al lado. Lo que sí dejó de ser fijo es el NÚMERO:
// antes era un px fijo (40) para toda lámina sea cual sea su tamaño — se veía bien en el
// tamaño de referencia, pero como el ancho real de columna cambia con la pantalla
// (colWidth en TeamAlbumPage), en una lámina chica ese mismo alto se comía más de un
// cuarto de la carta entera y en una grande quedaba chico. Ahora es una fracción (1/8)
// del alto REAL de la carta (cardEdgeRowHeightFor), así el cuadrado se sigue achicando
// junto con la lámina en vez de "aplanarse" en un piso alto apenas la pantalla es un
// poco angosta — el piso (CARD_EDGE_ROW_HEIGHT_MIN) solo evita que el cuadrado quede
// MÁS BAJO que el texto mínimo que tiene que mostrar (rowNamePaddingFor ya escala
// también, ver su comentario): con el padding proporcional (30% del alto de la fila
// entre los 2 lados), el mínimo en el que un nombre de 1 línea todavía entra al fontSize
// mínimo (NAME_CHIP_MIN_FONT_SIZE) sin desbordar es
// 8 × ROW_TEXT_LINE_HEIGHT_RATIO / (0.7 × 0.9) ≈ 21.6 — 22 redondeando para arriba.
const CARD_EDGE_ROW_RATIO = 1 / 8;
const CARD_EDGE_ROW_HEIGHT_MIN = 22;
function cardEdgeRowHeightFor(cardHeight: number): number {
  return Math.max(CARD_EDGE_ROW_HEIGHT_MIN, cardHeight * CARD_EDGE_ROW_RATIO);
}
// El cuadrado de posición/DT (cardBottomSquare), el de escudo (cardTopSquare) y el de
// categoría (PhotoPairCornerBadge) miden edgeRowHeight × edgeRowHeight — un cuadrado
// perfecto que escala con la lámina. Pero el padding interno (3, fijo) y el fontSize del
// texto que llevan adentro (cardBadgeText: posición, DT, MAS/FEM/MIX) NO escalaban con
// ese cuadrado — a valores chicos de edgeRowHeight, un padding de 3 y una letra de 12
// (ambos pensados para el cuadrado de 40 de siempre) ya no entraban: el texto se veía
// más grande que su propio cuadrado. cardBadgePaddingFor/cardBadgeFontSizeFor son la
// misma idea que cardMarginFor: un tope en el valor de siempre (nunca más grande) y
// una escala proporcional a edgeRowHeight por debajo de eso.
const CARD_BADGE_PADDING_MAX = 3;
const CARD_BADGE_PADDING_RATIO = CARD_BADGE_PADDING_MAX / 40;
function cardBadgePaddingFor(edgeRowHeight: number): number {
  return Math.min(CARD_BADGE_PADDING_MAX, edgeRowHeight * CARD_BADGE_PADDING_RATIO);
}
const CARD_BADGE_FONT_MAX = 12;
const CARD_BADGE_FONT_RATIO = CARD_BADGE_FONT_MAX / 40;
// El piso (ABSOLUTE_MIN_FONT_SIZE) se define más abajo en el archivo (junto al resto de
// las constantes de ajuste de texto) — se referencia acá adentro de la función, no en
// una constante de módulo, para no depender del orden de declaración entre los 2
// bloques.
function cardBadgeFontSizeFor(edgeRowHeight: number): number {
  return Math.max(ABSOLUTE_MIN_FONT_SIZE, Math.min(CARD_BADGE_FONT_MAX, edgeRowHeight * CARD_BADGE_FONT_RATIO));
}
// Alto real de un bloque de 2 líneas de cardTopNameText/cardBottomNameText, medido con
// getBoundingClientRect en la lámina real (no una aproximación de manual) — nunca fue
// un valor único y estable: midiendo "EPSILON - CHELA" con distintos fontSize, el
// alto real / (fontSize × 2 líneas) dio entre 1.42x y 1.56x según el tamaño (el
// navegador redondea el alto de línea a saltos, no escala perfecto con el fontSize).
// Probamos 1.3x (copiado de CrestTeamName) y después 1.55x — el 1.55x justo quedaba
// pisando el peor caso medido (1.556x), así que "D'SYNDROMEN"/"EPSILON - CHELA" seguían
// desbordando la fila por arriba Y por abajo con ciertos fontSize (el bloque entero de
// texto medía más alto de lo que fitFontSizeToRow calculaba que cabía, no una letra de
// más ancho). 1.7x dejó margen real por encima del peor caso medido en vez de pisarlo.
const ROW_TEXT_LINE_HEIGHT_RATIO = 1.7;
// Misma fuente en el <Text> real (ver nameChipText) y acá — si no coinciden, lo medido
// no tiene nada que ver con lo que se termina pintando. Oswald (condensada, bold) en
// vez de una sans genérica: le da identidad de "álbum de figuritas" a las láminas y,
// al ser condensada, entran más letras al mismo tamaño — ayuda justo donde más cuesta
// (nombres largos), en vez de competir con eso. Bundleada en assets/fonts/ y cargada
// con useFonts en el componente de la pantalla (ver LeagueAlbumScreen) — measureTextAtSize
// necesita que ya esté lista antes de medir, por eso la pantalla espera fontsLoaded
// antes de pintar nada.
const NAME_CHIP_FONT_FAMILY = 'Oswald-Bold';
// Red de seguridad además del cálculo de fontSize: React Native Web pone
// "overflow-wrap: break-word" por defecto en TODO <Text> (ver su código fuente,
// exports/Text/index.js) — es lo que de verdad parte una palabra como "PACHORRA"
// dejando una letra sola en la 2da línea cuando measureText (canvas) se equivoca por un
// par de píxeles contra el layout real (font todavía afinando el hinting, redondeo de
// subpíxel). countWrappedLines ya intenta que eso nunca haga falta, pero si igual pasa,
// esto hace que el navegador prefiera desbordar unos px por el costado antes que partir
// la palabra — mejor una letra que se sale un poco del recuadro que una letra sola en
// su propia línea. `wordBreak`/`overflowWrap` no son parte del tipo TextStyle de RN
// (son props de solo-web), de ahí el `as any`; no tiene efecto en nativo aunque se
// aplicara, así que no hace falta condicionarlo a Platform.OS.
const NO_WORD_SPLIT_STYLE = { wordBreak: 'keep-all', overflowWrap: 'normal' } as any;

// Ancho real (en px) que ocupa `text` a `fontSize` con la tipografía del chip — con
// canvas.measureText en vez de medir un <Text> oculto con onLayout: eso requería 2
// pasadas de layout (medir → esperar el re-render → recién ahí decidir), y si algo
// interrumpía esa segunda pasada (la lámina se desmonta al cambiar de página a mitad
// de camino, por ejemplo) quedaba mostrando el nombre sin achicar aunque NO entrara —
// Text lo recortaba solo con "…" en el peor lugar posible. Este cálculo es síncrono,
// en el mismo render.
let _measureCanvasCtx: CanvasRenderingContext2D | null | undefined;
// Ancho crudo del texto, SIN letterSpacing — measureTextAtSize (abajo) es la versión
// de afuera que sí lo suma (letterSpacing no es parte de lo que mide measureText).
function measureRawTextWidth(text: string, fontSize: number): number {
  if (Platform.OS !== 'web') {
    // Sin canvas en nativo: se estima con un ancho de caracter típico de una
    // tipografía sans bold a este tamaño — peor que medir de verdad, pero nunca se
    // ejecuta en el build web, que es donde vive esta pantalla hoy.
    return text.length * fontSize * 0.62;
  }
  if (_measureCanvasCtx === undefined) {
    const canvas = document.createElement('canvas');
    _measureCanvasCtx = canvas.getContext('2d');
  }
  if (!_measureCanvasCtx) return 0;
  _measureCanvasCtx.font = `700 ${fontSize}px ${NAME_CHIP_FONT_FAMILY}`;
  return _measureCanvasCtx.measureText(text).width;
}

function measureTextAtSize(text: string, fontSize: number): number {
  // letterSpacing no es parte de la métrica de measureText, y no se escala junto al
  // fontSize (nameChipText tampoco lo hace) — se suma fijo, a mano (N-1 espacios
  // entre N caracteres).
  return measureRawTextWidth(text, fontSize) + NAME_CHIP_LETTER_SPACING * Math.max(0, text.length - 1);
}

// Margen de seguridad sobre TODO ancho usado para decidir wrap (countWrappedLines,
// abajo) — el measureText del canvas puede diferir un par de píxeles del layout real
// del navegador (subpixel/kerning/hinting), y en una lámina angosta esos 2px son un %
// grande del ancho disponible: medido en la lámina real, "LOS MONTANA" a 13px daba
// 74.1px por canvas pero 76.3px de verdad — con availableWidth=76 el canvas decía
// "entra en 1 línea" y el navegador la mandaba igual a una 2da línea completa, mucho
// más alta de lo calculado. Bajado de 0.92 a 0.85: con 0.92 "PACHORRA" seguía
// desbordando por una letra en ciertos anchos (el canvas la daba por "entra justo" y el
// navegador la partía igual) — como acá el precio de equivocarse para el lado angosto
// es una palabra partida (ver comentario de countWrappedLines) y no solo una línea de
// más, conviene quedarse corto de ancho antes que justo.
const TEXT_WRAP_SAFETY_RATIO = 0.85;
// Margen de seguridad sobre el ALTO disponible que chequean fitFontSizeToRow y
// fitCrestTeamNameFontSize — mismo espíritu que TEXT_WRAP_SAFETY_RATIO pero para
// arriba/abajo en vez de los costados: sin él, un bloque de texto que calzaba justo al
// límite calculado terminaba pegado al borde del rectángulo (lo que se reportó como
// "muy justo" en Randalltussi/Quesos Cumei) en vez de dejarlo con aire real. Bajado de
// 0.9 a 0.85 cuando el alto de fila empezó a escalar con el tamaño de la lámina
// (cardEdgeRowHeightFor): un 10% de aire ya alcanzaba en píxeles reales cuando la fila
// medía 40 fijo, pero en una lámina chica esos mismos 10% son un par de píxeles nomás —
// justo lo que se reportó como "nombres de 2 líneas pegados al margen". (Se probó 0.82
// primero; ver ABSOLUTE_MIN_FONT_SIZE sobre por qué se subió un poco.)
const TEXT_HEIGHT_SAFETY_RATIO = 0.85;
// Piso ABSOLUTO de legibilidad — más chico que NAME_CHIP_MIN_FONT_SIZE, que es el piso
// "normal" que prueba el loop de abajo. Antes, cuando NINGÚN tamaño (ni siquiera
// NAME_CHIP_MIN_FONT_SIZE) hacía entrar el bloque de texto en el alto disponible, la
// función igual devolvía NAME_CHIP_MIN_FONT_SIZE a ciegas — un nombre de 2 líneas en una
// fila angosta de verdad terminaba desbordando igual, pegado a los bordes, en vez de
// seguir achicándose. Ese caso extremo cae a heightBoundFontSize (ver abajo), que SIGUE
// bajando el tamaño hasta que el bloque entre, con este piso como único límite.
// Se probó primero en 5: technically preciso (nunca desborda), pero un nombre de 1
// línea que a 513px de ancho todavía entraba entero (letra grande, gobernada por
// ancho) pasaba a necesitar 2 líneas a 512px (un solo píxel menos) y el tamaño de letra
// se desplomaba de golpe hasta ese piso — un salto mucho más notorio que la diferencia
// real de espacio disponible entre esos 2 anchos. Subido a 7 (bastante más cerca de
// NAME_CHIP_MIN_FONT_SIZE) para que ese salto de 1-a-2-líneas sea de verdad chico en vez
// de caer a una letra "de emergencia" — a cambio, un nombre de 2 líneas en una fila
// MUY angosta puede desbordar un poco (no tanto como con el viejo piso de 8, pero ya no
// cero como con 5): el balance elegido prioriza que el tamaño de letra cambie suave al
// redimensionar por sobre que nunca haya ni un pixel de desborde en el peor caso.
const ABSOLUTE_MIN_FONT_SIZE = 7;
// Tamaño de letra que hace entrar EXACTO un bloque de NAME_CHIP_MAX_LINES líneas en
// `availableHeight` — el cálculo inverso del chequeo de alto que hacen
// fitFontSizeToRow/fitCrestTeamNameFontSize, usado como fallback de ambas cuando el
// loop no encuentra ningún tamaño que además entre de ANCHO: en ese caso ya no importa
// el ancho (la palabra más larga de por sí no entra en 1 línea a ningún tamaño legible),
// así que el único límite que queda es el alto.
function heightBoundFontSize(availableHeight: number, lineHeightRatio: number): number {
  return (availableHeight * TEXT_HEIGHT_SAFETY_RATIO) / (NAME_CHIP_MAX_LINES * lineHeightRatio);
}

// Cuántas líneas ocuparía `words` (ya separado por espacios) envuelto a `availableWidth`
// con este `fontSize` — simula el wrap real palabra por palabra (no solo "ancho total /
// ancho disponible", que sobreestima cuántas líneas hacen falta apenas el texto no es
// una sola palabra larga). Una sola palabra (sin espacios, ej. un nombre de equipo tipo
// "RANDALLTUSSI") que no entra ni en una línea vacía a este fontSize devuelve Infinity
// en vez de partirla carácter por carácter: antes SÍ se simulaba ese corte (como el
// `overflow-wrap: break-word` que aplica el navegador), pero eso significaba aceptar
// nombres como "RANDALLTUSSI" con una sola letra sola en la 2da línea, a veces
// desbordando el rectángulo — una palabra no se parte, se prefiere seguir achicando la
// letra (ver fitFontSizeToRow/fitCrestTeamNameFontSize, que siguen bajando el fontSize
// mientras countWrappedLines devuelva más líneas de las permitidas) hasta que la
// palabra entera quepa en una sola línea. Todas las comparaciones de ancho acá usan
// `safeWidth` (TEXT_WRAP_SAFETY_RATIO), no `availableWidth` a secas — ver su
// comentario: el canvas puede decir "entra" un par de píxeles antes de que entre de
// verdad.
function countWrappedLines(words: string[], availableWidth: number, fontSize: number): number {
  const safeWidth = availableWidth * TEXT_WRAP_SAFETY_RATIO;
  const spaceWidth = measureTextAtSize(' ', fontSize);
  let lines = 1;
  let currentWidth = 0;
  for (const word of words) {
    const wordWidth = measureTextAtSize(word, fontSize);
    if (wordWidth > safeWidth) return Infinity;
    const nextWidth = currentWidth === 0 ? wordWidth : currentWidth + spaceWidth + wordWidth;
    if (nextWidth > safeWidth && currentWidth > 0) {
      lines += 1;
      currentWidth = wordWidth;
    } else {
      currentWidth = nextWidth;
    }
  }
  return lines;
}

// Tamaño de letra para CrestTeamName: además de entrar en NAME_CHIP_MAX_LINES líneas
// de ancho, el bloque de texto (líneas × alto de línea) tiene que entrar en
// CREST_TEAM_NAME_AVAILABLE_HEIGHT — si no, un nombre de 2 líneas termina más grande de
// lo que cabe verticalmente y pisa el escudo, aunque de ancho cada línea entre
// perfecto. Mismo chequeo de alto que fitFontSizeToRow (ver más abajo), pero con el
// alto disponible calculado distinto (acá no es una fila de alto fijo).
function fitCrestTeamNameFontSize(words: string[], availableWidth: number): number {
  for (let fontSize = CREST_TEAM_NAME_MAX_FONT_SIZE; fontSize > NAME_CHIP_MIN_FONT_SIZE; fontSize -= 1) {
    const lines = countWrappedLines(words, availableWidth, fontSize);
    if (lines > NAME_CHIP_MAX_LINES) continue;
    if (lines * fontSize * CREST_TEAM_NAME_LINE_HEIGHT_RATIO <= CREST_TEAM_NAME_AVAILABLE_HEIGHT * TEXT_HEIGHT_SAFETY_RATIO) return fontSize;
  }
  return Math.max(ABSOLUTE_MIN_FONT_SIZE, Math.min(NAME_CHIP_MIN_FONT_SIZE, heightBoundFontSize(CREST_TEAM_NAME_AVAILABLE_HEIGHT, CREST_TEAM_NAME_LINE_HEIGHT_RATIO)));
}

// Tamaño de letra para TeamTopRow/PlayerBottomRow: esas 2 filas tienen un alto fijo
// para esa lámina (edgeRowHeight, ver cardEdgeRowHeightFor) — así que hace falta el mismo chequeo de
// alto que fitCrestTeamNameFontSize (¿entra el BLOQUE de texto, líneas × alto de línea,
// en `availableHeight`?), no solo el de ancho. Sin esto, un nombre de equipo corto que
// mide bien de ANCHO a letra grande podía terminar más alto que la fila y desbordar el
// rectángulo negro, aunque ninguna línea se recortara.
function fitFontSizeToRow(words: string[], availableWidth: number, availableHeight: number, maxFontSize: number): number {
  for (let fontSize = maxFontSize; fontSize > NAME_CHIP_MIN_FONT_SIZE; fontSize -= 1) {
    const lines = countWrappedLines(words, availableWidth, fontSize);
    if (lines > NAME_CHIP_MAX_LINES) continue;
    if (lines * fontSize * ROW_TEXT_LINE_HEIGHT_RATIO <= availableHeight * TEXT_HEIGHT_SAFETY_RATIO) return fontSize;
  }
  return Math.max(ABSOLUTE_MIN_FONT_SIZE, Math.min(NAME_CHIP_MIN_FONT_SIZE, heightBoundFontSize(availableHeight, ROW_TEXT_LINE_HEIGHT_RATIO)));
}

// Miniatura de DT/jugador — "300x300" es el thumb más grande ya declarado en
// team_players.photo (ver migraciones), bastante mejor que el "100x100" que se usaba
// antes ahora que las láminas escalan con el tamaño de página (pueden terminar
// bastante más anchas que 100px en pantallas grandes). El escudo NO usa esto — va con
// la imagen original (ver buildTeamSlots), porque puede no ser cuadrado y el único
// thumb grande de matchPhoto recorta al centro.
const PHOTO_THUMB = '300x300';

// Placeholders TEMPORALES mientras se sigue editando esta pantalla: reemplazan el
// ícono genérico (Feather) que se ve cuando a un equipo/jugador todavía le falta su
// foto real, por una imagen de verdad — para juzgar el layout con algo que se parece
// a una lámina real y no a un hueco de ícono. Cada archivo ya pasó por el mismo
// pipeline de compresión que un upload real (ver utils/imageCompressor.ts: mismo
// cropToSquare/format que usa cada campo — ver EditTeamScreen), así que el peso y la
// resolución son los de una foto subida de verdad, no los de la descarga cruda. Sacar
// cuando el álbum deje de estar en edición activa.
const PLACEHOLDER_IMAGES: Partial<Record<string, ReturnType<typeof require>>> = {
  user: require('../../assets/placeholders/player_avatar.png'),
  shield: require('../../assets/placeholders/team_crest.png'),
  image: require('../../assets/placeholders/team_photo.jpg'),
  // DT: mismo tratamiento visual que un jugador (personPhotoFrame, "cover"), pero con
  // su propio placeholder — se distingue de un jugador sin foto en vez de reusar el
  // mismo. 'clipboard' es un nombre de ícono Feather válido (lo pide el tipo de
  // placeholderIcon) reusado acá solo como key de este mapa; nunca se renderiza como
  // ícono de verdad (ver los `placeholderIcon === 'user'`/`'shield'` más abajo).
  clipboard: require('../../assets/placeholders/coach_avatar.png'),
};

// Textura prismática de la lámina de escudo: reemplaza a SunTornadoTexture SOLO para el
// escudo (placeholderIcon === 'shield'), y ocupa también el margen que en el resto de
// las láminas es el "cartón" blanco (ver cardCrestGlued) — el escudo no lleva ese
// borde, la textura llega hasta el recorte recto de la carta entera. Es un asset
// local (require, como el resto de PLACEHOLDER_IMAGES) a propósito: bundleada en la
// app, no pasa por R2/red — así no hay nada que cachear aparte, el propio bundle ya la
// trae, y una sola imagen decodificada se reusa entre todas las láminas de escudo
// montadas a la vez (a diferencia de un patrón vectorial con cientos de paths, que acá
// hubiera sido demasiado pesado por lámina).
const PRISMATIC_TEXTURE = require('../../assets/textures/prismatic.png');

// Cuántas láminas entran por página — una página de álbum de verdad no "fluye" con la
// cantidad de jugadores, siempre muestra el mismo tanto de láminas del mismo tamaño; si
// un equipo tiene más, sigue en la página siguiente (ver buildAlbumPages más abajo).
// Grilla de 3 de ancho x 2 de alto (ver styles.gridCard).
const CARDS_PER_PAGE = 6;

// Duración del deslizamiento de página (goToPage y el swipe soltado más allá del
// umbral, ver más abajo) — lo bastante lento como para que se note que la página de
// atrás ya estaba ahí, en vez de sentirse como un parpadeo.
const PAGE_TRANSITION_MS = 750;

// Fondo de LÁMINA: "Sun Tornado" de SVGBackgrounds.com, con el color de CADA equipo
// (igual criterio que el fondo de página, ver VanishingStripesBackground más abajo) —
// escudo/DT/capitán son la excepción, van con PRISMATIC_TEXTURE en vez de esto (ver
// StickerCard). Uso gratuito con atribución en el código en vez de visible en pantalla,
// permitido acá: https://www.svgbackgrounds.com/attribution/
// Patrón: https://www.svgbackgrounds.com/set/free-svg-backgrounds-and-patterns/#sun-tornado
interface SunTornadoTones {
  base: string;
  bright: string;
}

// `bright` es directamente el color del equipo (como antes lo era el rojo fijo
// SUN_TORNADO_BRIGHT) y `base` su versión bien oscura (mezclada 85% hacia negro) —
// misma proporción que tenía el par fijo original (#dc2626 / #1a0505).
function buildSunTornadoTones(hex: string): SunTornadoTones {
  return { base: shadeHex(hex, 0.85), bright: hex };
}

// El pétalo que se repite (escalado/rotado) para armar el remolino — geometría fija de
// SVGBackgrounds.com, no depende del color.
const SUN_TORNADO_PETAL_D =
  'M1549.2 51.6c-5.4 99.1-20.2 197.6-44.2 293.6c-24.1 96-57.4 189.4-99.3 278.6c-41.9 89.2-92.4 174.1-150.3 253.3c-58 79.2-123.4 152.6-195.1 219c-71.7 66.4-149.6 125.8-232.2 177.2c-82.7 51.4-170.1 94.7-260.7 129.1c-90.6 34.4-184.4 60-279.5 76.3C192.6 1495 96.1 1502 0 1500c96.1-2.1 191.8-13.3 285.4-33.6c93.6-20.2 185-49.5 272.5-87.2c87.6-37.7 171.3-83.8 249.6-137.3c78.4-53.5 151.5-114.5 217.9-181.7c66.5-67.2 126.4-140.7 178.6-218.9c52.3-78.3 96.9-161.4 133-247.9c36.1-86.5 63.8-176.2 82.6-267.6c18.8-91.4 28.6-184.4 29.6-277.4c0.3-27.6 23.2-48.7 50.8-48.4s49.5 21.8 49.2 49.5c0 0.7 0 1.3-0.1 2L1549.2 51.6z';

// Escala/rotación de cada copia del pétalo dentro de UN brazo del remolino (15 copias,
// de más chica a más grande) — el remolino completo son 3 brazos iguales a estos,
// repartidos cada 120°.
const SUN_TORNADO_PETALS: { scale: number; rotate: number }[] = [
  { scale: 0.12, rotate: 60 },
  { scale: 0.2, rotate: 10 },
  { scale: 0.25, rotate: 40 },
  { scale: 0.3, rotate: -20 },
  { scale: 0.4, rotate: -30 },
  { scale: 0.5, rotate: 20 },
  { scale: 0.6, rotate: 60 },
  { scale: 0.7, rotate: 10 },
  { scale: 0.835, rotate: -40 },
  { scale: 0.9, rotate: 40 },
  { scale: 1.05, rotate: 25 },
  { scale: 1.2, rotate: 8 },
  { scale: 1.333, rotate: -60 },
  { scale: 1.45, rotate: -30 },
  { scale: 1.6, rotate: 10 },
];

// Radios de los círculos concéntricos del "sol" central (mitad de ellos a 50% opacidad,
// ver SunTornadoTexture) — de más grande a más chico.
const SUN_TORNADO_RINGS = [2000, 1800, 1700, 1651, 1450, 1250, 1175, 900, 750, 500, 380, 250];

// `uid` único entre láminas montadas a la vez (misma razón que en VanishingStripesBackground
// más abajo: los ids de <RadialGradient>/<LinearGradient>/<Path> son globales). `tones`
// es el par base/bright ya calculado para el color de ESE equipo (ver buildSunTornadoTones).
function SunTornadoTexture({ uid, tones }: { uid: string; tones: SunTornadoTones }) {
  const sunId = `sun-${uid}`;
  const petalId = `petal-${uid}`;
  const petalFillId = `petalfill-${uid}`;
  const armId = `arm-${uid}`;

  return (
    <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%" viewBox="0 0 2000 1500" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <RadialGradient id={sunId} gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={tones.bright} />
          <Stop offset="1" stopColor={tones.base} />
        </RadialGradient>
        <LinearGradient id={petalFillId} gradientUnits="userSpaceOnUse" x1="0" y1="750" x2="1550" y2="750">
          <Stop offset="0" stopColor={shadeHex(tones.base, -0.35)} />
          <Stop offset="1" stopColor={tones.base} />
        </LinearGradient>
        <Path id={petalId} fill={`url(#${petalFillId})`} d={SUN_TORNADO_PETAL_D} />
        <G id={armId}>
          {SUN_TORNADO_PETALS.map((p, i) => (
            <Use key={i} href={`#${petalId}`} transform={`scale(${p.scale}) rotate(${p.rotate})`} />
          ))}
        </G>
      </Defs>

      <G transform="translate(1000 750)">
        <Circle fill={`url(#${sunId})`} r={3000} />
        <G opacity={0.5}>
          {SUN_TORNADO_RINGS.map((r) => (
            <Circle key={r} fill={`url(#${sunId})`} r={r} />
          ))}
        </G>
        <G transform="rotate(-136.8 0 0)">
          <Use href={`#${armId}`} transform="rotate(10)" />
          <Use href={`#${armId}`} transform="rotate(120)" />
          <Use href={`#${armId}`} transform="rotate(240)" />
        </G>
      </G>
    </Svg>
  );
}

// Fondo de PÁGINA: "Vanishing Stripes" de SVGBackgrounds.com, con el color de CADA
// equipo (a diferencia del fondo de lámina, fijo — ver SunTornadoTexture) — mismo trato
// de atribución que arriba.
// Patrón: https://www.svgbackgrounds.com/set/free-svg-backgrounds-and-patterns/#vanishing-stripes
interface VanishingStripesTones {
  bg: string;
  bright: string;
  dim: string;
}

// El fondo tiene que quedar bien oscuro (0.7) para que el scrim de la página
// (styles.pageScrim) no lo termine aplastando a gris — incluso equipos con colores
// claros de la paleta necesitan ese piso oscuro para que el blanco del texto se seiga
// leyendo encima. `bright`/`dim` son los 2 extremos del degradé de las rayas: de la más
// gruesa (bright, casi el color real del equipo) a la más fina (dim, ya bastante
// apagada) — ver VANISHING_STRIPES_LINES.
function buildVanishingStripesTones(hex: string): VanishingStripesTones {
  return {
    bg: shadeHex(hex, 0.7),
    bright: shadeHex(hex, 0.1),
    dim: shadeHex(hex, 0.45),
  };
}

// Portada del álbum: a diferencia de una página de equipo (un solo color de camiseta,
// buildVanishingStripesTones de arriba deriva los 3 tonos de ESE), acá el superusuario
// ya eligió 3 colores a mano en /admin/album (fondo, secundario y acento — ver el
// comentario grande de 1790700200_add_palette_to_albums.js). Se usan tal cual en vez de
// derivar todo de uno solo, para que la textura de la portada refleje la paleta
// completa que se ve en el panel, no solo un matiz del acento.
function buildAlbumCoverTones(palette: AlbumPalette): VanishingStripesTones {
  return {
    bg: shadeHex(palette.base, 0.7),
    bright: palette.accent,
    dim: palette.secondary,
  };
}

// Geometría fija de SVGBackgrounds.com (no depende del color): 17 grupos de líneas
// diagonales paralelas, de más gruesa (17px) a más fina (1px) — extraída 1 a 1 del SVG
// original (todas comparten x1=-8/x2=808, solo cambia el par y1/y2 de cada línea).
const VANISHING_STRIPES_LINES: { width: number; ys: [number, number][] }[] = [
  { width: 17, ys: [[-8, 808], [792, 1608], [-808, 8]] },
  { width: 16, ys: [[767, 1583], [17, 833], [-33, 783], [-783, 33]] },
  { width: 15, ys: [[742, 1558], [42, 858], [-58, 758], [-758, 58]] },
  { width: 14, ys: [[67, 883], [717, 1533], [-733, 83], [-83, 733]] },
  { width: 13, ys: [[92, 908], [692, 1508], [-108, 708], [-708, 108]] },
  { width: 12, ys: [[667, 1483], [117, 933], [-133, 683], [-683, 133]] },
  { width: 11, ys: [[642, 1458], [142, 958], [-158, 658], [-658, 158]] },
  { width: 10, ys: [[167, 983], [617, 1433], [-633, 183], [-183, 633]] },
  { width: 9, ys: [[592, 1408], [192, 1008], [-608, 208], [-208, 608]] },
  { width: 8, ys: [[567, 1383], [217, 1033], [-233, 583], [-583, 233]] },
  { width: 7, ys: [[242, 1058], [542, 1358], [-558, 258], [-258, 558]] },
  { width: 6, ys: [[267, 1083], [517, 1333], [-533, 283], [-283, 533]] },
  { width: 5, ys: [[292, 1108], [492, 1308], [-308, 508], [-508, 308]] },
  { width: 4, ys: [[467, 1283], [317, 1133], [-333, 483], [-483, 333]] },
  { width: 3, ys: [[342, 1158], [442, 1258], [-458, 358], [-358, 458]] },
  { width: 2, ys: [[367, 1183], [417, 1233], [-433, 383], [-383, 433]] },
  { width: 1, ys: [[392, 1208], [-408, 408]] },
];

// Interpolación lineal RGB entre `from` y `to` — misma fórmula que usa el generador de
// SVGBackgrounds.com para las rayas intermedias (verificado contra el SVG de ejemplo).
function lerpHex(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const clean = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(clean.substring(i, i + 2), 16) || 0);
  };
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const mix = (a: number, b: number) => Math.max(0, Math.min(255, Math.round(a + (b - a) * t)));
  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`;
}

// `uid` único entre páginas montadas a la vez (la actual + la vecina durante una
// transición) — mismo motivo que el resto de las texturas de esta pantalla.
function VanishingStripesBackground({ uid, tones }: { uid: string; tones: VanishingStripesTones }) {
  const steps = VANISHING_STRIPES_LINES.length;
  return (
    <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice">
      <Rect fill={tones.bg} width="100%" height="100%" />
      <G fill="none">
        {VANISHING_STRIPES_LINES.map((group, i) => {
          const color = lerpHex(tones.bright, tones.dim, i / (steps - 1));
          return (
            <G key={i} stroke={color} strokeWidth={group.width}>
              {group.ys.map(([y1, y2], j) => (
                <Line key={j} x1={-8} y1={y1} x2={808} y2={y2} />
              ))}
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

// La lámina en sí: reutiliza siempre una foto/escudo ya existente (nunca se genera una
// imagen nueva) — sin bordes ni sombras marcadas de color (DESIGN.md), con esquinas
// RECTAS (sin curva, borde recto en todo el contorno) y sin trazo/anillo alrededor: la
// carta tiene que leerse como un rectángulo recortado, no como una tarjeta con marco.
// Nunca muestra el código de figurita (0410, etc.) — solo la posición/rol en un chip,
// que es lo que de verdad identifica a una lámina de un vistazo.
// Estructura de afuera hacia adentro, calcada de una lámina de álbum física:
//   cardShadowWrap (sombra) > card (el "cartón" BLANCO, esquinas rectas, el padding
//   ES el margen grueso) > cardInner (la "foto impresa": también esquinas rectas, ahí
//   SÍ recortada — overflow hidden) con la textura roja/negra fija de la lámina
//   (SUN_TORNADO_BASE/BRIGHT, no el color del equipo: ese queda para el fondo de la página)
//   detrás de la foto/ícono.
// La foto ocupa cardInner completo (absoluteFill); si es un recorte con fondo
// transparente ("contain") la textura se ve alrededor como el "papel" de la lámina; si
// es una foto de plantel ("cover") llena el marco entero.
// `style` fija el tamaño (las 3 variantes de `status` SIEMPRE reciben el mismo, ver
// styles.gridCard) — nunca un ancho/alto propio, para que todas las láminas de una
// página midan exactamente lo mismo cualquiera sea su estado.
// `uid` tiene que ser único entre láminas que puedan estar montadas al mismo tiempo
// (todas las de una página, más las de la página vecina durante una transición) — ver
// el comentario de SunTornadoTexture/VanishingStripesBackground sobre por qué los ids
// de sus <RadialGradient>/<LinearGradient> no pueden repetirse.
//
// 3 estados, nunca una cantidad de copias (eso vive en la vista Láminas, no acá):
// `glued` (pegada — se ve la foto, sin más) / `unowned` (no la tenés — hueco gris con
// el código de la figurita que falta, sin marco) / `pegable` (la tenés suelta — se ve
// el MISMO hueco gris que `unowned`, no la foto: ya no hace falta mostrarla para saber
// qué va ahí, y así el gesto de pegar se siente igual de "misterioso" que abrir un
// sobre de verdad. Se distingue de `unowned` por un brillo animado en el marco
// (pegablePulse, un único loop por página) y porque toda la lámina es tocable —
// dispara `onPegar` sin un botón aparte).
type StickerStatus = 'glued' | 'unowned' | 'pegable';

// Fila de abajo de la lámina de jugador/DT: nombre del jugador — posición/DT, pegados
// al piso de la carta (mismo criterio que TeamTopRow, ver su comentario, pero
// espejado: acá las esquinas de ABAJO quedan en punta —calzan con el borde recto del
// piso de la lámina— y las de ARRIBA redondeadas, mirando hacia la foto). El cuadrado
// de posición SIEMPRE se pinta (a diferencia del escudo, que puede faltar) — un
// jugador sin posición asignada muestra un guion, nunca desaparece el cuadrado: así la
// lámina no "salta" de ancho según tenga o no posición. La única excepción es el
// plantel "de lado" (photoPair, ver más abajo): esa mitad no es un jugador, no lleva
// cuadrado — pero sí necesita el mismo truco de siempre para que su nombre cruce la
// costura entre sus 2 mitades como una sola lámina: un wrapper del ancho COMBINADO
// (cropFullWidth), corrido según el lado (cropOffset), para que cada mitad recorte
// (overflow hidden en cardInner) solo la porción que le toca de ese MISMO rectángulo.

// Ícono de la banda de capitán: un parche dorado con una "C", como la banda que se
// pone en el brazo — reemplaza el cuadrado de posición (ver PlayerBottomRow/isCaptain)
// en vez de compartir el espacio con él. Vector chico (Views, no un asset ni SVG
// aparte) porque a este tamaño (adentro de cardBottomSquare, ~28px) un ícono de
// verdad-armband no se leería mejor que el color + la letra, que es como de verdad se
// identifica a un capitán en una camiseta.
function CaptainArmband({ edgeRowHeight }: { edgeRowHeight: number }) {
  return (
    <View style={styles.captainArmband}>
      <Text style={[styles.captainArmbandText, { fontSize: cardBadgeFontSizeFor(edgeRowHeight) }]}>C</Text>
    </View>
  );
}

function PlayerBottomRow({
  name,
  cardWidth,
  edgeRowHeight,
  photoPair,
  badgeText,
  isCaptain,
}: {
  name: string;
  cardWidth: number;
  edgeRowHeight: number;
  photoPair?: PhotoPairCrop;
  badgeText?: string;
  // Reemplaza el cuadrado de posición por la banda de capitán (ver CaptainArmband) —
  // nunca los dos juntos, la posición del capitán no se pierde, solo deja de mostrarse
  // acá (sigue en team_players para quien la necesite).
  isCaptain?: boolean;
}) {
  const upper = name.toUpperCase();
  const words = upper.split(/\s+/).filter(Boolean);
  const boxWidth = photoPair ? photoPair.cropFullWidth : cardWidth;
  const reserved = photoPair ? 0 : edgeRowHeight + BADGE_NAME_GAP;
  const availableWidth = boxWidth - reserved - NAME_CHIP_PADDING_H * 2;
  const rowPaddingV = rowNamePaddingFor(edgeRowHeight);
  const availableHeight = edgeRowHeight - rowPaddingV * 2;
  const fontSize = fitFontSizeToRow(words, availableWidth, availableHeight, NAME_CHIP_FONT_SIZE);
  const rowStyle = [
    styles.cardBottomRow,
    { height: edgeRowHeight },
    photoPair ? { left: -photoPair.cropOffset, right: undefined, width: photoPair.cropFullWidth } : null,
  ];

  return (
    <View style={rowStyle} pointerEvents="none">
      <View style={[styles.cardBottomNameRect, { paddingVertical: rowPaddingV }]}>
        <Text style={[styles.cardBottomNameText, { fontSize }]} numberOfLines={NAME_CHIP_MAX_LINES}>{upper}</Text>
      </View>
      {!photoPair && (
        <View style={[styles.cardBottomSquare, { width: edgeRowHeight, padding: cardBadgePaddingFor(edgeRowHeight) }]}>
          {isCaptain ? (
            <CaptainArmband edgeRowHeight={edgeRowHeight} />
          ) : (
            <Text style={[styles.cardBadgeText, { fontSize: cardBadgeFontSizeFor(edgeRowHeight) }]}>{badgeText || '-'}</Text>
          )}
        </View>
      )}
    </View>
  );
}

// Nombre del equipo SOLO en la lámina de escudo: a diferencia del resto (PlayerBottomRow,
// TeamTopRow), acá no va dentro de un chip — flota directo sobre
// PRISMATIC_TEXTURE, centrado de punta a punta de la carta, así se lee como el título
// de la lámina y no como una etiqueta pegada en una esquina. Auto-achicado propio
// (fitCrestTeamNameFontSize) para no recortar nombres largos. El textShadow claro (en
// vez de uno oscuro, que se perdería contra el fondo pastel) es lo que le da el aire
// "grabado en la lámina" — un relieve sutil en vez de una letra plana.
function CrestTeamName({ name, cardWidth }: { name: string; cardWidth: number }) {
  const upper = name.toUpperCase();
  const words = upper.split(/\s+/).filter(Boolean);
  const availableWidth = cardWidth - NAME_CHIP_WRAP_INSET * 2;
  const fontSize = fitCrestTeamNameFontSize(words, availableWidth);
  return (
    <View style={styles.crestTeamNameWrap} pointerEvents="none">
      <Text style={[styles.crestTeamNameText, { fontSize }]} numberOfLines={NAME_CHIP_MAX_LINES}>{upper}</Text>
    </View>
  );
}

// Fila de arriba de la lámina de jugador/DT: escudo — nombre del equipo, pegados al
// techo de la carta, en una única fila flex (cardTopRow) de alto fijo para esa lámina
// (edgeRowHeight, ver cardEdgeRowHeightFor — no depende del texto). El nombre (cardTopNameRect) es un `flex: 1` que se queda con todo el ancho
// que sobra si no hay escudo. El tamaño de letra se recalcula con fitFontSizeToRow
// partiendo de TEAM_NAME_BAR_MAX_FONT_SIZE: nombres cortos quedan grandes, largos se
// achican y si hace falta pasan a una 2da línea — nunca se recorta ni desborda el alto
// fijo de la fila (a diferencia de un fit que solo mirara el ancho).
function TeamTopRow({
  name,
  cardWidth,
  edgeRowHeight,
  crestUri,
}: {
  name: string;
  cardWidth: number;
  edgeRowHeight: number;
  crestUri?: string | null;
}) {
  const upper = name.toUpperCase();
  const words = upper.split(/\s+/).filter(Boolean);
  const reserved = crestUri ? edgeRowHeight + BADGE_NAME_GAP : 0;
  const availableWidth = cardWidth - reserved - NAME_CHIP_PADDING_H * 2;
  const rowPaddingV = rowNamePaddingFor(edgeRowHeight);
  const availableHeight = edgeRowHeight - rowPaddingV * 2;
  const fontSize = fitFontSizeToRow(words, availableWidth, availableHeight, TEAM_NAME_BAR_MAX_FONT_SIZE);
  return (
    <View style={[styles.cardTopRow, { height: edgeRowHeight }]} pointerEvents="none">
      {!!crestUri && (
        <View style={[styles.cardTopSquare, { width: edgeRowHeight, padding: cardBadgePaddingFor(edgeRowHeight) }]}>
          <Image source={{ uri: crestUri }} style={styles.cardCrestBadgeImage} resizeMode="contain" />
        </View>
      )}
      <View style={[styles.cardTopNameRect, { paddingVertical: rowPaddingV }]}>
        <Text style={[styles.cardTopNameText, { fontSize }]} numberOfLines={NAME_CHIP_MAX_LINES}>{upper}</Text>
      </View>
    </View>
  );
}

// Esquinas de arriba de la lámina de plantel "de lado" (photoPair): a diferencia de
// TeamTopRow (una fila de punta a punta en UNA carta), acá cada mitad es su propia
// carta con su propio cuadrado suelto en SU esquina exterior — izquierda para el
// escudo, derecha para la categoría de la liga (masc/fem/mixto, ver
// categoryBadgeLabel) — sin rectángulo de nombre al medio: el nombre del equipo ya va
// en la fila de abajo, de costura a costura entre las 2 mitades (ver PlayerBottomRow).
// Mismo cuadrado negro que cardTopSquare (mismo tamaño, mismas esquinas redondeadas
// abajo) para que se lea como el mismo elemento de diseño que jugador/DT/escudo, solo
// que sin la fila de nombre al lado. El escudo se salta entero si el equipo no tiene
// uno (mismo criterio que TeamTopRow: sin escudo, sin cuadrado) — la categoría en
// cambio SIEMPRE se pinta, con "-" si la liga todavía no tiene una elegida (mismo
// criterio que el cuadrado de posición de PlayerBottomRow, que nunca desaparece).
function PhotoPairCornerBadge({
  side,
  edgeRowHeight,
  crestUri,
  categoryLabel,
}: {
  side: 'left' | 'right';
  edgeRowHeight: number;
  crestUri?: string | null;
  categoryLabel?: string;
}) {
  if (side === 'left' && !crestUri) return null;
  return (
    <View
      style={[
        styles.cardTopSquare,
        { width: edgeRowHeight, height: edgeRowHeight, padding: cardBadgePaddingFor(edgeRowHeight) },
        side === 'left' ? styles.photoPairCornerLeft : styles.photoPairCornerRight,
      ]}
      pointerEvents="none"
    >
      {side === 'left' ? (
        <Image source={{ uri: crestUri! }} style={styles.cardCrestBadgeImage} resizeMode="contain" />
      ) : (
        <Text style={[styles.cardBadgeText, { fontSize: cardBadgeFontSizeFor(edgeRowHeight) }]}>{categoryLabel || '-'}</Text>
      )}
    </View>
  );
}

function StickerCard({
  uid,
  code,
  name,
  teamName,
  hideBottomChip,
  imageUri,
  placeholderIcon,
  status,
  onPegar,
  onPreview,
  badgeText,
  imageResizeMode = 'contain',
  style,
  photoPair,
  teamCrestUri,
  teamColor,
  specialTexture,
  isCaptain,
  pegablePulse,
  categoryLabel,
}: {
  uid: string;
  code?: string | null;
  name: string;
  // Jugador/DT/escudo la llevan — ver el comentario de StickerSlot.
  teamName?: string;
  // Solo el escudo la usa — ver el comentario de StickerSlot.
  hideBottomChip?: boolean;
  imageUri: string | null;
  placeholderIcon: keyof typeof Feather.glyphMap;
  status: StickerStatus;
  onPegar?: () => void;
  // Abre el modal de previsualización en grande — solo lo reciben láminas `glued`
  // (ver TeamAlbumPage): `pegable` ya tiene su propio gesto de tocar (pegar, a
  // propósito "misterioso" — ver el comentario de status más abajo) y `unowned` no
  // tiene foto que agrandar.
  onPreview?: () => void;
  badgeText?: string;
  imageResizeMode?: 'contain' | 'cover';
  style?: StyleProp<ViewStyle>;
  // Cuando está seteado, esta lámina es una de las 2 mitades del plantel "de lado"
  // (ver StickerSlot/PhotoPairCrop): sin margen del lado que toca a su par, y la foto
  // recortada a esa mitad exacta para que ambas, juntas, formen una imagen continua.
  photoPair?: PhotoPairCrop;
  // Ver el comentario de StickerSlot — solo jugador/DT lo pintan.
  teamCrestUri?: string | null;
  // Color del equipo dueño de esta lámina — pinta el fondo SunTornado (ver
  // buildSunTornadoTones). Sin equipo (ninguna lámina de esta pantalla debería llegar
  // así, pero por las dudas) cae al gris de FALLBACK_TEAM_COLOR.
  teamColor?: string | null;
  // Fuerza la textura prismática del escudo (PRISMATIC_TEXTURE) en vez del SunTornado
  // de color de equipo — la usan DT y capitán, para distinguirse del resto del plantel
  // igual que ya distinguía al escudo (ver StickerSlot).
  specialTexture?: boolean;
  // Reemplaza el cuadrado de posición por la banda de capitán (ver CaptainArmband en
  // PlayerBottomRow) — solo el capitán la lleva, el DT sigue con su badge de texto.
  isCaptain?: boolean;
  // Valor animado COMPARTIDO por toda la página (un solo loop de opacidad, ver
  // TeamAlbumPage) para el brillo del marco "pegable" — nunca uno por lámina, para no
  // multiplicar loops de animación cuando hay varias pegables juntas en la grilla.
  pegablePulse?: Animated.Value;
  // Categoría de la liga (masc/fem/mixto), ya abreviada — ver categoryBadgeLabel. Solo
  // la mitad DERECHA del plantel la pinta (ver PhotoPairCornerBadge); el resto de
  // láminas no la recibe.
  categoryLabel?: string;
}) {
  const sizeStyle = style || { width: CARD_WIDTH, height: CARD_HEIGHT };
  // TeamTopRow/PlayerBottomRow necesitan el ancho en un número, no en un StyleProp —
  // todos los llamadores reales pasan un objeto plano con `width` numérico (ver el
  // comentario de abajo), pero por las dudas cae a CARD_WIDTH si alguna vez no es así.
  const cardWidthNum = typeof (sizeStyle as ViewStyle)?.width === 'number' ? ((sizeStyle as ViewStyle).width as number) : CARD_WIDTH;
  // Mismo criterio que cardWidthNum, pero de alto — de acá sale el alto REAL de los
  // cuadrados/rectángulos de borde (ver cardEdgeRowHeightFor) para que escalen con el
  // tamaño real de la lámina en vez de un px fijo (ver su comentario).
  const cardHeightNum = typeof (sizeStyle as ViewStyle)?.height === 'number' ? ((sizeStyle as ViewStyle).height as number) : CARD_HEIGHT;
  const cardMargin = cardMarginFor(cardWidthNum);
  const edgeRowHeight = cardEdgeRowHeightFor(cardHeightNum);
  // El padding del "cartón" blanco se calcula ACÁ, en un solo objeto, y no se reparte
  // entre este valor dinámico y las clases estáticas cardUnowned/cardCrestGlued/
  // cardPairLeft/cardPairRight que existían antes: React Native Web resuelve un objeto
  // de estilo "fresco" (uno nuevo en cada render, como éste, en vez de un objeto ya
  // registrado con StyleSheet.create) aplicándolo como estilo INLINE de verdad, que en
  // CSS le gana a CUALQUIER clase sin importar el orden en el array de `style` — así
  // que un `paddingRight: 0` de una clase estática nunca lograba pisar a un
  // `padding: cardMargin` inline puesto ANTES en el array (quedaba la costura entre las
  // 2 mitades del plantel con el margen de las 2, en vez de tocarse sin borde). Calcular
  // acá los 4 lados a mano evita mezclar una clase estática con un valor dinámico para
  // la MISMA propiedad.
  const isPairLeft = !!photoPair && !photoPair.standalone && photoPair.side === 'left';
  const isPairRight = !!photoPair && !photoPair.standalone && photoPair.side === 'right';
  // Sin "cartón" (padding 0) en los mismos 2 casos que antes cubrían cardUnowned/
  // cardCrestGlued: no la tenés / la tenés suelta (hueco gris sin marco) y el escudo
  // pegado (la textura prismática ocupa también ese margen).
  const hasCarton = status !== 'unowned' && status !== 'pegable' && !(placeholderIcon === 'shield' && status === 'glued');
  const cardPaddingStyle: ViewStyle = !hasCarton
    ? { padding: 0 }
    : isPairLeft
    ? { paddingTop: cardMargin, paddingRight: 0, paddingBottom: cardMargin, paddingLeft: cardMargin }
    : isPairRight
    ? { paddingTop: cardMargin, paddingRight: cardMargin, paddingBottom: cardMargin, paddingLeft: 0 }
    : { padding: cardMargin };

  // El tamaño SIEMPRE va en un wrapper de afuera sin flex propio (cardShadowWrap) —
  // nunca directo en `styles.card`, que trae `flex: 1` pensado para rellenar ESE
  // wrapper. Puesto directo como hijo de una grilla `flexDirection: 'row'`
  // (fixedGrid), ese `flex: 1` pisa el ancho fijo (45%) y una lámina de otro estado
  // terminaría con un tamaño distinto al de sus hermanas — por eso los 3 estados
  // comparten exactamente la misma cadena de wrappers.
  return (
    <View style={[styles.cardShadowWrap, sizeStyle]}>
      {/* TouchableOpacity siempre (nunca un View condicional): `disabled` sin
          `onPreview` la deja pasar el toque de largo, como si fuera un View — así una
          StickerCard glued SIN onPreview (el sobre de "Tu sobre", que ya trae su
          propio TouchableOpacity para avanzar de lámina) no le roba el toque al de
          afuera con un touchable de más. */}
      <TouchableOpacity
        activeOpacity={onPreview ? 0.85 : 1}
        disabled={!onPreview}
        onPress={onPreview}
        style={[
          styles.card,
          cardPaddingStyle,
          (status === 'unowned' || status === 'pegable') && styles.cardUnowned,
          placeholderIcon === 'shield' && status === 'glued' && styles.cardCrestGlued,
        ]}
      >
        <View style={styles.cardInner}>
          {status === 'unowned' ? (
            <View style={styles.cardEmpty}>
              <Text style={styles.cardNameEmpty} numberOfLines={1}>{code}</Text>
            </View>
          ) : status === 'pegable' ? (
            // La tenés suelta, pero acá se ve igual que el hueco vacío (cardEmpty) en
            // vez de la foto — ya no hace falta mostrarla para saber "qué va acá", con
            // el álbum entero ya identificás la lámina por dónde está. El brillo del
            // marco (pegablePulse, un único loop por página — ver TeamAlbumPage) es lo
            // que distingue esto de un hueco realmente vacío: "esta sí la tenés, tocá
            // para pegarla" — un solo toque en cualquier parte de la lámina, sin el
            // botón "Pegar" aparte de antes.
            <TouchableOpacity activeOpacity={0.75} onPress={onPegar} style={styles.cardEmpty}>
              {!!pegablePulse && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.cardPegableGlow,
                    { opacity: pegablePulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] }) },
                  ]}
                />
              )}
              <Feather name="plus-circle" size={26} color={theme.colors.primary} />
              <Text style={styles.cardNameEmpty} numberOfLines={1}>{code}</Text>
            </TouchableOpacity>
          ) : (
            <>
              {placeholderIcon === 'shield' || specialTexture ? (
                // width/height 100% explícitos, no solo absoluteFillObject: un
                // require() local trae el ancho/alto real del archivo (960x960) y RN
                // Web lo usa como tamaño por defecto si el style no fija uno propio —
                // "inset: 0" solo no alcanza (mismo caso que el placeholder de abajo).
                // Sin esto, el texture se pintaba a su tamaño real y "cover" recortaba
                // desde ahí en vez de desde el tamaño ya achicado de la lámina: se veía
                // como muchísimo más zoom del que corresponde.
                <Image
                  source={PRISMATIC_TEXTURE}
                  style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
                  resizeMode="cover"
                />
              ) : (
                <SunTornadoTexture uid={`card-${uid}`} tones={buildSunTornadoTones(teamColor || FALLBACK_TEAM_COLOR.value)} />
              )}
              {(() => {
                // El placeholder también tiene que pasar por el recorte de mitades
                // (photoPair) cuando corresponde — si no, las 2 láminas del plantel
                // mostraban cada una la imagen COMPLETA en vez de su mitad, dos copias
                // idénticas en vez de una sola foto continua partida al medio.
                const source = imageUri ? { uri: imageUri } : (PLACEHOLDER_IMAGES[placeholderIcon] ?? PLACEHOLDER_IMAGES.user);
                if (photoPair) {
                  return (
                    <Image
                      source={source}
                      resizeMode={imageUri ? imageResizeMode : 'cover'}
                      // height: '100%' explícito por el mismo motivo que el caso de
                      // abajo — un placeholder local (require) trae su alto real y se
                      // lo queda en vez de estirarse con top/bottom:0 al alto real de
                      // la fila (802px de foto en una fila de ~180px, sin recortar).
                      style={{ position: 'absolute', top: 0, bottom: 0, left: -photoPair.cropOffset, width: photoPair.cropFullWidth, height: '100%' }}
                    />
                  );
                }
                const image = imageUri ? (
                  <Image source={source} style={StyleSheet.absoluteFillObject} resizeMode={imageResizeMode} />
                ) : (
                  // "cover" para persona (a diferencia de escudo/plantel, que siguen en
                  // "contain" para no recortar su arte): con "contain", el cuadrado del
                  // placeholder queda con barras arriba/abajo dentro del marco redondeado
                  // (personPhotoFrame) — el borde recto de esas barras no toca el borde
                  // del marco, así que el recorte con esquinas redondeadas no lo alcanza y
                  // se ven puntas cuadradas flotando adentro.
                  // El width/height 100% explícito es necesario acá (a diferencia del
                  // resto de las <Image> de esta lámina, que solo llevan absoluteFillObject):
                  // un `require(...)` local trae el ancho/alto real del archivo ya
                  // resuelto por Metro, y RN Web lo usa como tamaño por defecto cuando
                  // el style no fija un ancho/alto explícito — "inset: 0" solo no alcanza
                  // para pisar ese tamaño intrínseco.
                  <Image
                    source={source}
                    style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
                    resizeMode={(placeholderIcon === 'user' || placeholderIcon === 'clipboard') ? 'cover' : 'contain'}
                  />
                );
                // La foto de una persona (jugador/DT) va enmarcada, separada de los
                // bordes de la lámina y con las esquinas bien redondeadas — a
                // diferencia de escudo/plantel, que se leen mejor llenando el marco.
                // Adentro, personPhotoInner fuerza un cuadrado (aspectRatio: 1) más
                // chico que el marco — deja ver la textura de la lámina como espacio
                // arriba/abajo, en vez de la foto rellenando el marco entero.
                if (placeholderIcon === 'user' || placeholderIcon === 'clipboard') {
                  return (
                    <View style={styles.personPhotoFrame}>
                      <View style={styles.personPhotoInner}>{image}</View>
                    </View>
                  );
                }
                // El escudo necesita margen a los lados y sobre todo arriba: el chip
                // con el nombre del equipo (CrestTeamName) flota encima de esta misma
                // lámina, y sin este margen el arte del escudo podía llegar hasta el
                // borde y cruzarse con el chip.
                if (placeholderIcon === 'shield') {
                  return <View style={styles.crestFrame}>{image}</View>;
                }
                return image;
              })()}

              {/* El escudo lleva su propio CrestTeamName (ver comentario ahí) — sin
                  chip, centrado de punta a punta. El resto (jugador/DT) lleva la fila
                  de arriba de siempre (TeamTopRow): escudo — nombre. */}
              {!!teamName && (placeholderIcon === 'shield' ? (
                <CrestTeamName name={teamName} cardWidth={cardWidthNum} />
              ) : (
                <TeamTopRow name={teamName} cardWidth={cardWidthNum} edgeRowHeight={edgeRowHeight} crestUri={teamCrestUri} />
              ))}

              {/* La lámina de plantel no lleva teamName (su nombre va abajo, ver el
                  comentario de StickerSlot), así que no pasa por TeamTopRow — sus
                  cuadrados de esquina (escudo/categoría) van acá, uno por mitad, ver
                  PhotoPairCornerBadge. */}
              {!!photoPair && (
                <PhotoPairCornerBadge side={photoPair.side} edgeRowHeight={edgeRowHeight} crestUri={teamCrestUri} categoryLabel={categoryLabel} />
              )}

              {/* La fila de abajo se salta solo si hideBottomChip lo pide (el escudo,
                  que ya tiene su nombre real arriba) — la mitad del plantel (photoPair)
                  SÍ la lleva, pero PlayerBottomRow la dibuja "de costura a costura"
                  entre las 2 mitades (ver su comentario) en vez de repetida en cada
                  una. */}
              {(!!photoPair || !hideBottomChip) && (
                <PlayerBottomRow
                  name={name}
                  cardWidth={cardWidthNum}
                  edgeRowHeight={edgeRowHeight}
                  photoPair={photoPair}
                  badgeText={badgeText}
                  isCaptain={isCaptain}
                />
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

// Los datos ya calculados para dibujar UNA lámina. Orden fijo de un equipo: escudo +
// plantel "de lado" SIEMPRE arman la fila 1 completa (3 columnas); la fila 2 arranca
// con DT (si el equipo tiene uno asignado — si no, no aparece ninguna lámina en su
// lugar, a diferencia de escudo/plantel que siempre se muestran con placeholder) y el
// capitán (si hay uno asignado — su MISMA lámina de jugador, con su código/slotNumber
// de siempre, solo corrida al frente de la lista; ya no existe una carta de capitán
// aparte, ver backend/pb_hooks/album.pb.js), y se completa con jugadores normales. Si
// no hay ni DT ni capitán, la fila 2 arranca directo con jugadores. El resto del
// plantel sigue en páginas normales de a CARDS_PER_PAGE, agrupado por posición.
//
// El "plantel de lado" son DOS láminas de verdad (dos StickerSlot, cada una del mismo
// ancho que cualquier otra — ni una ocupa 2 columnas), no una sola lámina ancha: así
// se ven como 2 figuritas físicas puestas una al lado de la otra, típico de álbum,
// cada una con su propio margen/sombra en los 3 lados de afuera y SIN margen en el
// lado que toca a su par — la foto se recorta a la mitad exacta que le toca a cada
// una (ver photoPairSide/photoPair más abajo) para que, juntas, se sigan viendo como
// una sola imagen continua.
interface StickerSlot {
  code: string | null;
  name: string;
  // Jugador/DT/escudo la llevan (el escudo también "es" del equipo) — plantel no,
  // porque ya se ve entero en la propia foto, no hace falta repetir el nombre arriba.
  teamName?: string;
  // Solo el escudo la usa: su chip de abajo ("ESCUDO") no decía nada útil una vez que
  // ya tiene el nombre real del equipo arriba (teamName) — ver buildTeamSlots.
  hideBottomChip?: boolean;
  imageUri: string | null;
  placeholderIcon: keyof typeof Feather.glyphMap;
  status: StickerStatus;
  badgeText?: string;
  imageResizeMode?: 'contain' | 'cover';
  // Marca las 2 mitades del plantel "de lado" — ver comentario de arriba. El recorte
  // exacto de la foto (offset/ancho en px) lo calcula TeamAlbumPage en el momento de
  // pintar (ahí se conoce el ancho real de columna), no acá.
  photoPairSide?: 'left' | 'right';
  // Escudo del equipo en miniatura, para el badge de la esquina superior derecha de
  // jugador/DT (ver StickerCard) — no lo lleva la lámina de escudo/plantel, que ya SON
  // el escudo/la foto del equipo.
  teamCrestUri?: string | null;
  // Color del equipo dueño de esta lámina — ver el comentario de teamColor en StickerCard.
  teamColor?: string | null;
  // DT y capitán la llevan (ver el comentario de specialTexture en StickerCard) — el
  // escudo no la necesita, ya va siempre por placeholderIcon === 'shield'.
  specialTexture?: boolean;
  // Solo el capitán la lleva (ver el comentario de isCaptain en StickerCard) — el DT
  // también usa specialTexture pero sigue mostrando su badge de texto ("DT"), no la
  // banda.
  isCaptain?: boolean;
  // Categoría de la liga (masc/fem/mixto), ya abreviada — ver categoryBadgeLabel. Solo
  // las 2 mitades del plantel la llevan (ver PhotoPairCornerBadge en StickerCard).
  categoryLabel?: string;
}

// Recorte calculado de la foto de plantel para UNA mitad del par — `cropFullWidth` es
// el ancho total "sin el hueco del medio" (las 2 mitades más angostas por el margen
// que no llevan de ese lado) y `cropOffset` es cuánto desplazar esa imagen completa
// hacia la izquierda para que esta mitad muestre justo su porción.
interface PhotoPairCrop {
  side: 'left' | 'right';
  cropOffset: number;
  cropFullWidth: number;
  // El reveal del sobre (ver "Tu sobre" en LeagueAlbumScreen) muestra esta misma mitad
  // SOLA, sin su par al lado — necesita el recorte (para que sea "media foto" y no la
  // panorámica entera achicada), pero SIN el margen blanco del lado que normalmente
  // toca al par (quedaría con un borde blanco de menos, sin sentido si no hay una
  // mitad al lado que lo compense). El nombre de abajo SÍ se sigue recortando igual
  // que en la grilla (PlayerBottomRow no distingue standalone): la gracia es que se
  // vea fiel a como se ve la lámina en el plantel, con el nombre cortado a la mitad
  // exacta que le toca a este lado — no el template de nombre completo de un jugador.
  standalone?: boolean;
}

// Datos ya resueltos para mostrar UNA lámina en grande (modal de previsualización) —
// mismo set de props que StickerCard necesita, sea la lámina de una página del álbum
// (StickerSlot) o de una fila de la vista Láminas (LooseItem): ambas se normalizan a
// esto antes de abrir el modal, así el modal en sí no necesita saber de dónde vino.
interface PreviewSticker {
  code: string | null;
  name: string;
  teamName?: string;
  hideBottomChip?: boolean;
  imageUri: string | null;
  placeholderIcon: keyof typeof Feather.glyphMap;
  imageResizeMode?: 'contain' | 'cover';
  teamCrestUri?: string | null;
  teamColor?: string | null;
  specialTexture?: boolean;
  isCaptain?: boolean;
  badgeText?: string;
  photoPair?: PhotoPairCrop;
  categoryLabel?: string;
}

// Convierte una StickerSlot de la grilla del álbum a PreviewSticker — `photoPair` se
// pasa aparte (no vive en StickerSlot) porque el recorte depende de en qué contexto se
// pidió el preview (ver standalonePairCrop, más abajo: la mitad del plantel se
// previsualiza SOLA, no junto a su par).
function slotToPreview(slot: StickerSlot, photoPair?: PhotoPairCrop): PreviewSticker {
  return {
    code: slot.code,
    name: slot.name,
    teamName: slot.teamName,
    hideBottomChip: slot.hideBottomChip,
    imageUri: slot.imageUri,
    placeholderIcon: slot.placeholderIcon,
    imageResizeMode: slot.imageResizeMode,
    teamCrestUri: slot.teamCrestUri,
    teamColor: slot.teamColor,
    specialTexture: slot.specialTexture,
    isCaptain: slot.isCaptain,
    badgeText: slot.badgeText,
    photoPair,
    categoryLabel: slot.categoryLabel,
  };
}

// Recorte para previsualizar SOLA una mitad del plantel "de lado" — misma fórmula que
// usa el reveal del sobre (ver photoHalfCrop en el modal "Tu sobre"), reutilizada acá
// porque el preview de la grilla la necesita igual: mostrar la mitad de la foto de
// equipo en grande, sin su par al lado. `cardWidth` en px, NO relativo: cropOffset/
// cropFullWidth terminan como estilos absolutos (ver PlayerBottomRow/imagen de
// StickerCard), así que tienen que calcularse con el mismo ancho al que se va a
// renderizar la lámina (PREVIEW_CARD_WIDTH en el modal grande) o el recorte queda
// corrido/mal escalado.
function standalonePairCrop(side: 'left' | 'right', cardWidth: number): PhotoPairCrop {
  const innerWidth = cardWidth - cardMarginFor(cardWidth) * 2;
  return { side, standalone: true, cropOffset: side === 'left' ? 0 : innerWidth, cropFullWidth: innerWidth * 2 };
}

// pegada (glued) / no la tenés (unowned) / suelta lista para pegar (pegable) — nunca
// se deriva de esto cuántas copias de más hay, esa cuenta vive solo en la vista
// Láminas (looseCount, ver backend/pb_hooks/lib/album.js).
function stickerStatus(count: number, pasted: boolean): StickerStatus {
  if (pasted) return 'glued';
  return count > 0 ? 'pegable' : 'unowned';
}

// Categoría de la liga (masc/fem/mixto, elegida en /admin/album — ver
// backend/pb_hooks/admin_album.pb.js) abreviada para el cuadrado de esquina de la
// lámina de plantel (ver PhotoPairCornerBadge) — mismo largo de 3 letras que los
// badges de posición (POR/DEF/MED/DEL, ver POSITION_LABELS), y "-" si la liga todavía
// no tiene categoría elegida, igual criterio que "sin escudo" en otras láminas.
const CATEGORY_BADGE_LABELS: Record<string, string> = { masc: 'MAS', fem: 'FEM', mixto: 'MIX' };
function categoryBadgeLabel(category?: string | null): string {
  return (category && CATEGORY_BADGE_LABELS[category]) || '-';
}

// Escudo en miniatura para el badge de esquina de jugador/DT — '100x100f' porque el
// escudo puede no ser cuadrado (ver crestFrame/300x300f en la lámina de escudo). La
// usan tanto la grilla del álbum (buildTeamSlots) como el modal de "abrir sobre" para
// que las 2 vistas muestren siempre el mismo escudo, sin recalcularlo cada una a su
// manera.
function teamCrestBadgeUri(ref: { id: string; collectionId: string }, filename: string | null | undefined): string | null {
  return filename ? getFileUrl(ref, filename, '100x100f') : null;
}

function buildTeamSlots(t: AlbumTeam): StickerSlot[] {
  const teamRef = { id: t.team.id, collectionId: t.team.collectionId };
  const crestFilename = t.team.matchPhoto || t.team.avatar || '';
  const crestBadgeUri = teamCrestBadgeUri(teamRef, crestFilename);

  const playerSlot = (p: AlbumPlayer, pos?: PlayerPosition): StickerSlot => ({
    code: p.code,
    name: p.name,
    teamName: t.team.name,
    imageUri: p.photo ? getFileUrl({ id: p.id, collectionId: p.collectionId }, p.photo, PHOTO_THUMB) : null,
    placeholderIcon: 'user',
    // "cover", no el "contain" por defecto de StickerCard — PHOTO_THUMB es un recorte
    // cuadrado y el marco (personPhotoFrame) no lo es: con "contain" quedaba con barras
    // arriba/abajo que el recorte de esquinas redondeadas del marco no alcanzaba a tapar.
    imageResizeMode: 'cover',
    status: stickerStatus(p.count, p.pasted),
    badgeText: pos,
    teamCrestUri: crestBadgeUri,
    teamColor: t.team.teamColor,
    // El capitán lleva la textura prismática del escudo, igual que el DT (ver el
    // comentario grande sobre StickerSlot) — se distingue así del resto del plantel
    // en vez de solo por ir primero en la lista.
    specialTexture: p.isCaptain,
    // Reemplaza su cuadrado de posición por la banda de capitán (ver CaptainArmband).
    isCaptain: p.isCaptain,
  });

  const teamPhotoUri = t.team.teamPhoto ? getFileUrl(teamRef, t.team.teamPhoto) : null;

  // Fila 1, siempre: escudo (1 columna) + plantel "de lado", en DOS láminas iguales
  // (izquierda/derecha) — ver el comentario grande sobre StickerSlot.
  const slots: StickerSlot[] = [
    {
      code: t.crestCode,
      name: 'Escudo',
      // El chip de abajo se saca a propósito (hideBottomChip) — "ESCUDO" no decía
      // nada útil; en su lugar el escudo lleva el chip de arriba con el nombre real
      // del equipo (teamName), igual que jugador/DT.
      hideBottomChip: true,
      teamName: t.team.name,
      // El escudo puede no ser cuadrado (EditTeamScreen se lo permite explícitamente
      // al equipo), así que hace falta el thumb "fit" ('300x300f', sin recortar) y no
      // el crop centrado por defecto — ver migración 1790800000_fix_match_photo_crop_thumb.
      imageUri: crestFilename ? getFileUrl(teamRef, crestFilename, '300x300f') : null,
      placeholderIcon: 'shield',
      // Coleccionable como un jugador (ver backend/pb_hooks/album.pb.js) — antes
      // siempre "glued", ahora depende de si de verdad se sorteó y se pegó.
      status: stickerStatus(t.crestCount, t.crestPasted),
    },
    {
      code: t.photoLeftCode,
      // El chip de esta lámina lleva el nombre real del equipo, no la palabra
      // "Plantel" — PlayerBottomRow la dibuja "de costura a costura" entre las 2
      // mitades (ver el comentario de photoPair ahí), así que alcanza con ponerlo en
      // las 2.
      // Cada mitad es su propia figurita (código/count/pasted propios) — se pega por
      // separado, la otra mitad no se completa sola (ver backend/pb_hooks/album.pb.js).
      name: t.team.name,
      imageUri: teamPhotoUri,
      placeholderIcon: 'image',
      status: stickerStatus(t.photoLeftCount, t.photoLeftPasted),
      imageResizeMode: 'cover',
      photoPairSide: 'left',
      teamColor: t.team.teamColor,
      // Cuadrado de esquina superior izquierda (ver PhotoPairCornerBadge) — el mismo
      // escudo que usan jugador/DT, solo que acá va suelto en la esquina en vez de
      // acompañado de un nombre al lado.
      teamCrestUri: crestBadgeUri,
    },
    {
      code: t.photoRightCode,
      name: t.team.name,
      imageUri: teamPhotoUri,
      placeholderIcon: 'image',
      status: stickerStatus(t.photoRightCount, t.photoRightPasted),
      imageResizeMode: 'cover',
      photoPairSide: 'right',
      teamColor: t.team.teamColor,
      // Cuadrado de esquina superior derecha (ver PhotoPairCornerBadge): categoría de
      // la liga (masc/fem/mixto), elegida en /admin/album — "-" si todavía no la
      // eligieron (ver categoryBadgeLabel).
      categoryLabel: categoryBadgeLabel(t.league?.category),
    },
  ];

  // Fila 2 en adelante: DT (si hay) + capitán (si hay, es un jugador más) + el resto.
  if (t.dt) {
    slots.push({
      code: t.dtCode,
      name: t.dt.name,
      teamName: t.team.name,
      imageUri: t.dt.photo ? getFileUrl({ id: t.dt.id, collectionId: t.dt.collectionId }, t.dt.photo, PHOTO_THUMB) : null,
      placeholderIcon: 'clipboard',
      // Ver el comentario de playerSlot: "cover", no "contain", para que el recorte
      // redondeado de personPhotoFrame de verdad tape las esquinas de la foto.
      imageResizeMode: 'cover',
      // Coleccionable como un jugador (ver backend/pb_hooks/album.pb.js) — antes
      // siempre "glued", ahora depende de si de verdad se sorteó y se pegó.
      status: stickerStatus(t.dtCount, t.dtPasted),
      badgeText: 'DT',
      teamCrestUri: crestBadgeUri,
      teamColor: t.team.teamColor,
      // Misma textura prismática que el escudo (ver el comentario grande sobre
      // StickerSlot) — distingue al DT del resto del plantel.
      specialTexture: true,
    });
  }

  const captainPlayer = t.players.find((p) => p.isCaptain);
  const others = t.players.filter((p) => !p.isCaptain);
  if (captainPlayer) {
    // El badge/textura especial (specialTexture, ver playerSlot) ya lo distingue del
    // resto del plantel — el orden al frente de la lista es un plus, no la única señal.
    slots.push(playerSlot(captainPlayer, captainPlayer.position as PlayerPosition | undefined));
  }

  const byPosition: Partial<Record<PlayerPosition, AlbumPlayer[]>> = {};
  const rest: AlbumPlayer[] = [];
  others.forEach((p) => {
    const pos = p.position as PlayerPosition | undefined;
    if (pos && POSITION_ORDER.includes(pos)) {
      if (!byPosition[pos]) byPosition[pos] = [];
      byPosition[pos]!.push(p);
    } else {
      rest.push(p);
    }
  });

  POSITION_ORDER.forEach((pos) => {
    (byPosition[pos] || []).forEach((p) => slots.push(playerSlot(p, pos)));
  });
  rest.forEach((p) => slots.push(playerSlot(p)));

  return slots;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Una "página" del álbum es o bien la portada, o bien un tramo de láminas de UN
// equipo — un equipo con más jugadores de los que entran en una página sigue en la/s
// página/s siguiente/s, cada una con su propio encabezado de equipo.
type AlbumPage =
  | { kind: 'cover' }
  | { kind: 'team'; team: AlbumTeam; cards: StickerSlot[]; pageInTeam: number; totalPagesInTeam: number };

function buildAlbumPages(teams: AlbumTeam[]): AlbumPage[] {
  const pages: AlbumPage[] = [{ kind: 'cover' }];
  teams.forEach((t) => {
    // Ya no hace falta ningún corte especial para la página 1: escudo + las 2 mitades
    // del plantel son 3 ítems normales (1 columna cada uno) que llenan la fila 1 solos
    // — un chunk parejo de CARDS_PER_PAGE alcanza para todo.
    const chunks = chunk(buildTeamSlots(t), CARDS_PER_PAGE);
    chunks.forEach((cards, idx) => {
      pages.push({ kind: 'team', team: t, cards, pageInTeam: idx + 1, totalPagesInTeam: chunks.length });
    });
  });
  return pages;
}

// Un "tramo" del selector de "ir a una página": la portada, o el rango completo de
// páginas de UN equipo (puede ser más de una, ver buildAlbumPages/pageInTeam) — nunca
// una página team suelta de por medio, así el selector siempre salta al PRINCIPIO de
// un equipo, nunca a la mitad de su plantel.
interface AlbumSection {
  key: string;
  title: string;
  subtitle: string;
  startIndex: number;
  endIndex: number;
}

// El selector no es una lista plana de equipos: un álbum puede juntar varias ligas
// (Copa CDI masculina/mixta/femenina, ver el comentario grande al inicio de
// backend/pb_hooks/album.pb.js), que manda `teams` ya agrupado por liga (orden en que
// se eligieron al armar el álbum) y dentro de cada una por número de equipo. El header
// se inserta cada vez que la liga CAMBIA respecto del equipo anterior en vez de una
// sola vez al principio por las dudas — pero con el orden agrupado del backend, en la
// práctica cada liga aparece en un solo bloque contiguo.
type AlbumJumpEntry =
  | { kind: 'header'; key: string; label: string }
  | ({ kind: 'section' } & AlbumSection);

function buildAlbumSections(pages: AlbumPage[]): AlbumJumpEntry[] {
  const entries: AlbumJumpEntry[] = [];
  let lastLeagueId: string | null = null;
  pages.forEach((p, idx) => {
    if (p.kind === 'cover') {
      entries.push({ kind: 'section', key: 'cover', title: 'Portada', subtitle: `Página ${idx + 1}`, startIndex: idx, endIndex: idx });
      return;
    }
    if (p.pageInTeam !== 1) return; // ya contado en el section de la página 1 de este equipo
    const league = p.team.league;
    if (league && league.id !== lastLeagueId) {
      // El índice va en la key: la MISMA liga puede volver a aparecer más adelante
      // (ver el comentario de arriba) y cada reaparición necesita su propio header.
      entries.push({ kind: 'header', key: `league-${league.id}-${idx}`, label: league.name });
      lastLeagueId = league.id;
    }
    const endIndex = idx + p.totalPagesInTeam - 1;
    entries.push({
      kind: 'section',
      key: `team-${p.team.team.id}`,
      title: `${p.team.number}. ${p.team.team.name}`,
      subtitle: endIndex > idx ? `Páginas ${idx + 1}–${endIndex + 1}` : `Página ${idx + 1}`,
      startIndex: idx,
      endIndex,
    });
  });
  return entries;
}

function TeamAlbumPage({
  page,
  refreshing,
  onRefresh,
  onPegar,
  onPreview,
}: {
  page: Extract<AlbumPage, { kind: 'team' }>;
  refreshing: boolean;
  onRefresh: () => void;
  onPegar: (code: string) => void;
  onPreview: (sticker: PreviewSticker) => void;
}) {
  const { team: t, cards } = page;
  const crestData = { id: t.team.id, collectionId: t.team.collectionId, matchPhoto: t.team.matchPhoto, avatar: t.team.avatar };
  const color = getTeamColor(t.team.teamColor);

  // Ancho real de la grilla (mide su propio onLayout, no el de la página — el padding
  // de pageContent y el maxWidth de fixedGrid ya están aplicados en ese momento) — de
  // acá sale el ancho de columna (TODAS las láminas miden lo mismo, incluidas las 2
  // mitades del plantel) y, con GRID_CARD_ASPECT, el alto de toda la fila.
  const [gridWidth, setGridWidth] = useState(0);
  const colWidth = gridWidth > 0 ? (gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS : 0;
  const rowHeight = colWidth > 0 ? colWidth / GRID_CARD_ASPECT : 0;

  // Las 2 mitades del plantel miden EXACTAMENTE lo mismo que cualquier otra lámina
  // (colWidth) — nada se agranda. Lo que cambia es que se DESPLAZAN al centro para
  // tocarse sin espacio entre ellas; el espacio que dejan de ocupar en el medio no
  // desaparece, se reparte como espacio vacío a los 2 lados del par (ver el wrapper
  // centrado más abajo), no como láminas más anchas.
  const photoPairCrop = (side: 'left' | 'right'): PhotoPairCrop => {
    const innerWidth = colWidth - cardMarginFor(colWidth);
    const combinedWidth = innerWidth * 2;
    return { side, cropFullWidth: combinedWidth, cropOffset: side === 'left' ? 0 : innerWidth };
  };

  // Un único loop de opacidad para el brillo de TODAS las láminas "pegables" de esta
  // página (ver StickerCard/cardPegableGlow) — nunca uno por lámina: puede haber
  // varias pegables juntas y no tiene sentido correr varios requestAnimationFrame
  // haciendo exactamente lo mismo a la vez.
  const pegablePulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // useNativeDriver: false, igual que el resto de las animaciones de esta pantalla
    // (ver slideAnim más abajo) — react-native-web no soporta bien el driver nativo.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pegablePulse, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(pegablePulse, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pegablePulse]);

  return (
    <View style={styles.pageWrap}>
      <VanishingStripesBackground uid={t.team.id} tones={buildVanishingStripesTones(color.value)} />
      <View style={styles.pageScrim} />
      <ScrollView
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
      >
        <View style={[styles.teamHeader, { backgroundColor: color.value }]}>
          <TeamCrest team={crestData} size={64} />
          <View style={{ flex: 1 }}>
            {/* Sin numberOfLines a propósito (ver el mismo chip en StickerCard): el
                nombre del equipo no se recorta nunca, pasa a una 2da línea si hace
                falta. */}
            <Text style={[styles.teamHeaderName, { color: color.textOn }]}>{t.team.name.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.fixedGrid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {colWidth > 0 && (() => {
            // Las 2 mitades del plantel se envuelven juntas en un solo hijo de la
            // grilla, del mismo ancho total que ocuparían 2 láminas + 1 gap de siempre
            // (así el gap contra el escudo de al lado no cambia) — pero adentro, sin
            // gap propio y centradas: se tocan en el medio y el espacio que dejan de
            // usar ahí se reparte como espacio vacío a los 2 lados del par, no como
            // láminas más anchas (las 2 miden colWidth, igual que cualquier otra).
            const elements: React.ReactNode[] = [];
            let i = 0;
            while (i < cards.length) {
              const slot = cards[i];
              const next = cards[i + 1];
              if (slot.photoPairSide === 'left' && next?.photoPairSide === 'right') {
                elements.push(
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'center', width: colWidth * 2 + GRID_GAP }}>
                    <StickerCard
                      uid={`${t.team.id}-${i}`}
                      {...slot}
                      photoPair={photoPairCrop('left')}
                      onPegar={slot.status === 'pegable' && slot.code ? () => onPegar(slot.code!) : undefined}
                      onPreview={slot.status === 'glued' ? () => onPreview(slotToPreview(slot, standalonePairCrop('left', PREVIEW_CARD_WIDTH))) : undefined}
                      pegablePulse={pegablePulse}
                      style={{ width: colWidth, height: rowHeight }}
                    />
                    <StickerCard
                      uid={`${t.team.id}-${i + 1}`}
                      {...next}
                      photoPair={photoPairCrop('right')}
                      onPegar={next.status === 'pegable' && next.code ? () => onPegar(next.code!) : undefined}
                      onPreview={next.status === 'glued' ? () => onPreview(slotToPreview(next, standalonePairCrop('right', PREVIEW_CARD_WIDTH))) : undefined}
                      pegablePulse={pegablePulse}
                      style={{ width: colWidth, height: rowHeight }}
                    />
                  </View>
                );
                i += 2;
                continue;
              }
              elements.push(
                <StickerCard
                  key={i}
                  uid={`${t.team.id}-${i}`}
                  {...slot}
                  onPegar={slot.status === 'pegable' && slot.code ? () => onPegar(slot.code!) : undefined}
                  onPreview={slot.status === 'glued' ? () => onPreview(slotToPreview(slot)) : undefined}
                  pegablePulse={pegablePulse}
                  style={{ width: colWidth, height: rowHeight }}
                />
              );
              i++;
            }
            return elements;
          })()}
        </View>
      </ScrollView>
    </View>
  );
}

function CoverPage({
  data,
  palette,
  refreshing,
  onRefresh,
}: {
  data: AlbumData;
  palette: AlbumPalette;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  // "Conseguidas" cuenta láminas PEGADAS, no solo tenidas — el progreso del álbum es
  // justamente cuánto del libro está completo, y una figurita suelta sin pegar todavía
  // no llena ninguna página.
  const progress = useMemo(() => {
    let owned = 0;
    let total = 0;
    data.teams.forEach((t) => {
      // Escudo + las 2 mitades de la foto de equipo + el DT (si el equipo tiene uno
      // asignado) cuentan como figuritas coleccionables más (pegadas o no, igual que un
      // jugador — ver backend/pb_hooks/album.pb.js); si el equipo no tiene DT, no hay
      // ninguna lámina en su lugar (ni para tener ni para faltar). El capitán ya no es
      // una carta aparte: es un jugador más, ya contado en `players`.
      total += 3 + (t.dt ? 1 : 0) + t.players.length;
      owned += (t.dtPasted ? 1 : 0) + (t.crestPasted ? 1 : 0) + (t.photoLeftPasted ? 1 : 0) + (t.photoRightPasted ? 1 : 0);
      owned += t.players.filter((p) => p.pasted).length;
    });
    return { owned, total };
  }, [data]);

  return (
    <View style={styles.pageWrap}>
      <VanishingStripesBackground uid="cover" tones={buildAlbumCoverTones(palette)} />
      <View style={styles.pageScrim} />
      <ScrollView
        contentContainerStyle={[styles.pageContent, styles.coverContent]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
      >
        {data.album.cover ? (
          // CachedImage (expo-image) en vez del <Image> de react-native que usa el resto de
          // esta pantalla: la portada es la misma en cada visita, conviene que quede en disco
          // entre aperturas de la app en vez de volver a bajarla siempre (mismo motivo en
          // AlbumsListScreen.tsx).
          <CachedImage
            source={{ uri: getFileUrl(data.album, data.album.cover) }}
            style={styles.coverImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.coverBadge, { backgroundColor: palette.accent }]}>
            <Feather name="book" size={32} color="#ffffff" />
          </View>
        )}
        <Text style={styles.coverTitle}>{data.album.name}</Text>
        <Text style={styles.coverSub}>
          {data.teams.length} equipo{data.teams.length === 1 ? '' : 's'}
        </Text>
        <Text style={styles.coverProgress}>{progress.owned} / {progress.total}</Text>
      </ScrollView>
    </View>
  );
}

interface LooseItem {
  code: string;
  name: string;
  teamName: string;
  imageUri: string | null;
  placeholderIcon: keyof typeof Feather.glyphMap;
  loose: number;
  pasted: boolean;
  teamColor?: string;
  specialTexture?: boolean;
  isCaptain?: boolean;
  // Posición/DT y escudo del equipo — mismos datos que ya arma buildTeamSlots para la
  // misma lámina en la grilla, repetidos acá (no compartidos vía función) porque el
  // preview de esta fila necesita quedar tal cual se ve en el álbum (ver openPreview).
  badgeText?: string;
  teamCrestUri?: string | null;
}

// Recorre el AlbumData ya cargado y arma el inventario de "sueltas" (lo que no está
// pegado, incluyendo copias de más de algo que sí lo está) — sin pedirle nada nuevo al
// backend, GET /api/album ya trae count+pasted por código. Escudo/Plantel/DT nunca
// aparecen acá: siempre están pegados, nunca hay una copia de más que ofrecer. El
// capitán tampoco es un caso aparte: es un jugador más de `t.players`.
function buildLooseItems(data: AlbumData): LooseItem[] {
  const items: LooseItem[] = [];
  data.teams.forEach((t) => {
    const crestFilename = t.team.matchPhoto || t.team.avatar || '';
    const crestBadgeUri = teamCrestBadgeUri({ id: t.team.id, collectionId: t.team.collectionId }, crestFilename);
    t.players.forEach((p) => {
      const loose = p.count - (p.pasted ? 1 : 0);
      if (loose > 0) {
        const pos = p.position as PlayerPosition | undefined;
        items.push({
          code: p.code,
          name: p.name,
          teamName: t.team.name,
          imageUri: p.photo ? getFileUrl({ id: p.id, collectionId: p.collectionId }, p.photo, PHOTO_THUMB) : null,
          placeholderIcon: 'user',
          loose,
          pasted: p.pasted,
          teamColor: t.team.teamColor,
          specialTexture: p.isCaptain,
          isCaptain: p.isCaptain,
          badgeText: pos && POSITION_ORDER.includes(pos) ? pos : undefined,
          teamCrestUri: crestBadgeUri,
        });
      }
    });
  });
  return items;
}

// Vista "Láminas": todo lo que el usuario tiene SIN pegar (incluye copias de más de
// algo que ya está pegado) + comprar sobres. A diferencia de la vista Álbum, acá SÍ se
// muestra cuánto sobra de cada una — es justamente el inventario de intercambio, hoy
// sin la parte de intercambio (ver el comentario grande de más abajo).
function AlbumLaminasView({
  data,
  loggedIn,
  canAfford,
  buyingKind,
  onBuyPack,
  onPegar,
  onPreview,
  onGoToPage,
  onBack,
}: {
  data: AlbumData;
  loggedIn: boolean;
  canAfford: boolean;
  buyingKind: 'free' | 'bought' | 'beaudle-bonus' | null;
  onBuyPack: (kind: 'free' | 'bought' | 'beaudle-bonus') => void;
  onPegar: (code: string) => void;
  onPreview: (sticker: PreviewSticker) => void;
  onGoToPage: (code: string) => void;
  onBack: () => void;
}) {
  const looseItems = useMemo(() => buildLooseItems(data), [data]);
  const buying = buyingKind !== null;
  const freeAvailable = (data.freeRemaining ?? 0) > 0;
  const boughtAvailable = (data.boughtRemaining ?? 0) > 0;

  return (
    <ScrollView style={styles.laminasContainer} contentContainerStyle={styles.laminasContent}>
      <View style={styles.laminasHeader}>
        <TouchableOpacity style={styles.laminasBackBtn} onPress={onBack}>
          <Feather name="chevron-left" size={16} color={theme.colors.text} />
          <Text style={styles.laminasBackBtnText}>Álbum</Text>
        </TouchableOpacity>
        {data.beautokens !== null && <Text style={styles.balanceValue}>{data.beautokens} ℬ</Text>}
      </View>

      {!loggedIn ? (
        <TouchableOpacity style={[styles.buyBtn, styles.buyBtnDisabled]} disabled activeOpacity={1}>
          <Text style={styles.buyBtnText}>Inicia sesión para conseguir sobres</Text>
        </TouchableOpacity>
      ) : (
        // 3 orígenes de sobre por álbum, todos con su propio cupo diario (ver el
        // comentario grande de POST /api/album/buy-pack en album.pb.js): gratis,
        // comprado y el bono por completar el Beaudle de hoy. Este SIEMPRE se muestra
        // (a diferencia de antes, que desaparecía si no había uno disponible) — gris
        // cuando no se puede usar, con un texto que distingue "todavía no completaste
        // el Beaudle de hoy" de "ya lo reclamaste hoy" (0/1 vs 1/1), igual que el
        // "X/Y hoy" de gratis/comprado de abajo.
        <View style={styles.buyBtnStack}>
          <TouchableOpacity
            style={[styles.buyBtn, styles.buyBtnBonus, (!data.beaudleBonusAvailable || buying) && styles.buyBtnDisabled]}
            activeOpacity={0.8}
            disabled={!data.beaudleBonusAvailable || buying}
            onPress={() => onBuyPack('beaudle-bonus')}
          >
            {buyingKind === 'beaudle-bonus' ? (
              <ActivityIndicator size="small" color={theme.colors.background} />
            ) : (
              // 2 líneas (título + estado) en vez de una sola frase larga: de corrido,
              // "Sobre bono por el Beaudle de hoy (completa el Beaudle de hoy)" no
              // entraba en pantallas angostas y quedaba partida en un punto cualquiera
              // — acá cada mitad tiene su propio ancho para envolver como corresponda,
              // y el estado se distingue del título por ser más chico/atenuado en vez
              // de competir con él por el mismo tamaño de letra.
              <View style={styles.buyBtnTextStack}>
                <Text style={styles.buyBtnText} numberOfLines={2}>Sobre bono por el Beaudle de hoy</Text>
                <Text style={styles.buyBtnSubtext} numberOfLines={1}>
                  {data.beaudleBonusOpened
                    ? '0/1 hoy'
                    : data.beaudleDoneToday
                    ? '1/1 hoy'
                    : 'Completa el Beaudle de hoy'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.buyBtn, (!freeAvailable || buying) && styles.buyBtnDisabled]}
            activeOpacity={0.8}
            disabled={!freeAvailable || buying}
            onPress={() => onBuyPack('free')}
          >
            {buyingKind === 'free' ? (
              <ActivityIndicator size="small" color={theme.colors.background} />
            ) : (
              <Text style={styles.buyBtnText}>
                Sobre gratis ({data.freeRemaining ?? 0}/{data.freePacksPerDay} hoy)
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.buyBtn, (!canAfford || !boughtAvailable || buying) && styles.buyBtnDisabled]}
            activeOpacity={0.8}
            disabled={!canAfford || !boughtAvailable || buying}
            onPress={() => onBuyPack('bought')}
          >
            {buyingKind === 'bought' ? (
              <ActivityIndicator size="small" color={theme.colors.background} />
            ) : (
              <Text style={styles.buyBtnText}>
                Comprar sobre — {data.packPrice} ℬ ({data.boughtRemaining ?? 0}/{data.boughtPacksPerDay} hoy)
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.laminasSectionTitle}>Tus láminas sin pegar</Text>
      {looseItems.length === 0 ? (
        <Text style={styles.laminasEmptyText}>No tenés láminas sueltas por ahora.</Text>
      ) : (
        // Toda la fila abre el preview en grande (ver el modal de previsualización en
        // LeagueAlbumScreen) — sin miniatura propia acá (se sacó la StickerCard chica
        // que había: el número de la figurita ya identifica cuál es de un vistazo, y
        // tocar la fila muestra la foto real en grande). Los botones de adentro
        // (Pegar / Ir a la página) son TouchableOpacity anidados: React Native les da
        // el toque a ellos antes que a la fila que los contiene, sin propagarlo.
        looseItems.map((item) => (
          <TouchableOpacity key={item.code} style={styles.looseRow} activeOpacity={0.7} onPress={() => onPreview({
            code: item.code,
            name: item.name,
            teamName: item.teamName,
            imageUri: item.imageUri,
            placeholderIcon: item.placeholderIcon,
            imageResizeMode: 'cover',
            teamColor: item.teamColor,
            specialTexture: item.specialTexture,
            isCaptain: item.isCaptain,
            badgeText: item.badgeText,
            teamCrestUri: item.teamCrestUri,
          })}>
            <View style={styles.looseInfo}>
              <Text style={styles.looseCode}>{item.code}</Text>
              <Text style={styles.looseName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.looseTeam} numberOfLines={1}>{item.teamName}</Text>
              <Text style={styles.looseCount}>{item.loose} sin pegar</Text>
            </View>
            <View style={styles.looseActions}>
              {!item.pasted && (
                <TouchableOpacity style={styles.looseActionBtn} onPress={() => onPegar(item.code)}>
                  <Feather name="check-circle" size={14} color={theme.colors.background} />
                  <Text style={styles.looseActionBtnText}>Pegar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.looseActionBtn, styles.looseActionBtnOutline]}
                onPress={() => onGoToPage(item.code)}
              >
                <Feather name="map-pin" size={14} color={theme.colors.text} />
                <Text style={[styles.looseActionBtnText, styles.looseActionBtnOutlineText]}>Ir a la página</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

export const LeagueAlbumScreen: React.FC<Props> = ({ route }) => {
  const { albumId } = route.params;
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  // La tipografía de los chips (NAME_CHIP_FONT_FAMILY) se carga acá, no globalmente en
  // App.tsx: es solo para el álbum, y measureTextAtSize (canvas) necesita que el
  // navegador ya tenga la fuente lista antes de medir — si no, mide con el fallback y
  // decide mal el tamaño de letra la primera vez.
  const [fontsLoaded] = useFonts({ 'Oswald-Bold': require('../../assets/fonts/Oswald-Bold.ttf') });
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [data, setData] = useState<AlbumData | null>(null);
  const [buyingKind, setBuyingKind] = useState<'free' | 'bought' | 'beaudle-bonus' | null>(null);
  const buying = buyingKind !== null;
  // Mientras hay un POST /api/album/paste en vuelo (incluyendo el fetchData que lo
  // sigue), ningún otro toque de "pegar" puede iniciar uno nuevo — sin esto, tocar dos
  // láminas pegables seguidas (o la misma dos veces) antes de que la primera respuesta
  // vuelva a refrescar sus estados a "glued" las manda a las dos por separado, cada
  // una válida y exitosa por su cuenta: no se ve como un error, se ve como si un solo
  // toque hubiera pegado dos láminas. `pegable` no tiene ningún feedback inmediato
  // (ver el comentario grande sobre StickerStatus) que le avise al usuario "ya
  // registré tu toque, esperá" — con la vista quieta es fácil tocar una lámina
  // vecina de más, pensando que la primera no hizo nada.
  const [pastingCode, setPastingCode] = useState<string | null>(null);
  const [reveal, setReveal] = useState<BuyPackResult | null>(null);
  // El sobre se revela de a una lámina por vez (no la grilla completa junta) — más
  // parecido a abrir un sobre físico, y deja usar la MISMA StickerCard grande que en
  // el álbum en vez de una versión chica solo para esta pantalla.
  const [revealIndex, setRevealIndex] = useState(0);
  // Álbum: el libro que se pasa como páginas. Láminas: inventario de lo que no está
  // pegado todavía + intercambios — nunca al mismo tiempo, por eso un solo toggle en
  // vez de mostrar ambas secciones apiladas.
  const [view, setView] = useState<'album' | 'laminas'>('album');
  // Lámina en previsualización grande — se abre al tocar una lámina `glued` de la
  // grilla o una fila de la vista Láminas (ver StickerCard/AlbumLaminasView), null
  // cuando el modal está cerrado.
  const [preview, setPreview] = useState<PreviewSticker | null>(null);

  const [pageWidth, setPageWidth] = useState(0);
  // Espacio total disponible para el libro + el botón "Mis láminas" de abajo (mide un
  // wrapper que envuelve a ambos) y el alto real de ese botón (mide el botón mismo,
  // con su propio texto/ícono) — de acá sale `pageSide`, el lado de la página fija 4:5
  // que entra sin recortarse ni empujar nada hacia arriba, sea cual sea el alto de la
  // ventana/dispositivo.
  const [albumBodySize, setAlbumBodySize] = useState({ width: 0, height: 0 });
  const [shortcutBtnHeight, setShortcutBtnHeight] = useState(0);
  // Igual que shortcutBtnHeight: el alto real de la barra Anterior/Siguiente/página
  // (pageNavBar), para descontarlo también del espacio disponible para el libro (ver
  // pageSide más abajo) — si no, la barra empuja el libro fuera de la pantalla en vez
  // de quedar siempre visible debajo.
  const [navBarHeight, setNavBarHeight] = useState(0);
  const [pageJumpOpen, setPageJumpOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  // La página a la que se está pasando: mientras no sea null hay una transición en
  // curso (arrastrada con el dedo o animada por botón/tira de escudos). Las dos páginas
  // en juego SIEMPRE viven en el mismo eje (izquierda = "afuera"): al avanzar, la
  // actual sale por la izquierda y la siguiente ya estaba quieta debajo; al retroceder,
  // es la anterior la que VUELVE por esa misma izquierda (por donde se había ido) y
  // tapa a la actual, que queda quieta debajo — nunca "entra por la derecha".
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Los handlers del PanResponder se crean UNA sola vez (más abajo) y leen estos refs
  // en vez de las variables de estado directamente — si se recreara el PanResponder
  // cada vez que cambia pageIndex/pendingIndex (como con un useMemo con esas deps),
  // un gesto en curso podría terminar llamando a handlers de otra instancia a mitad de
  // camino. Se actualizan en cada render, sin necesidad de un useEffect aparte.
  const pageIndexRef = useRef(pageIndex);
  pageIndexRef.current = pageIndex;
  const pendingIndexRef = useRef(pendingIndex);
  pendingIndexRef.current = pendingIndex;
  const pageWidthRef = useRef(pageWidth);
  pageWidthRef.current = pageWidth;

  // Portada + páginas de equipo ya cortadas de a CARDS_PER_PAGE (ver buildAlbumPages) —
  // se recalcula solo cuando cambian los equipos, no en cada render.
  const albumPages = useMemo(() => (data ? buildAlbumPages(data.teams) : []), [data]);
  const totalPages = albumPages.length;
  const totalPagesRef = useRef(totalPages);
  totalPagesRef.current = totalPages;
  // Portada + un tramo por equipo (ver buildAlbumSections) para el selector "ir a una
  // página" — se recalcula junto con albumPages, no en cada render.
  const albumSections = useMemo(() => buildAlbumSections(albumPages), [albumPages]);
  const currentSection = albumSections.find(
    (s): s is Extract<AlbumJumpEntry, { kind: 'section' }> => s.kind === 'section' && pageIndex >= s.startIndex && pageIndex <= s.endIndex
  );
  // Código de figurita → índice de página del álbum donde se pega — para el botón "Ir
  // a la página" de la vista Láminas (ver handleGoToPage). Escudo/plantel/jugador/DT
  // todos tienen su código en `cards` de alguna página `team` (nunca en la portada).
  const codeToPageIndex = useMemo(() => {
    const map: Record<string, number> = {};
    albumPages.forEach((p, idx) => {
      if (p.kind !== 'team') return;
      p.cards.forEach((c) => { if (c.code) map[c.code] = idx; });
    });
    return map;
  }, [albumPages]);
  const fetchData = useCallback(async (isPullRefresh = false) => {
    try {
      if (!isPullRefresh) setLoading(true);
      const album = await albumService.getAlbum(albumId);
      setData(album);
      setNotFound(false);
    } catch (err) {
      setNotFound(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [albumId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchData(true), 400);
  }, [fetchData]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setRefreshing(true);
      await withMinimumDelay(() => fetchData(true), 400);
    });
    return () => sub.remove();
  }, [fetchData]);

  const handleBuyPack = async (kind: 'free' | 'bought' | 'beaudle-bonus') => {
    if (!data || buying) return;
    setBuyingKind(kind);
    try {
      const result = await albumService.buyPack(albumId, kind);
      setRevealIndex(0);
      setReveal(result);
      await Promise.all([fetchData(true), refreshUser()]);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.data?.error || err?.message || 'No se pudo abrir el sobre.' });
    } finally {
      setBuyingKind(null);
    }
  };

  // Pegar nunca es automático (ni la primera copia de un código) — el usuario lo pide
  // desde una lámina "pegable" (vista Álbum) o desde la vista Láminas. `pastingCode`
  // bloquea toques mientras esto está en curso (ver su comentario) — nunca dos pegados
  // a la vez, sea la misma lámina tocada de nuevo o una vecina.
  const handlePegar = async (code: string) => {
    if (pastingCode) return;
    setPastingCode(code);
    try {
      await albumService.pasteSticker(albumId, code);
      await fetchData(true);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.data?.error || err?.message || 'No se pudo pegar la figurita.' });
    } finally {
      setPastingCode(null);
    }
  };

  // "Ir a la página": salta directo (sin la animación de goToPage, pensada para pasar
  // de a una página desde el propio libro) a la página del álbum donde se pega esta
  // figurita, y vuelve a la vista Álbum — mismo criterio que "ir a una página" del
  // selector, pero disparado desde una fila de la vista Láminas.
  const handleGoToPage = (code: string) => {
    const idx = codeToPageIndex[code];
    if (idx === undefined) return;
    setPreview(null);
    setPendingIndex(null);
    slideAnim.setValue(0);
    setPageIndex(idx);
    setView('album');
  };

  // Al avanzar, la capa que se mueve es la ACTUAL: arranca en 0 (tapando todo) y
  // termina en -width (afuera a la izquierda) — abajo, quieta, ya estaba la siguiente.
  // Al retroceder, la capa que se mueve es la ANTERIOR: arranca en -width (donde había
  // quedado al irse) y VUELVE a 0, tapando a la actual — que se queda quieta debajo.
  // Nunca se anima nada entrando por la derecha.
  const goToPage = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, totalPages - 1));
    if (clamped === pageIndex || pendingIndex !== null || !pageWidth) return;
    const forward = clamped > pageIndex;
    setPendingIndex(clamped);
    slideAnim.setValue(forward ? 0 : -pageWidth);
    Animated.timing(slideAnim, {
      toValue: forward ? -pageWidth : 0,
      duration: PAGE_TRANSITION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setPageIndex(clamped);
      setPendingIndex(null);
      slideAnim.setValue(0);
    });
  };

  // Deslizar con el dedo: mismo mecanismo que goToPage pero siguiendo el arrastre
  // frame a frame. En las puntas del álbum (no hay página anterior/siguiente a la que
  // "asomarse") el arrastre simplemente no mueve nada, en vez de un rebote elástico —
  // más simple y sin un tercer estado que mantener sincronizado con la forma del árbol
  // de renderPageAt(). Se crea UNA sola vez (ver los refs de arriba) para que un gesto
  // en curso nunca quede a mitad de camino entre dos instancias distintas.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        pendingIndexRef.current === null && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const width = pageWidthRef.current || 1;
        const pageIdx = pageIndexRef.current;
        if (g.dx < 0) {
          // revelando la siguiente: la actual (capa que se mueve) va de 0 a -width
          const neighbor = pageIdx + 1;
          if (neighbor < totalPagesRef.current) {
            if (pendingIndexRef.current !== neighbor) setPendingIndex(neighbor);
            slideAnim.setValue(Math.max(-width, g.dx));
          }
        } else if (g.dx > 0) {
          // revelando la anterior: ella (capa que se mueve) vuelve de -width a 0
          const neighbor = pageIdx - 1;
          if (neighbor >= 0) {
            if (pendingIndexRef.current !== neighbor) setPendingIndex(neighbor);
            slideAnim.setValue(Math.min(0, -width + g.dx));
          }
        }
      },
      onPanResponderRelease: (_, g) => {
        const width = pageWidthRef.current || 1;
        const pending = pendingIndexRef.current;
        if (pending === null) return; // no llegó a moverse (punta del álbum o gesto sin desplazamiento real)
        const forward = pending > pageIndexRef.current;
        const shouldComplete = Math.abs(g.dx) > width * 0.25 || Math.abs(g.vx) > 0.5;
        if (shouldComplete) {
          Animated.timing(slideAnim, {
            toValue: forward ? -width : 0,
            duration: PAGE_TRANSITION_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(() => {
            setPageIndex(pending);
            setPendingIndex(null);
            slideAnim.setValue(0);
          });
        } else {
          // No llegó al umbral: la capa que se estaba moviendo vuelve a su posición de
          // reposo (0 si era la actual saliendo, -width si era la anterior volviendo).
          Animated.spring(slideAnim, { toValue: forward ? 0 : -width, useNativeDriver: false, friction: 9 }).start(() => {
            setPendingIndex(null);
            slideAnim.setValue(0);
          });
        }
      },
      onPanResponderTerminate: () => {
        const pending = pendingIndexRef.current;
        if (pending === null) return;
        const forward = pending > pageIndexRef.current;
        Animated.spring(slideAnim, { toValue: forward ? 0 : -(pageWidthRef.current || 1), useNativeDriver: false, friction: 9 }).start(() => {
          setPendingIndex(null);
          slideAnim.setValue(0);
        });
      },
    })
  ).current;

  if (loading || !fontsLoaded) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (notFound || !data) {
    return (
      <View style={styles.centerContainer}>
        <Feather name="book" size={32} color={theme.colors.textMuted} />
        <Text style={styles.emptyTitle}>Álbum no disponible</Text>
        <Text style={styles.emptySub}>Esta liga todavía no tiene un álbum activo.</Text>
      </View>
    );
  }

  const canAfford = !!user && (data.beautokens === null || data.beautokens >= data.packPrice);
  const hasTeams = data.teams.length > 0;
  const palette = getAlbumPalette(data.album.palette);

  // Lado de la página (width === height/1.25, proporción 4:5): el menor entre "todo el
  // ancho disponible" y "todo el alto disponible dividido en la misma proporción" — así
  // nunca se recorta ni empuja el botón de abajo fuera de la pantalla, sea la ventana
  // angosta y alta (manda el ancho) o ancha y baja (manda el alto). Antes de medir nada
  // (primer render) se usa el ancho crudo como respaldo, vía aspectRatio en el estilo.
  const SHORTCUT_BTN_MARGIN = theme.spacing.sm + theme.spacing.md; // marginTop + marginBottom de laminasShortcutBtn
  const NAV_BAR_MARGIN = theme.spacing.sm; // marginTop de pageNavBar
  const availableForPage = shortcutBtnHeight > 0
    ? albumBodySize.height - shortcutBtnHeight - SHORTCUT_BTN_MARGIN - navBarHeight - NAV_BAR_MARGIN
    : albumBodySize.height;
  const pageSide = albumBodySize.width > 0 && availableForPage > 0
    ? Math.min(albumBodySize.width, availableForPage * (4 / 5))
    : 0;

  const renderPageAt = (idx: number) => {
    const p = albumPages[idx];
    if (!p) return null;
    return p.kind === 'cover' ? (
      <CoverPage data={data} palette={palette} refreshing={refreshing} onRefresh={onRefresh} />
    ) : (
      <TeamAlbumPage page={p} refreshing={refreshing} onRefresh={onRefresh} onPegar={handlePegar} onPreview={setPreview} />
    );
  };

  return (
    <View style={styles.container}>
      {!hasTeams ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptySub}>Esta liga todavía no tiene jugadores registrados.</Text>
        </View>
      ) : view === 'laminas' ? (
        <AlbumLaminasView
          data={data}
          loggedIn={!!user}
          canAfford={canAfford}
          buyingKind={buyingKind}
          onBuyPack={handleBuyPack}
          onPegar={handlePegar}
          onPreview={setPreview}
          onGoToPage={handleGoToPage}
          onBack={() => setView('album')}
        />
      ) : (
        <View
          style={styles.albumBodyWrap}
          onLayout={(e) => setAlbumBodySize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          <View
            style={[styles.pagerWrap, pageSide > 0 && { width: pageSide, height: pageSide * (5 / 4) }]}
            onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
          >
            {pageWidth > 0 && (() => {
              // La de atrás (quieta, en 0) es siempre la que YA estaba en esa posición
              // — la siguiente al avanzar, la actual al retroceder (o la actual sola,
              // en reposo). La de adelante (con slideAnim) es la única que se mueve,
              // siempre por la izquierda: sale ahí la actual al avanzar, o vuelve desde
              // ahí la anterior al retroceder.
              //
              // El árbol de acá abajo (View > View + Animated.View) tiene que quedar
              // SIEMPRE con la misma forma, esté o no en transición — antes había un
              // if/else que devolvía árboles distintos según pendingIndex, y React
              // desmontaba y volvía a montar el Animated.View justo al arrancar cada
              // transición (cambiaba de posición en el árbol), lo que cortaba en seco
              // la animación nativa: la página nueva aparecía de golpe, sin deslizarse.
              // Con la misma forma siempre, el Animated.View (y su conexión nativa a
              // slideAnim) nunca se desmonta a mitad de camino.
              const forward = pendingIndex !== null && pendingIndex > pageIndex;
              const staticIdx = pendingIndex === null ? pageIndex : forward ? pendingIndex : pageIndex;
              const movingIdx = pendingIndex === null ? null : forward ? pageIndex : pendingIndex;
              return (
                <View style={StyleSheet.absoluteFillObject} {...panResponder.panHandlers}>
                  <View style={StyleSheet.absoluteFillObject}>{renderPageAt(staticIdx)}</View>
                  {/* pointerEvents="none" cuando no hay página moviéndose (fuera de una
                      transición, que es CASI siempre) — sin esto, este overlay vacío
                      pero absoluteFillObject se quedaba tapando TODA la página de
                      arriba (es el sibling de después, pinta encima) y ningún toque
                      dentro de la grilla llegaba a nada: ni el viejo botón "Pegar" ni
                      el nuevo marco pegable de StickerCard registraban un solo click,
                      aunque el handler estuviera perfecto — el div vacío se quedaba con
                      el evento antes de que le tocara a nadie más. */}
                  <Animated.View
                    pointerEvents={movingIdx === null ? 'none' : 'auto'}
                    style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: slideAnim }] }]}
                  >
                    {movingIdx !== null && renderPageAt(movingIdx)}
                  </Animated.View>
                </View>
              );
            })()}

            {pageIndex > 0 && (
              <TouchableOpacity style={[styles.pagerArrow, styles.pagerArrowLeft]} onPress={() => goToPage(pageIndex - 1)}>
                <Feather name="chevron-left" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            )}
            {pageIndex < totalPages - 1 && (
              <TouchableOpacity style={[styles.pagerArrow, styles.pagerArrowRight]} onPress={() => goToPage(pageIndex + 1)}>
                <Feather name="chevron-right" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            )}
          </View>

          {/* Alternativa a arrastrar/tocar los bordes del libro para pasar de a una
              página: botones explícitos Anterior/Siguiente más un selector "ir a una
              página" que salta directo al principio de cualquier equipo (ver
              buildAlbumSections) — útil con álbumes grandes (100+ páginas), donde
              pasar página por página para llegar a un equipo en particular es lento. */}
          <View
            style={[styles.pageNavBar, pageSide > 0 && { width: pageSide }]}
            onLayout={(e) => setNavBarHeight(e.nativeEvent.layout.height)}
          >
            <TouchableOpacity
              style={styles.pageNavBtn}
              disabled={pageIndex === 0}
              onPress={() => goToPage(pageIndex - 1)}
            >
              <Feather name="chevron-left" size={16} color={pageIndex === 0 ? theme.colors.textMuted : theme.colors.text} />
              <Text style={[styles.pageNavBtnText, pageIndex === 0 && styles.pageNavBtnTextDisabled]}>Anterior</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pageJumpBtn} onPress={() => setPageJumpOpen(true)}>
              <View style={styles.pageJumpBtnLabels}>
                <Text style={styles.pageJumpBtnTitle} numberOfLines={1}>
                  {currentSection ? currentSection.title : 'Portada'}
                </Text>
                <Text style={styles.pageJumpBtnSub}>Página {pageIndex + 1} de {totalPages}</Text>
              </View>
              <Feather name="chevron-down" size={14} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pageNavBtn}
              disabled={pageIndex >= totalPages - 1}
              onPress={() => goToPage(pageIndex + 1)}
            >
              <Text style={[styles.pageNavBtnText, pageIndex >= totalPages - 1 && styles.pageNavBtnTextDisabled]}>Siguiente</Text>
              <Feather name="chevron-right" size={16} color={pageIndex >= totalPages - 1 ? theme.colors.textMuted : theme.colors.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.laminasShortcutBtn, pageSide > 0 && { width: pageSide }]}
            onPress={() => setView('laminas')}
            onLayout={(e) => setShortcutBtnHeight(e.nativeEvent.layout.height)}
          >
            <Feather name="layers" size={16} color={theme.colors.background} />
            <Text style={styles.laminasShortcutBtnText}>Mis láminas</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={pageJumpOpen} transparent animationType="fade" onRequestClose={() => setPageJumpOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPageJumpOpen(false)}>
          {/* onStartShouldSetResponder frena la propagación del toque hacia el overlay
              de atrás (que cierra el modal) — sin esto, tocar CUALQUIER parte de la
              caja (incluida la lista, entre una fila y otra) cerraba el modal igual. */}
          <View style={styles.pageJumpBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Ir a una página</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {albumSections.map((s) => {
                if (s.kind === 'header') {
                  return (
                    <Text key={s.key} style={styles.pageJumpHeader}>{s.label}</Text>
                  );
                }
                const active = s === currentSection;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.pageJumpRow, active && styles.pageJumpRowActive]}
                    onPress={() => {
                      goToPage(s.startIndex);
                      setPageJumpOpen(false);
                    }}
                  >
                    <Text style={[styles.pageJumpRowTitle, active && styles.pageJumpRowTitleActive]} numberOfLines={1}>
                      {s.title}
                    </Text>
                    <Text style={styles.pageJumpRowSub}>{s.subtitle}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!reveal} transparent animationType="fade" onRequestClose={() => setReveal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Tu sobre</Text>
            {/* De a una lámina por vez (no una grilla con las 5 juntas) — más parecido
                a abrir un sobre físico, y usa la MISMA StickerCard grande en vez de
                una versión chica aparte solo para este modal (ver REVEAL_CARD_*). */}
            {reveal && (() => {
              const d: DrawnSticker = reveal.drawn[revealIndex];
              const pos = d.position as PlayerPosition | undefined;
              // Escudo/foto de equipo pueden salir del sobre igual que un jugador
              // (ver backend/pb_hooks/album.pb.js) — `special` dice cuál de los 3
              // es (la foto de equipo sale como 2 mitades independientes, cada una
              // su propia figurita), para usar el ícono/recorte/thumb que le
              // corresponde en vez del de una foto de jugador.
              const isCrest = d.special === 'crest';
              const isPhotoHalf = d.special === 'photo-left' || d.special === 'photo-right';
              const isDT = d.special === 'dt';
              const imageUri = d.photo
                ? getFileUrl(
                    { id: d.playerId, collectionId: d.collectionId },
                    d.photo,
                    isCrest ? '300x300f' : isPhotoHalf ? undefined : PHOTO_THUMB
                  )
                : null;
              const placeholderIcon = isCrest ? 'shield' : isPhotoHalf ? 'image' : isDT ? 'clipboard' : 'user';
              // Mismo criterio que buildTeamSlots: el escudo lleva su nombre arriba
              // (CrestTeamName, sin badge — ES el escudo) y sin chip abajo; el plantel
              // no lleva nombre arriba, pero sí el del equipo abajo en vez del genérico
              // "Foto de equipo" que manda el backend, más el mismo escudo/categoría en
              // sus cuadrados de esquina que la grilla del álbum (ver
              // PhotoPairCornerBadge); jugador/DT llevan nombre + escudo arriba. Así el
              // sobre queda con el mismo escudo/nombre que la grilla en vez de una
              // versión sin ellos. Solo el escudo mismo se queda sin badge de escudo
              // (ya ES el escudo).
              const teamCrestUri = isCrest ? null : teamCrestBadgeUri({ id: d.teamId, collectionId: d.teamCollectionId }, d.teamCrestFile);
              // La mitad de plantel sale del sobre SOLA (nunca con su par al lado, a
              // diferencia de la grilla del álbum) — sin este recorte se veía la
              // panorámica ENTERA achicada para entrar en la lámina en vez de solo la
              // mitad que le toca. `standalone: true` es lo que le dice a StickerCard
              // que recorte la foto igual que en el álbum, pero sin sacarle el margen
              // blanco de un lado (acá no hay una mitad al lado que lo compense).
              const photoHalfCrop: PhotoPairCrop | undefined = isPhotoHalf
                ? (() => {
                    const innerWidth = REVEAL_CARD_WIDTH - cardMarginFor(REVEAL_CARD_WIDTH) * 2;
                    const side = d.special === 'photo-left' ? 'left' : 'right';
                    return { side, standalone: true, cropOffset: side === 'left' ? 0 : innerWidth, cropFullWidth: innerWidth * 2 };
                  })()
                : undefined;
              const isLast = revealIndex === reveal.drawn.length - 1;
              const advance = () => (isLast ? setReveal(null) : setRevealIndex((i) => i + 1));
              return (
                <View style={styles.revealHero}>
                  <Text style={styles.revealCounter}>{revealIndex + 1} / {reveal.drawn.length}</Text>
                  <TouchableOpacity activeOpacity={0.85} onPress={advance}>
                    <StickerCard
                      uid={`reveal-${revealIndex}`}
                      name={isPhotoHalf ? d.teamName : d.name}
                      teamName={isPhotoHalf ? undefined : d.teamName}
                      teamCrestUri={teamCrestUri}
                      hideBottomChip={isCrest}
                      photoPair={photoHalfCrop}
                      imageUri={imageUri}
                      placeholderIcon={placeholderIcon}
                      // Igual que playerSlot/DT: solo escudo se queda en "contain" (no
                      // recortar su arte); jugador/DT y plantel van en "cover".
                      imageResizeMode={placeholderIcon === 'shield' ? 'contain' : 'cover'}
                      status="glued"
                      teamColor={d.teamColor}
                      // Misma textura prismática que el escudo/capitán (ver buildTeamSlots) —
                      // faltaba acá, así que el DT salía del sobre con la textura normal en
                      // vez de la especial que sí tiene en la grilla del álbum.
                      specialTexture={isDT}
                      badgeText={isDT ? 'DT' : pos && POSITION_ORDER.includes(pos) ? pos : undefined}
                      categoryLabel={isPhotoHalf ? categoryBadgeLabel(d.teamCategory) : undefined}
                      style={styles.revealHeroSize}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.revealTag, d.isNew ? styles.revealTagNew : styles.revealTagDup]}>
                    {d.isNew ? 'Nueva' : 'Repetida'}
                  </Text>
                  <TouchableOpacity style={styles.modalCloseBtn} onPress={advance}>
                    <Text style={styles.modalCloseBtnText}>{isLast ? 'Listo' : 'Siguiente'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Previsualización en grande: se abre al tocar una lámina glued de la grilla o
          una fila de la vista Láminas (ver StickerCard/AlbumLaminasView) — misma
          StickerCard grande que el resto de esta pantalla (REVEAL_CARD_*), sin nada
          más encima (a diferencia del sobre, acá no hay "Nueva/Repetida" que mostrar). */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {preview && (
              <View style={styles.revealHero}>
                <StickerCard
                  uid="sticker-preview"
                  code={preview.code}
                  name={preview.name}
                  teamName={preview.teamName}
                  hideBottomChip={preview.hideBottomChip}
                  imageUri={preview.imageUri}
                  placeholderIcon={preview.placeholderIcon}
                  imageResizeMode={preview.imageResizeMode}
                  teamCrestUri={preview.teamCrestUri}
                  teamColor={preview.teamColor}
                  specialTexture={preview.specialTexture}
                  isCaptain={preview.isCaptain}
                  badgeText={preview.badgeText}
                  photoPair={preview.photoPair}
                  categoryLabel={preview.categoryLabel}
                  status="glued"
                  style={styles.previewHeroSize}
                />
              </View>
            )}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPreview(null)}>
              <Text style={styles.modalCloseBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    gap: 8,
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
  emptyTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  emptySub: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },

  balanceValue: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },

  // Atajo al final de la última página del álbum — el álbum en sí no lleva ningún
  // header/atajo/balance arriba a propósito (pedido explícito): la primera pantalla es
  // directamente el libro, y esta es la única puerta hacia la vista Láminas.
  // alignSelf: 'center' + el ancho de la página puesto inline (pageSide, igual que
  // pagerWrap/pageNavBar) — antes tenía marginHorizontal fijo, que en vista de pc
  // dejaba este botón mucho más angosto que el libro de arriba en vez del mismo ancho.
  laminasShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    width: '100%',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
  },
  laminasShortcutBtnText: { color: theme.colors.background, fontSize: 14, fontWeight: '800' },

  laminasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  laminasBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  laminasBackBtnText: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },

  // El marco grueso alrededor del "libro" (como el borde de color de un álbum físico)
  // usa el 3er color de la paleta del álbum — se pinta acá, no en cada página, porque
  // es del LIBRO, no de un equipo en particular.
  // Sin borde ni esquinas redondeadas a propósito: la página tiene que sentirse como
  // una carta rectangular que se saca de un mazo — un marco alrededor rompía esa
  // ilusión, se sentía como mirar el paginado a través de una ventana en vez de ver la
  // carta anterior deslizarse entera fuera de la pantalla.
  // Contenedor que mide el espacio real disponible (ancho Y alto) para el libro + el
  // botón de abajo — hace falta el alto además del ancho porque la proporción fija de
  // la página (4:5, ver pagerWrap) tiene que caber sin recortarse ni empujar el header
  // de la pantalla hacia arriba en ventanas bajas (ver cálculo de `pageSide` en el
  // componente).
  // `flex-start` (default) a propósito: el libro arranca pegado arriba, sin espacio
  // vacío antes — si algo sobra (página angosta en una ventana muy alta) queda abajo,
  // después del botón "Mis láminas", nunca antes del libro.
  albumBodyWrap: { flex: 1, width: '100%' },
  // Proporción fija de página de álbum real (4 de ancho por 5 de alto). El tamaño
  // exacto (width/height en px) lo calcula el componente a partir de albumBodyWrap —
  // acá solo quedan valores de respaldo para el primer render, antes de medir nada.
  // overflow: hidden — sin esto la página que entra/sale por translateX (ver el
  // Animated.View del pager) se sigue dibujando fuera de esta caja mientras desliza,
  // y en la vista ancha (sidebar acoplado) eso significaba pasar por encima del
  // sidebar en vez de desaparecer al cruzar el borde del libro.
  pagerWrap: { width: '100%', aspectRatio: 4 / 5, alignSelf: 'center', marginTop: theme.spacing.sm, overflow: 'hidden' },
  pageWrap: { flex: 1, position: 'relative' },
  // Oscurece la textura de forma pareja para que el texto blanco de siempre (nombres,
  // encabezados de sección) se siga leyendo bien sin importar qué colores haya elegido
  // el administrador — sin esto, un álbum con un color 1 claro rompería el contraste.
  pageScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  pagerArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerArrowLeft: { left: 8 },
  pagerArrowRight: { right: 8 },

  // Barra Anterior / [equipo actual, abre el selector] / Siguiente, debajo del libro —
  // alternativa explícita a arrastrar el libro o tocar sus flechas laterales (ver el
  // comentario grande donde se usa, en el componente). alignSelf: 'center' + el mismo
  // ancho que el libro (pageSide, puesto inline) para que quede centrada con él.
  pageNavBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    marginTop: theme.spacing.sm,
    alignSelf: 'center',
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pageNavBtnText: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  pageNavBtnTextDisabled: { color: theme.colors.textMuted },
  // El botón del medio crece para ocupar el espacio entre Anterior/Siguiente (flex: 1,
  // los otros 2 no lo tienen) — así la barra entera siempre mide lo mismo que el
  // libro, sea cual sea el largo del nombre del equipo actual.
  pageJumpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pageJumpBtnLabels: { flexShrink: 1, alignItems: 'center' },
  pageJumpBtnTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  pageJumpBtnSub: { color: theme.colors.textMuted, fontSize: 11, marginTop: 1 },

  // Mismo modalOverlay/modalTitle que el resto de esta pantalla (ver el modal de
  // intercambio) — solo la caja cambia: más angosta y sin `padding` en la lista, para
  // que las filas puedan llevar su propio separador de borde inferior de punta a
  // punta.
  pageJumpBox: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: theme.spacing.lg,
    maxHeight: '70%',
  },
  pageJumpRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pageJumpRowActive: { backgroundColor: theme.colors.primary + '22' },
  pageJumpRowTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  pageJumpRowTitleActive: { color: theme.colors.primary },
  pageJumpRowSub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  // Header de liga dentro de la lista (ver buildAlbumSections) — puede repetirse más
  // de una vez si el álbum intercala ligas (masculina/mixta/femenina no siempre
  // quedan en 3 bloques limpios). marginTop más grande que el bottom para separarlo
  // del grupo anterior sin pegarse al primer equipo del suyo.
  pageJumpHeader: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 2,
  },

  // Sin maxWidth a propósito: la página YA tiene un tamaño fijo y proporcional (4:5,
  // ver pageSide en LeagueAlbumScreen) — un tope acá haría que las láminas se vean
  // más chicas en relación a la página en pantallas grandes, en vez de escalar juntas.
  pageContent: { padding: theme.spacing.md, paddingBottom: 24, alignItems: 'center', alignSelf: 'center', width: '100%' },
  coverContent: { flexGrow: 1, justifyContent: 'center', gap: 6 },
  coverBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  coverImage: { width: 160, height: 160, borderRadius: 16, marginBottom: 4 },
  coverTitle: { color: '#ffffff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  coverSub: { color: theme.colors.text, fontSize: 13 },
  coverProgress: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginTop: 4 },

  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    padding: theme.spacing.sm,
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  teamHeaderName: { fontSize: 22, fontWeight: '800' },

  // Grilla fija de CARDS_PER_PAGE láminas (3x2, más el plantel "de lado" en la fila 1)
  // — el tamaño de cada lámina no sale de acá (ver colWidth en TeamAlbumPage,
  // calculado a partir del onLayout de esta misma View), pero el `gap` SÍ tiene que
  // coincidir con GRID_GAP, que ese cálculo usa para descontarlo. Sin maxWidth a
  // propósito: la lámina tiene que ser proporcional al tamaño real de la página (que
  // ya es fija y proporcional, ver pageSide) — un tope acá desacoplaría una de la otra
  // en pantallas donde la página queda más ancha que ese tope.
  fixedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: GRID_GAP,
    width: '100%',
    alignSelf: 'center',
    marginTop: theme.spacing.md,
  },

  // Sombra en un wrapper aparte (nunca en la misma View que recorta con
  // overflow:hidden — en iOS eso apaga la sombra directamente) para que la lámina se
  // sienta pegada ENCIMA de la textura de la página, no flotando en el aire.
  cardShadowWrap: {
    borderRadius: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 4,
  },
  // El "cartón" de la lámina: blanco, esquinas RECTAS (sin curva) — el padding
  // (cardMarginFor, inline en StickerCard porque depende del ancho real de cada
  // lámina) es justamente el margen que separa la foto del recorte de la carta, como
  // en una lámina de álbum física.
  card: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  // Sin el "cartón" blanco: una lámina que no tenés no es una foto con marco, es
  // directamente el hueco gris (cardEmpty) — el margen/fondo blanco es exclusivo de
  // las láminas que sí están pegadas o para pegar. El padding (0 en este caso) NO va
  // acá — ver cardPaddingStyle en StickerCard, que calcula el padding entero (incluida
  // la excepción de este caso) en un solo objeto inline para no repartirlo entre una
  // clase estática y un valor dinámico (ver su comentario grande).
  cardUnowned: {
    backgroundColor: 'transparent',
  },
  // El escudo (glued) tampoco lleva el "cartón" blanco: la textura prismática
  // (PRISMATIC_TEXTURE) ocupa también ese margen, así que acá el fondo blanco se saca
  // entero — a diferencia del resto de las láminas, donde ese margen SÍ es blanco y
  // separado de la textura de cardInner. El padding, igual que en cardUnowned, se
  // calcula en cardPaddingStyle (StickerCard), no acá.
  cardCrestGlued: {
    backgroundColor: 'transparent',
  },
  // La "foto impresa": esquinas rectas (sin suavizar) a propósito — el margen blanco de
  // afuera es lo redondeado, la imagen en sí siempre es un rectángulo recto.
  cardInner: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  // Marco de la foto de jugador/DT: separada de los 4 bordes de la lámina (a
  // diferencia del resto, que llena cardInner entero) y con esquinas bien redondeadas
  // — se ve la textura de la lámina (SunTornadoTexture) asomando alrededor como un margen.
  personPhotoFrame: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El cuadrado real de la foto, más chico que personPhotoFrame — aspectRatio: 1 lo
  // fuerza cuadrado sin importar el alto/ancho de la lámina, así que siempre queda
  // espacio de sobra arriba/abajo (el marco es más alto que ancho) en vez de la foto
  // estirada rellenando todo el marco.
  personPhotoInner: {
    width: '88%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  // Marco del escudo: margen a los lados y arriba — el de arriba tiene que ser lo
  // bastante alto como para no cruzarse con CrestTeamName (el nombre del equipo), que
  // flota encima de esta misma lámina, incluso si crece a 2 líneas. Sin redondear (a
  // diferencia de personPhotoFrame): acá alcanza con el espacio, el escudo no necesita
  // leerse como una foto recortada.
  crestFrame: {
    position: 'absolute',
    top: CREST_FRAME_TOP,
    left: 10,
    right: 10,
    bottom: 10,
  },
  cardEmpty: {
    flex: 1,
    backgroundColor: theme.colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardNameEmpty: { color: theme.colors.textMuted, fontSize: 15, fontWeight: '700' },
  // Marco que "brilla" (pegablePulse, un único loop por página) sobre el hueco vacío
  // de una lámina pegable — sin bordes redondeados, para que calce con el resto de la
  // lámina (esquinas siempre rectas, ver el comentario grande de StickerCard).
  cardPegableGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  // Fila de arriba de la lámina de jugador/DT — ver el comentario grande de
  // TeamTopRow: escudo (cuadrado) + nombre del equipo (rectángulo), pegados al techo.
  // El alto (edgeRowHeight, ver cardEdgeRowHeightFor) es fijo para esa lámina — pasado
  // inline junto con el ancho del cuadrado; el rectángulo del nombre (cardTopNameRect)
  // lo hereda solo, por stretch.
  cardTopRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: BADGE_NAME_GAP,
  },
  // Escudo (arriba) y posición/DT (abajo, cardBottomSquare) comparten este estilo:
  // cuadrado negro sólido (el ancho real lo pone TeamTopRow/PlayerBottomRow inline con
  // edgeRowHeight, el alto lo hereda de su fila por stretch), esquinas de arriba
  // en punta (calzan con el techo recto de la lámina) y de abajo redondeadas.
  cardTopSquare: {
    backgroundColor: '#000000',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // padding no va acá: depende del alto real del cuadrado (cardBadgePaddingFor), se
    // aplica inline en cada lugar que usa este estilo (TeamTopRow/PhotoPairCornerBadge).
  },
  cardCrestBadgeImage: { width: '100%', height: '100%' },
  cardBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  // Posición de los cuadrados de PhotoPairCornerBadge — a diferencia de cardTopRow (una
  // fila flex que reparte escudo/nombre en la MISMA carta), acá cada mitad del plantel
  // pinta su propio cuadrado suelto, pegado a SU esquina exterior (izquierda para el
  // escudo, derecha para la categoría) en vez de a una fila compartida.
  photoPairCornerLeft: { position: 'absolute', top: 0, left: 0 },
  photoPairCornerRight: { position: 'absolute', top: 0, right: 0 },
  // Parche de la banda de capitán (ver CaptainArmband) — dorado como la banda real,
  // adentro del mismo cuadrado negro que usa el resto de los badges (cardBottomSquare),
  // no reemplaza a ese cuadrado.
  captainArmband: {
    width: '82%',
    height: '62%',
    backgroundColor: '#F5B400',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captainArmbandText: { color: '#000000', fontSize: 12, fontWeight: '900' },
  // Nombre del equipo: el rectángulo del medio, mismo negro sólido y mismo criterio de
  // esquinas que cardTopSquare — `flex: 1` es lo que le da "todo lo que sobra" si no
  // hay escudo.
  cardTopNameRect: {
    flex: 1,
    backgroundColor: '#000000',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: NAME_CHIP_PADDING_H,
    // paddingVertical no va acá: depende del alto real de la fila (rowNamePaddingFor),
    // se aplica inline en TeamTopRow/PlayerBottomRow.
  },
  cardTopNameText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: Platform.OS === 'web' ? '700' : '800',
    letterSpacing: NAME_CHIP_LETTER_SPACING,
    fontFamily: Platform.OS === 'web' ? NAME_CHIP_FONT_FAMILY : undefined,
    ...NO_WORD_SPLIT_STYLE,
  },
  // Fila de abajo de la lámina de jugador/DT — ver el comentario grande de
  // PlayerBottomRow: nombre del jugador (rectángulo) + posición/DT (cuadrado, siempre
  // presente salvo en el plantel), pegados al piso. Mismo alto que cardTopRow
  // (edgeRowHeight, inline en PlayerBottomRow/TeamTopRow porque depende del alto real
  // de cada lámina — ver cardEdgeRowHeightFor) por simetría.
  cardBottomRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: BADGE_NAME_GAP,
  },
  // Posición/DT, siempre presente (ver PlayerBottomRow) — mismo negro sólido que
  // cardTopSquare, pero espejado: esquinas de ABAJO en punta (calzan con el piso recto
  // de la lámina) y de ARRIBA redondeadas.
  cardBottomSquare: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // padding inline en PlayerBottomRow — mismo motivo que cardTopSquare.
  },
  // Nombre del jugador: el rectángulo que se queda con todo el ancho que sobra a la
  // izquierda del cuadrado de posición — mismo criterio de esquinas que
  // cardBottomSquare (espejado respecto de cardTopNameRect).
  cardBottomNameRect: {
    flex: 1,
    backgroundColor: '#000000',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: NAME_CHIP_PADDING_H,
    // paddingVertical no va acá: depende del alto real de la fila (rowNamePaddingFor),
    // se aplica inline en TeamTopRow/PlayerBottomRow.
  },
  cardBottomNameText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: Platform.OS === 'web' ? '700' : '800',
    letterSpacing: NAME_CHIP_LETTER_SPACING,
    fontFamily: Platform.OS === 'web' ? NAME_CHIP_FONT_FAMILY : undefined,
    ...NO_WORD_SPLIT_STYLE,
  },
  // Nombre de equipo de la lámina de escudo (ver CrestTeamName) — de punta a punta de
  // la carta, sin chip: left/right en 0 (no NAME_CHIP_WRAP_INSET, que ya lo pone el
  // <Text> centrado adentro) para que el centrado sea contra la carta ENTERA, no contra
  // un cuadro corrido hacia un lado.
  crestTeamNameWrap: {
    position: 'absolute',
    top: CREST_TEAM_NAME_TOP,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  crestTeamNameText: {
    textAlign: 'center',
    // Violeta oscuro (no negro) — contrasta contra cualquier tono pastel del mosaico
    // de atrás y encima combina con la paleta, en vez de leerse como un parche fuera
    // de lugar.
    color: '#2a1444',
    fontWeight: Platform.OS === 'web' ? '700' : '800',
    letterSpacing: NAME_CHIP_LETTER_SPACING + 0.3,
    fontFamily: Platform.OS === 'web' ? NAME_CHIP_FONT_FAMILY : undefined,
    // Sombra CLARA (no oscura): un halo blanco detrás de una letra oscura es lo que da
    // el aire "grabado en relieve" de una lámina prismática — una sombra oscura acá se
    // perdería contra el mosaico y no sumaría nada.
    textShadowColor: 'rgba(255,255,255,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    ...NO_WORD_SPLIT_STYLE,
  },

  buyBar: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  buyBtnStack: { gap: 8 },
  buyBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  // El bono del Beaudle usa el color de acento en vez del primary de los otros 2 —
  // resalta que es distinto (no consume BeauTokens ni cupo de "gratis") y que solo
  // aparece cuando de verdad hay uno disponible, ver AlbumLaminasView.
  buyBtnBonus: { backgroundColor: theme.colors.accent },
  buyBtnDisabled: { opacity: 0.4 },
  buyBtnText: { color: theme.colors.background, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  // Título + estado del sobre bono, apiladas en vez de una sola frase larga (ver el
  // comentario en AlbumLaminasView) — gap chico porque son 2 líneas de un mismo
  // mensaje, no 2 elementos independientes.
  buyBtnTextStack: { alignItems: 'center', gap: 2 },
  buyBtnSubtext: { color: theme.colors.background, fontSize: 12, fontWeight: '600', opacity: 0.85, textAlign: 'center' },

  laminasContainer: { flex: 1 },
  laminasContent: { padding: theme.spacing.md, paddingBottom: 40, gap: 10, maxWidth: 700, alignSelf: 'center', width: '100%' },
  laminasSectionTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: theme.spacing.md,
  },
  laminasEmptyText: { color: theme.colors.textMuted, fontSize: 13, padding: 8 },

  looseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 8,
  },
  looseInfo: { flex: 1 },
  // El número de figurita (código, ej. "0410") reemplaza a la miniatura que había acá
  // antes (StickerCard chica, ver el comentario de looseRow en AlbumLaminasView) — es
  // lo que de verdad identifica a la lámina; la foto grande queda para el preview.
  looseCode: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  looseName: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  looseTeam: { color: theme.colors.textMuted, fontSize: 12 },
  looseCount: { color: theme.colors.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  looseActions: { gap: 6 },
  looseActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  looseActionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
  looseActionBtnText: { color: theme.colors.background, fontSize: 12, fontWeight: '700' },
  looseActionBtnOutlineText: { color: theme.colors.text },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: theme.spacing.lg },
  // alignSelf: 'center' a propósito — sin esto el `alignItems: 'stretch'` default de
  // modalOverlay (columna flex) estira la caja al ancho completo de la pantalla, que
  // en vista de pc sobraba muchísimo alrededor de una lámina de ~180-260px de ancho.
  // Con esto la caja se achica al contenido (la StickerCard hero de adentro).
  modalBox: {
    alignSelf: 'center',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: theme.spacing.lg,
    maxHeight: '80%',
  },
  modalTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '800', marginBottom: theme.spacing.md },
  revealHero: { alignItems: 'center' },
  revealCounter: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: theme.spacing.sm },
  revealHeroSize: { width: REVEAL_CARD_WIDTH, height: REVEAL_CARD_HEIGHT },
  previewHeroSize: { width: PREVIEW_CARD_WIDTH, height: PREVIEW_CARD_HEIGHT },
  // El nombre/escudo del equipo ya van arriba de la lámina (StickerCard, igual que en
  // la grilla del álbum) — este tag es lo único que queda debajo.
  revealTag: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: theme.spacing.sm },
  revealTagNew: { color: '#22c55e' },
  revealTagDup: { color: theme.colors.textMuted },
  modalCloseBtn: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  modalCloseBtnText: { color: theme.colors.background, fontSize: 14, fontWeight: '800' },
});
