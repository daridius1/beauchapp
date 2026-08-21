// Formas públicas de las vistas de liga sin sesión. Sin `$app` — son transformaciones
// puras sobre registros ya cargados, así que se pueden testear con Node.
//
// Vive acá y no en public_league.pb.js porque PocketBase ejecuta cada routerAdd en una
// VM aislada: una función declarada en el scope del módulo NO existe dentro de los
// handlers (verificado: "ReferenceError: publicAccount is not defined"). Lo único que
// cruza esa frontera es un require() hecho dentro del propio handler.

// Una cuenta de equipo o liga reducida a su identidad visible. Nada de correo, tipo de
// cuenta ni relaciones: es todo lo que la vista pública necesita y nada más.
// `collectionId` va incluido porque el cliente arma las URLs de archivo con él, y para
// eso necesita el ID real de la colección — "_pb_users_auth_", la constante fija que
// PocketBase le asigna a la colección de auth base — no su nombre ("users"). Eran
// distintos y nadie lo notó porque las miniaturas sí cargaban: pasan por el proxy de
// PocketBase, que resuelve la colección solo; únicamente el escudo/avatar a tamaño
// completo va directo a R2 armando la URL con este campo, así que ahí sí importaba.
function publicAccount(record) {
    if (!record) return null;
    return {
        id: record.id,
        collectionId: "_pb_users_auth_",
        name: record.getString("name"),
        username: record.getString("username"),
        avatar: record.getString("avatar"),
        matchAlias: record.getString("matchAlias"),
        matchPhoto: record.getString("matchPhoto"),
    };
}

function publicMatch(m, teamById) {
    const byId = teamById || {};
    return {
        id: m.id,
        league: m.getString("league"),
        stage: m.getString("stage"),
        teamA: m.getString("teamA"),
        teamB: m.getString("teamB"),
        blockCode: m.getString("blockCode"),
        status: m.getString("status"),
        scoreA: m.getInt("scoreA"),
        scoreB: m.getInt("scoreB"),
        expand: {
            teamA: byId[m.getString("teamA")] || null,
            teamB: byId[m.getString("teamB")] || null,
        },
    };
}

// Filtro parametrizado `id = {:u0} || id = {:u1} || ...` a partir de una lista de ids,
// deduplicada. Una sola consulta en vez de una por equipo (PRINCIPLES.md §1), y
// parametrizada en vez de interpolada (PRINCIPLES.md §4).
//
// Devuelve `null` si no hay ningún id: quien llama debe saltarse la consulta, porque un
// filtro vacío traería la colección entera.
function buildIdFilter(ids, prefix) {
    const p = prefix || "u";
    const unicos = [];
    const vistos = {};
    for (const id of ids || []) {
        if (!id || vistos[id]) continue;
        vistos[id] = true;
        unicos.push(id);
    }
    if (!unicos.length) return null;

    const clauses = [];
    const bind = {};
    unicos.forEach((id, i) => {
        clauses.push(`id = {:${p}${i}}`);
        bind[p + i] = id;
    });
    return { filter: clauses.join(" || "), bind: bind, count: unicos.length };
}

// Igual pero sobre otro campo (por ejemplo `match` en match_reports).
function buildFieldFilter(field, ids, prefix) {
    const base = buildIdFilter(ids, prefix);
    if (!base) return null;
    const p = prefix || "u";
    const clauses = Object.keys(base.bind).map((k) => `${field} = {:${k}}`);
    return { filter: clauses.join(" || "), bind: base.bind, count: base.count };
}

module.exports = { publicAccount, publicMatch, buildIdFilter, buildFieldFilter };
