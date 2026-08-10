// Lógica pura (sin `$app`) para Beaudle. Ver backend/pb_hooks/beaudle.pb.js para la
// orquestación con $app (find/create/save de beaudle_games y beaudle_daily_stats) y
// backend/pb_hooks/lib/__tests__/beaudle.test.js para los tests.
//
// IMPORTANTE: este arreglo de lugares es la fuente de verdad del backend. Existe una
// copia independiente en frontend/src/screens/beaudle/places.ts (solo para la UI del
// selector) — no hay forma de compartir un módulo entre el bundle de Expo y el runtime
// goja de PocketBase en este repo, así que ambas copias deben mantenerse sincronizadas a
// mano. NO reordenar ni eliminar entradas de este arreglo una vez en producción: el
// índice de cada lugar determina qué día le toca ser el secreto (ver pickSecretForDay).
// Agregar lugares nuevos al final es seguro; reordenar/borrar no lo es (cambiaría en
// silencio el secreto de días futuros aún no jugados).

const MAX_GUESSES = 6;

// edificio/piso/tipo son SIEMPRE arreglos (incluso cuando el lugar solo tiene un valor)
// porque varios lugares del campus caen en más de una torre/piso/categoría a la vez —
// eso es justo lo que habilita la pista amarilla (ver compareSet): coincidencia parcial,
// no exacta.
const PLACES = [
    { code: "dcc", name: "Departamento de Ciencias de la Computación", shortName: "DCC", ubicacion: "851", edificio: ["Torre Norte", "Torre Poniente"], piso: [2, 3], tipo: ["Departamento"] },
    { code: "cmm", name: "Centro de Modelamiento Matemático", shortName: "CMM", ubicacion: "851", edificio: ["Torre Norte"], piso: [6, 7], tipo: ["Centro"] },
    { code: "dim", name: "Departamento de Ingeniería Matemática", shortName: "DIM", ubicacion: "851", edificio: ["Torre Norte"], piso: [4, 5], tipo: ["Departamento"] },
    { code: "dimec", name: "Departamento de Ingeniería Mecánica", shortName: "DIMEC", ubicacion: "851", edificio: ["Torre Poniente"], piso: [4, 5], tipo: ["Departamento"] },
    { code: "diqbm", name: "Departamento de Ingeniería Química, Biotecnología y Materiales", shortName: "DIQBM", ubicacion: "851", edificio: ["Torre Poniente"], piso: [6], tipo: ["Departamento"] },
    { code: "fablab", name: "Laboratorio de Fabricación Digital", shortName: "FabLab", ubicacion: "851", edificio: ["Torre Poniente"], piso: [3], tipo: ["Centro", "Laboratorio"] },
    { code: "openbeauchef", name: "Centro de Innovación y Emprendimiento OpenBeauchef", shortName: "OpenBeauchef", ubicacion: "851", edificio: ["Torre Poniente"], piso: [2], tipo: ["Centro"] },
    { code: "delta-te", name: "Cafetería Delta Té", shortName: "Delta Té", ubicacion: "851", edificio: ["Torre Poniente"], piso: [1], tipo: ["Servicio", "Áreas comunes"] },
    { code: "kinder", name: "Kinder", shortName: "Kinder", ubicacion: "851", edificio: ["Torre Poniente"], piso: [1], tipo: ["Áreas comunes", "Estudio"] },
    { code: "la-arana", name: "Auditorio Enrique D'Etigny", shortName: "La Araña", ubicacion: "851", edificio: ["Patio 851"], piso: [1], tipo: ["Auditorio"] },
    { code: "sala-de-artes", name: "Sala de Artes", shortName: "Sala de Artes", ubicacion: "851", edificio: ["Subterráneo", "Torre Oriente"], piso: [-3], tipo: ["Deportivo", "Artístico"] },
    { code: "dojo", name: "Dojo", shortName: "Dojo", ubicacion: "851", edificio: ["Subterráneo", "Torre Oriente"], piso: [-3], tipo: ["Deportivo"] },
    { code: "sala-de-juegos", name: "Sala de Juegos", shortName: "Sala de Juegos", ubicacion: "851", edificio: ["Subterráneo", "Torre Oriente"], piso: [-3], tipo: ["Deportivo", "Recreativo"] },
    { code: "gimnasio-851", name: "Gimnasio 851", shortName: "Gimnasio 851", ubicacion: "851", edificio: ["Subterráneo", "Torre Poniente"], piso: [-3], tipo: ["Deportivo"] },
    { code: "cancha-squash", name: "Cancha de Squash", shortName: "Cancha de Squash", ubicacion: "851", edificio: ["Subterráneo", "Torre Oriente"], piso: [-3], tipo: ["Deportivo", "Cancha"] },
    { code: "cancha-futsal-handball", name: "Cancha de Futsal/Handball", shortName: "Cancha de Futsal/Handball", ubicacion: "851", edificio: ["Subterráneo"], piso: [-3], tipo: ["Deportivo", "Cancha"] },
    { code: "cancha-volley-basket", name: "Cancha de Volley/Basket", shortName: "Cancha de Volley/Basket", ubicacion: "851", edificio: ["Subterráneo", "Torre Norte"], piso: [-3], tipo: ["Deportivo", "Cancha"] },
    { code: "cdi", name: "Centro Deportivo de Ingeniería", shortName: "CDI", ubicacion: "851", edificio: ["Subterráneo", "Torre Oriente"], piso: [-3], tipo: ["Oficina", "CCEE"] },
    { code: "adefa", name: "Área de Deportes, Educación Física y Expresiones Artísticas", shortName: "ADEFA", ubicacion: "851", edificio: ["Subterráneo", "Torre Oriente"], piso: [-3], tipo: ["Oficina"] },
    { code: "escalera-caracol", name: "Escalera Caracol", shortName: "Escalera Caracol", ubicacion: "851", edificio: ["Subterráneo"], piso: [-1, -2, -3, 1], tipo: ["Infraestructura"] },
    { code: "piscina", name: "Piscina", shortName: "Piscina", ubicacion: "851", edificio: ["Subterráneo"], piso: [-1], tipo: ["Deportivo"] },
    { code: "camarines-851", name: "Camarines 851", shortName: "Camarines 851", ubicacion: "851", edificio: ["Subterráneo"], piso: [-3], tipo: ["Infraestructura", "Deportivo"] },
    { code: "cec", name: "CEC", shortName: "CEC", ubicacion: "851", edificio: ["Subterráneo", "Torre Norte"], piso: [-1], tipo: ["Laboratorio", "Estudio"] },
    { code: "barras-calistenia", name: "Barras de Calistenia", shortName: "Barras de Calistenia", ubicacion: "850", edificio: ["Patio 850"], piso: [1], tipo: ["Deportivo"] },
    { code: "multicancha-850", name: "Multicancha 850", shortName: "Multicancha 850", ubicacion: "850", edificio: ["Patio 850"], piso: [1], tipo: ["Deportivo", "Cancha"] },
    { code: "terraza-ebria", name: "Terraza Ebria", shortName: "Terraza Ebria", ubicacion: "850", edificio: ["Patio 850"], piso: [2], tipo: ["Áreas comunes"] },
    { code: "el-muerto", name: "El Muerto", shortName: "El Muerto", ubicacion: "850", edificio: ["Patio 850"], piso: [1], tipo: ["Patrimonio"] },
    { code: "carrito", name: "Carrito", shortName: "Carrito", ubicacion: "850", edificio: ["Patio 850"], piso: [1], tipo: ["Servicio"] },
    { code: "pajarera", name: "Pajarera", shortName: "Pajarera", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [2], tipo: ["Áreas comunes", "Estudio"] },
    { code: "a2ic", name: "A2IC", shortName: "A2IC", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [3], tipo: ["Centro", "Oficina"] },
    { code: "zocalo", name: "Zócalo", shortName: "Zócalo", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [-1], tipo: ["Sala", "Área común"] },
    { code: "auditorio-gorbea", name: "Auditorio Gorbea", shortName: "Auditorio Gorbea", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [3], tipo: ["Auditorio"] },
    { code: "hall-sur", name: "Hall Sur", shortName: "Hall Sur", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [1], tipo: ["Áreas comunes"] },
    { code: "biblioteca-850", name: "Biblioteca 850", shortName: "Biblioteca 850", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [1, 2, 3], tipo: ["Áreas comunes", "Estudio"] },
    { code: "la-mona", name: "Estatua de Minerva", shortName: "La Mona", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [1], tipo: ["Patrimonio"] },
    { code: "terraza-sobria", name: "Terraza Sobria", shortName: "Terraza Sobria", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [1], tipo: ["Áreas comunes"] },
    { code: "cafeta-850", name: "Cafetería 850", shortName: "Cafeta 850", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [-1], tipo: ["Áreas comunes", "Servicio"] },
    { code: "decanato", name: "Decanato FCFM", shortName: "Decanato", ubicacion: "850", edificio: ["Torre Justicia Espada"], piso: [8], tipo: ["Oficina"] },
    { code: "el-piano", name: "El Piano", shortName: "El Piano", ubicacion: "850", edificio: ["Torre Justicia Espada"], piso: [8], tipo: ["Patrimonio"] },
    { code: "gmi", name: "Grupo de Música de Ingeniería", shortName: "GMI", ubicacion: "Casa CEI", edificio: ["Casa CEI"], piso: [1], tipo: ["Sala", "GGOO"] },
    { code: "oficina-cei", name: "Oficina Centro de Estudiantes de Ingeniería", shortName: "Oficina CEI", ubicacion: "Casa CEI", edificio: ["Casa CEI"], piso: [2], tipo: ["Oficina", "CCEE"] },
    { code: "casino", name: "Casino Domeyko", shortName: "Casino", ubicacion: "Domeyko", edificio: ["Domeyko"], piso: [1, 2, 3], tipo: ["Áreas comunes", "Servicio"] },
    { code: "gimnasio-domeyko", name: "Gimnasio Polideportivo Domeyko", shortName: "Gimnasio Domeyko", ubicacion: "Domeyko", edificio: ["Domeyko"], piso: [1], tipo: ["Deportivo", "Cancha"] },
    { code: "camarines-domeyko", name: "Camarines Domeyko", shortName: "Camarines Domeyko", ubicacion: "Domeyko", edificio: ["Domeyko"], piso: [1], tipo: ["Infraestructura", "Deportivo"] },
    { code: "muro-escalada", name: "Muro de Escalada", shortName: "Muro de Escalada", ubicacion: "Domeyko", edificio: ["Domeyko"], piso: [1], tipo: ["Deportivo"] },
];

