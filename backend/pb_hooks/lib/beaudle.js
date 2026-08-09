// Lógica pura (sin `$app`) para Beaudle. Ver backend/pb_hooks/beaudle.pb.js para la
// orquestación con $app (find/create/save de beaudle_games y beaudle_daily_stats) y
// backend/pb_hooks/lib/__tests__/beaudle.test.js para los tests.
//
// IMPORTANTE: este arreglo de ramos es la fuente de verdad del backend. Existe una copia
// independiente en frontend/src/screens/beaudle/courses.ts (solo para la UI del selector)
// — no hay forma de compartir un módulo entre el bundle de Expo y el runtime goja de
// PocketBase en este repo, así que ambas copias deben mantenerse sincronizadas a mano.
// NO reordenar ni eliminar entradas de este arreglo una vez en producción: el índice de
// cada ramo determina qué día le toca ser el secreto (ver pickSecretForDay). Agregar
// ramos nuevos al final es seguro; reordenar/borrar no lo es (cambiaría en silencio el
// secreto de días futuros aún no jugados).

const MAX_GUESSES = 6;

const COURSES = [
    { code: "MA1001", name: "Introducción al Cálculo", department: "MA", credits: 6, semester: 1, prerequisites: [] },
    { code: "MA1101", name: "Introducción al Álgebra", department: "MA", credits: 6, semester: 1, prerequisites: [] },
    { code: "FI1000", name: "Introducción a la Física Clásica", department: "FI", credits: 6, semester: 1, prerequisites: [] },
    { code: "CC1000", name: "Herramientas Computacionales para Ingeniería y Ciencias", department: "CC", credits: 3, semester: 1, prerequisites: [] },
    { code: "CD1100", name: "Desafíos de Innovación en Ingeniería y Ciencias", department: "CD", credits: 6, semester: 1, prerequisites: [] },
    { code: "BT1211", name: "Aplicaciones de la Biología a la Ingeniería y Ciencias", department: "BT", credits: 3, semester: 1, prerequisites: [] },
    { code: "MA1002", name: "Cálculo Diferencial e Integral", department: "MA", credits: 6, semester: 2, prerequisites: ["MA1001"] },
    { code: "MA1102", name: "Álgebra Lineal", department: "MA", credits: 6, semester: 2, prerequisites: ["MA1101"] },
    { code: "FI1100", name: "Introducción a la Física Moderna", department: "FI", credits: 6, semester: 2, prerequisites: ["FI1000", "MA1101", "MA1001"] },
    { code: "CC1002", name: "Introducción a la Programación", department: "CC", credits: 6, semester: 2, prerequisites: [] },
    { code: "CD1201", name: "Proyecto de Innovación en Ingeniería y Ciencias", department: "CD", credits: 3, semester: 2, prerequisites: ["CD1100"] },
    { code: "MA2001", name: "Cálculo en Varias Variables", department: "MA", credits: 6, semester: 3, prerequisites: ["MA1002", "MA1102"] },
    { code: "MA2601", name: "Ecuaciones Diferenciales Ordinarias", department: "MA", credits: 6, semester: 3, prerequisites: ["MA1002", "MA1102"] },
    { code: "FI2001", name: "Mecánica", department: "FI", credits: 6, semester: 3, prerequisites: ["FI1100", "MA1102", "MA1002"] },
    { code: "FI2003", name: "Métodos Experimentales", department: "FI", credits: 6, semester: 3, prerequisites: ["FI1100", "MA1002"] },
    { code: "IQ2211", name: "Química", department: "IQ", credits: 6, semester: 3, prerequisites: [] },
    { code: "MA2002", name: "Cálculo Avanzado y Aplicaciones", department: "MA", credits: 6, semester: 4, prerequisites: ["MA2001", "MA2601"] },
    { code: "IN2201", name: "Economía", department: "IN", credits: 6, semester: 4, prerequisites: ["MA2001"] },
    { code: "FI2002", name: "Electromagnetismo", department: "FI", credits: 6, semester: 4, prerequisites: ["MA2001", "MA2601", "FI2003"] },
    { code: "FI2004", name: "Termodinámica", department: "FI", credits: 6, semester: 4, prerequisites: ["IQ2211", "FI2001", "MA2001"], altCode: "IQ2212", altName: "Termodinámica Química" },
    { code: "CD2201", name: "Módulo Interdisciplinario", department: "CD", credits: 3, semester: 4, prerequisites: ["CD1201"] }
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

// Elección determinística del ramo secreto del día: mismo (dayKey, salt) -> mismo ramo,
// siempre. La salt evita que la secuencia sea trivialmente adivinable leyendo el código
// fuente (ver $os.getenv("BEAUDLE_SEED_SALT") en beaudle.pb.js).
function pickSecretForDay(dayKey, courses, salt) {
    const idx = fnv1aHash(`${salt}:${dayKey}`) % courses.length;
    return courses[idx];
}

// direction: 'correct' si son iguales; si no, 'higher' cuando el valor secreto es MAYOR
// que el adivinado (hay que subir), 'lower' cuando es menor (hay que bajar).
function compareNumeric(guessValue, secretValue) {
    if (guessValue === secretValue) return "correct";
    return secretValue > guessValue ? "higher" : "lower";
}

// tie = true cuando las 3 pistas dan "correcto" pero el código adivinado NO es el
// secreto (ej. MA1001 vs secreto MA1101: mismo depto/semestre/créditos, otro ramo).
function compareGuessToSecret(guessCourse, secretCourse) {
    const department = guessCourse.department === secretCourse.department ? "correct" : "wrong";
    const semester = compareNumeric(guessCourse.semester, secretCourse.semester);
    const credits = compareNumeric(guessCourse.credits, secretCourse.credits);
    const solved = guessCourse.code === secretCourse.code;
    const tie = !solved && department === "correct" && semester === "correct" && credits === "correct";
    return { department, semester, credits, tie, solved };
}

module.exports = { MAX_GUESSES, COURSES, fnv1aHash, pickSecretForDay, compareNumeric, compareGuessToSecret };