// FNV-1a de 32 bits, escrito a mano — goja no expone ninguna librería de hashing al JSVM.
function fnv1aHash(str) {
    let hash = 0x811c9dc5; // offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        // hash *= 16777619 (primo FNV) hecho con shifts para no salirse de 32 bits sin signo
        hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
    }
    return hash >>> 0;
}

// Elección determinística del lugar secreto del día: mismo (dayKey, salt) -> mismo
// lugar, siempre. La salt evita que la secuencia sea trivialmente adivinable leyendo el
// código fuente (ver $os.getenv("BEAUDLE_SEED_SALT") en beaudle.pb.js).
function pickSecretForDay(dayKey, places, salt) {
    const idx = fnv1aHash(`${salt}:${dayKey}`) % places.length;
    return places[idx];
}

// Comparación de atributos con VARIOS valores a la vez (edificio/piso/tipo): "correct"
// si son exactamente el mismo conjunto, "partial" (la pista amarilla) si comparten al
// menos un valor pero no son iguales, "wrong" si no comparten ninguno. Sin Set/spread a
// propósito (mismo estilo defensivo que el resto de este proyecto para el runtime goja).
function compareSet(guessValues, secretValues) {
    const sameSize = guessValues.length === secretValues.length;
    const sameSet = sameSize && guessValues.every((v) => secretValues.indexOf(v) !== -1);
    if (sameSet) return "correct";
    const overlaps = guessValues.some((v) => secretValues.indexOf(v) !== -1);
    return overlaps ? "partial" : "wrong";
}

// tie = true cuando las 4 pistas dan "correcto" pero el lugar adivinado NO es el secreto
// (dos lugares distintos con exactamente la misma ubicación/edificio/piso/tipo).
function compareGuessToSecret(guessPlace, secretPlace) {
    const ubicacion = guessPlace.ubicacion === secretPlace.ubicacion ? "correct" : "wrong";
    const edificio = compareSet(guessPlace.edificio, secretPlace.edificio);
    const piso = compareSet(guessPlace.piso, secretPlace.piso);
    const tipo = compareSet(guessPlace.tipo, secretPlace.tipo);
    const solved = guessPlace.code === secretPlace.code;
    const tie = !solved && ubicacion === "correct" && edificio === "correct" && piso === "correct" && tipo === "correct";
    return { ubicacion, edificio, piso, tipo, tie, solved };
}

// Numeración de "Beaudle #N": no se calcula por diff de fechas contra un día épico fijo
// — se asigna sobre la marcha, incrementando desde el último beaudle_daily_stats que
// exista para esa variante (0 si es el primero). Si un día calendario entero pasa sin
// que nadie juegue, ese día nunca genera fila y no consume número — no hay huecos que
// rellenar ni backfill posible.
function nextDayNumber(prevDayNumber) {
    return (prevDayNumber || 0) + 1;
}

// Actualiza la racha de un usuario al completar (ganar o perder, da lo mismo) el Beaudle
// del día EXACTO en que le tocaba (nunca al jugar un día atrasado — eso lo filtra quien
// llama a esta función, pasándole solo completions on-time). Si completedDay es
// exactamente el día siguiente a lastStreakDay, la racha sigue; en cualquier otro caso
// (primera vez, hueco, dato raro) arranca de nuevo en 1. Comparación de fechas vía
// Date.UTC sobre strings puros "YYYY-MM-DD" (sin hora) — el diff en días es exacto sin
// importar el huso horario del server.
function computeStreakUpdate(prevStreak, prevBestStreak, lastStreakDay, completedDay) {
    let continuesStreak = false;
    if (lastStreakDay) {
        const prevParts = lastStreakDay.split('-').map(Number);
        const curParts = completedDay.split('-').map(Number);
        const prevMs = Date.UTC(prevParts[0], prevParts[1] - 1, prevParts[2]);
        const curMs = Date.UTC(curParts[0], curParts[1] - 1, curParts[2]);
        const diffDays = Math.round((curMs - prevMs) / 86400000);
        continuesStreak = diffDays === 1;
    }

    const streak = continuesStreak ? (prevStreak || 0) + 1 : 1;
    const bestStreak = Math.max(prevBestStreak || 0, streak);
    return { streak, bestStreak, lastStreakDay: completedDay };
}

module.exports = {
    MAX_GUESSES, PLACES, fnv1aHash, pickSecretForDay, compareSet, compareGuessToSecret,
    nextDayNumber, computeStreakUpdate,
};
