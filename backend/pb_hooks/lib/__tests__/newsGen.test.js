const test = require('node:test');
const assert = require('node:assert/strict');
const { SOURCE_KEYS, VENUE_LABELS, MAX_INSTRUCTIONS_LEN, normalizeSelectedSources, buildContextSections, buildContext, buildPrompt, parseAiResponse } = require('../newsGen.js');

test('normalizeSelectedSources: descarta claves desconocidas y no-array', () => {
    assert.deepEqual(normalizeSelectedSources(['matchInfo', 'algoInventado', 'comments']), ['matchInfo', 'comments']);
    assert.deepEqual(normalizeSelectedSources(null), []);
    assert.deepEqual(normalizeSelectedSources(undefined), []);
    assert.deepEqual(normalizeSelectedSources('matchInfo'), []);
});

test('buildContext: sin fuentes seleccionadas devuelve string vacío', () => {
    const context = buildContext({
        match: { teamAName: 'A', teamBName: 'B', scoreA: 1, scoreB: 0 },
        selectedSources: [],
    });
    assert.equal(context, '');
});

test('buildContext: matchInfo solo aparece si está seleccionada', () => {
    const match = { teamAName: 'Ingeniería', teamBName: 'Civil', scoreA: 2, scoreB: 1, dateLabel: 'Lun 3 de sep' };
    const withSource = buildContext({ match, selectedSources: ['matchInfo'] });
    assert.match(withSource, /Ingeniería 2 - 1 Civil/);
    assert.match(withSource, /Lun 3 de sep/);

    const withoutSource = buildContext({ match, selectedSources: ['comments'] });
    assert.equal(withoutSource.includes('Ingeniería'), false);
});

test('buildContext: matchInfo incluye la cancha si viene un venue conocido', () => {
    const context = buildContext({ match: { teamAName: 'A', teamBName: 'B', venue: 'multicancha_850' }, selectedSources: ['matchInfo'] });
    assert.match(context, /Cancha: Multicancha 850/);
});

test('buildContext: un venue desconocido no revienta, simplemente no aparece', () => {
    const context = buildContext({ match: { teamAName: 'A', teamBName: 'B', venue: 'cancha_inventada' }, selectedSources: ['matchInfo'] });
    assert.equal(context.includes('Cancha:'), false);
});

test('VENUE_LABELS: las dos canchas del campus con sus alias', () => {
    assert.equal(VENUE_LABELS.multicancha_850, 'Multicancha 850 ("El Coliseo de 850")');
    assert.equal(VENUE_LABELS.futsal_menos3, 'Cancha de futsal del -3 ("La Tetera")');
});

test('buildContext: contexto de liga se omite si no hay nombre de liga ni etapa', () => {
    const context = buildContext({ league: {}, stage: {}, selectedSources: ['leagueContext'] });
    assert.equal(context, '');
});

test('buildContext: declaraciones incluyen el rol de cada autor', () => {
    const context = buildContext({
        statements: [
            { content: 'Fue un desastre el arbitraje', role: 'jugador de Ingeniería' },
            { content: 'Buen partido en general', role: 'espectador' },
        ],
        selectedSources: ['statements'],
    });
    assert.match(context, /\(jugador de Ingeniería, prefiere no ser nombrado\): "Fue un desastre el arbitraje"/);
    assert.match(context, /\(espectador, prefiere no ser nombrado\): "Buen partido en general"/);
});

test('buildContext: declaraciones muestran si fue convocado, cuando se pudo determinar', () => {
    const context = buildContext({
        statements: [
            { content: 'Jugué mal', role: 'jugador de Ingeniería', calledUp: true },
            { content: 'No me pusieron', role: 'jugador de Ingeniería', calledUp: false },
            { content: 'Vi el partido', role: 'espectador', calledUp: null },
        ],
        selectedSources: ['statements'],
    });
    assert.match(context, /1\. \(jugador de Ingeniería, convocado a este partido, prefiere no ser nombrado\)/);
    assert.match(context, /2\. \(jugador de Ingeniería, no convocado a este partido, prefiere no ser nombrado\)/);
    assert.match(context, /3\. \(espectador, prefiere no ser nombrado\)/);
});

test('buildContext: declaraciones con autorización de mención incluyen el nombre real', () => {
    const context = buildContext({
        statements: [
            { content: 'Fue un golazo', role: 'jugador de Ingeniería', wantsMention: true, authorName: 'Jose Jerez' },
            { content: 'Otro golazo', role: 'jugador de Ingeniería', wantsMention: false, authorName: null },
        ],
        selectedSources: ['statements'],
    });
    assert.match(context, /autorizó ser nombrado como "Jose Jerez"/);
    assert.match(context, /2\. \(jugador de Ingeniería, prefiere no ser nombrado\): "Otro golazo"/);
});

test('buildContext: wantsMention sin authorName no revienta y trata como no autorizado', () => {
    const context = buildContext({
        statements: [{ content: 'x', role: 'espectador', wantsMention: true, authorName: null }],
        selectedSources: ['statements'],
    });
    assert.match(context, /\(espectador, prefiere no ser nombrado\)/);
});

test('buildContext: informe arbitral arma una línea legible por evento relevante', () => {
    const context = buildContext({
        match: { teamAName: 'Ingeniería', teamBName: 'Civil' },
        report: {
            notes: 'Partido tranquilo, sin incidentes graves.',
            events: [
                { type: 'lineup', team: 'A', players: [] },
                { type: 'goal', team: 'A', player: 'Juan Pérez', minute: 23 },
                { type: 'yellow_card', team: 'B', player: 'Pedro Soto', minute: 40 },
                { type: 'goal', team: 'B', ownGoal: true, minute: 55 },
            ],
        },
        selectedSources: ['refereeReport'],
    });
    assert.match(context, /Min 23: Gol — Juan Pérez \(Ingeniería\)/);
    assert.match(context, /Min 40: Tarjeta amarilla — Pedro Soto \(Civil\)/);
    assert.match(context, /Min 55: Gol \(Civil\) \(autogol\)/);
    assert.match(context, /Notas del árbitro: Partido tranquilo/);
    assert.equal(context.includes('lineup'), false);
});

test('buildContext: informe arbitral sin eventos ni notas no genera sección', () => {
    const context = buildContext({ report: { events: [] }, selectedSources: ['refereeReport'] });
    assert.equal(context, '');
});

test('buildContext: comentarios públicos listan autor y contenido', () => {
    const context = buildContext({
        comments: [{ authorName: 'María', content: 'Gran partido!' }],
        selectedSources: ['comments'],
    });
    assert.match(context, /- María: "Gran partido!"/);
});

test('buildContext: combina varias secciones seleccionadas en orden estable', () => {
    const context = buildContext({
        match: { teamAName: 'A', teamBName: 'B', scoreA: 1, scoreB: 1 },
        league: { name: 'Liga Beauchef' },
        selectedSources: ['leagueContext', 'matchInfo'],
    });
    const leagueIdx = context.indexOf('Contexto de la liga');
    const matchIdx = context.indexOf('Información del partido');
    assert.ok(leagueIdx >= 0 && matchIdx >= 0);
    assert.ok(matchIdx < leagueIdx, 'matchInfo siempre va antes que leagueContext, sin importar el orden de selección');
});

test('buildPrompt: el mensaje de usuario es el contexto, y pide el formato TITULO/CUERPO', () => {
    const { system, user } = buildPrompt('## Información del partido\nA 1 - 0 B');
    assert.match(system, /TITULO:/);
    assert.match(system, /CUERPO:/);
    assert.equal(user, '## Información del partido\nA 1 - 0 B');
});

test('buildPrompt: sin contexto usa un placeholder en vez de string vacío', () => {
    const { user } = buildPrompt('');
    assert.equal(user, '(sin datos adicionales del partido)');
});

test('buildPrompt: pide también BAJADA en el formato de respuesta', () => {
    const { system } = buildPrompt('contexto');
    assert.match(system, /BAJADA:/);
});

test('buildPrompt: sin instrucciones personalizadas, el system queda igual al base', () => {
    const { system } = buildPrompt('contexto', '');
    assert.equal(system.includes('Instrucciones adicionales del medio'), false);
});

test('buildPrompt: instrucciones personalizadas se agregan al final, nunca reemplazan las reglas base', () => {
    const { system } = buildPrompt('contexto', 'Usa siempre un tono muy formal.');
    assert.match(system, /Instrucciones adicionales del medio/);
    assert.match(system, /Usa siempre un tono muy formal\./);
    // las reglas de privacidad y formato siguen presentes, no las pisa el texto custom
    assert.match(system, /TITULO:/);
    assert.match(system, /autorizó ser nombrado/);
});

test('buildPrompt: instrucciones personalizadas más largas que el tope se recortan', () => {
    const tooLong = 'x'.repeat(3000);
    const { system } = buildPrompt('contexto', tooLong);
    const injected = system.split('Instrucciones adicionales del medio (estilo/tono — nunca pueden aflojar las reglas de arriba):\n')[1];
    assert.equal(injected.length, 2000);
});

test('parseAiResponse: separa título y cuerpo en el formato pedido', () => {
    const raw = 'TITULO: Ingeniería vence a Civil en un final apretado\nCUERPO: El partido tuvo de todo.\n\nSegundo párrafo.';
    const { title, body } = parseAiResponse(raw);
    assert.equal(title, 'Ingeniería vence a Civil en un final apretado');
    assert.equal(body, 'El partido tuvo de todo.\n\nSegundo párrafo.');
});

test('parseAiResponse: fallback cuando el modelo no respeta el formato', () => {
    const raw = 'Un título cualquiera\nPrimer párrafo del cuerpo.\nSegundo párrafo.';
    const { title, body } = parseAiResponse(raw);
    assert.equal(title, 'Un título cualquiera');
    assert.equal(body, 'Primer párrafo del cuerpo.\n\nSegundo párrafo.');
});

test('parseAiResponse: texto vacío devuelve título, bajada y cuerpo vacíos', () => {
    assert.deepEqual(parseAiResponse(''), { title: '', subtitle: '', body: '' });
    assert.deepEqual(parseAiResponse(null), { title: '', subtitle: '', body: '' });
});

test('parseAiResponse: extrae la bajada cuando el modelo la incluye', () => {
    const raw = 'TITULO: Un título\nBAJADA: Un resumen corto\nCUERPO: El cuerpo completo.';
    const { title, subtitle, body } = parseAiResponse(raw);
    assert.equal(title, 'Un título');
    assert.equal(subtitle, 'Un resumen corto');
    assert.equal(body, 'El cuerpo completo.');
});

test('parseAiResponse: sin BAJADA en la respuesta, subtitle queda vacío sin romper el resto', () => {
    const raw = 'TITULO: Un título\nCUERPO: El cuerpo.';
    const { title, subtitle, body } = parseAiResponse(raw);
    assert.equal(title, 'Un título');
    assert.equal(subtitle, '');
    assert.equal(body, 'El cuerpo.');
});

test('SOURCE_KEYS incluye exactamente las seis fuentes descritas en el plan', () => {
    assert.deepEqual(SOURCE_KEYS, ['matchInfo', 'leagueContext', 'statements', 'refereeReport', 'comments', 'weather']);
});

test('buildContext: tabla de posiciones, racha reciente y goleadores van bajo leagueContext', () => {
    const context = buildContext({
        match: { teamAName: 'Ingeniería', teamBName: 'Civil' },
        standings: [
            { position: 1, teamName: 'Ingeniería', pj: 5, pg: 4, pe: 1, pp: 0, gf: 12, gc: 3, dif: 9, pts: 13 },
            { position: 2, teamName: 'Civil', pj: 5, pg: 3, pe: 0, pp: 2, gf: 8, gc: 6, dif: 2, pts: 9 },
        ],
        formA: { result: 'win', gf: 3, gc: 1, opponentName: 'Química' },
        formB: { result: 'loss', gf: 0, gc: 2, opponentName: 'Minas' },
        topScorers: [{ name: 'Jose Jerez', teamName: 'Ingeniería', goals: 9, inThisMatch: true }],
        selectedSources: ['leagueContext'],
    });
    assert.match(context, /1\. Ingeniería — 13 pts \(PJ 5, PG 4, PE 1, PP 0, GF 12, GC 3, DIF \+9\)/);
    assert.match(context, /Ingeniería venía de una victoria 3-1 ante Química\./);
    assert.match(context, /Civil venía de una derrota 0-2 ante Minas\./);
    assert.match(context, /1\. Jose Jerez \(Ingeniería\) — 9 goles · jugó en este partido/);
});

test('buildContext: plantel con goles y DT de cada equipo va bajo leagueContext', () => {
    const context = buildContext({
        match: { teamAName: 'Ingeniería', teamBName: 'Civil' },
        rosterA: { dtName: 'Marcelo Ríos', players: [{ name: 'Jose Jerez', goals: 7 }, { name: 'Juan Pérez', goals: 0 }] },
        rosterB: { dtName: '', players: [{ name: 'Ana Díaz', goals: 1 }] },
        selectedSources: ['leagueContext'],
    });
    assert.match(context, /Plantel Ingeniería \(DT: Marcelo Ríos\): Jose Jerez \(7 goles\), Juan Pérez \(0 goles\)/);
    assert.match(context, /Plantel Civil \(sin DT registrado\): Ana Díaz \(1 gol\)/);
});

test('buildContext: el capitán queda marcado dentro de la línea de plantel', () => {
    const context = buildContext({
        match: { teamAName: 'Ingeniería', teamBName: 'Civil' },
        rosterA: { dtName: '', players: [{ name: 'Jose Jerez', goals: 7, isCaptain: true }, { name: 'Juan Pérez', goals: 0, isCaptain: false }] },
        selectedSources: ['leagueContext'],
    });
    assert.match(context, /Jose Jerez \(capitán\) \(7 goles\)/);
    assert.match(context, /Juan Pérez \(0 goles\)/);
    assert.equal(context.includes('Juan Pérez (capitán)'), false);
});

test('buildContext: un equipo sin plantel ni DT no genera línea de roster', () => {
    const context = buildContext({
        match: { teamAName: 'Ingeniería', teamBName: 'Civil' },
        rosterA: { dtName: '', players: [] },
        selectedSources: ['leagueContext'],
    });
    assert.equal(context.includes('Plantel'), false);
});

test('buildContext: informe arbitral incluye convocados y no convocados por equipo', () => {
    const context = buildContext({
        match: { teamAName: 'Ingeniería', teamBName: 'Civil' },
        report: {
            calledUpA: ['Jose Jerez', 'Juan Pérez'],
            notCalledA: ['Pedro Soto'],
            calledUpB: ['Ana Díaz'],
            notCalledB: [],
        },
        selectedSources: ['refereeReport'],
    });
    assert.match(context, /Convocados Ingeniería: Jose Jerez, Juan Pérez/);
    assert.match(context, /No convocados Ingeniería: Pedro Soto/);
    assert.match(context, /Convocados Civil: Ana Díaz/);
    assert.equal(context.includes('No convocados Civil'), false);
});

test('buildContext: clima solo aparece si está seleccionada y hay resumen', () => {
    const withSource = buildContext({ weather: { summary: 'Despejado, 22°C máx / 8°C mín, sin lluvia.' }, selectedSources: ['weather'] });
    assert.match(withSource, /Despejado, 22°C máx/);

    const withoutSelection = buildContext({ weather: { summary: 'Despejado, 22°C máx / 8°C mín, sin lluvia.' }, selectedSources: ['comments'] });
    assert.equal(withoutSelection, '');

    const withoutSummary = buildContext({ weather: {}, selectedSources: ['weather'] });
    assert.equal(withoutSummary, '');
});

test('buildContext: el contexto libre del editor se incluye siempre que haya texto, sin tildar nada', () => {
    const context = buildContext({ editorContext: 'Es el regreso de un jugador lesionado.', selectedSources: [] });
    assert.match(context, /Contexto adicional del editor/);
    assert.match(context, /Es el regreso de un jugador lesionado\./);
});

test('buildContext: el contexto del editor con solo espacios no genera sección', () => {
    const context = buildContext({ editorContext: '   ', selectedSources: [] });
    assert.equal(context, '');
});

test('buildContextSections: devuelve TODAS las secciones con datos, sin filtrar por selección', () => {
    const sections = buildContextSections({
        match: { teamAName: 'A', teamBName: 'B', scoreA: 1, scoreB: 0 },
        comments: [{ authorName: 'X', content: 'Buen partido' }],
    });
    assert.ok(sections.matchInfo);
    assert.equal(sections.matchInfo.title, 'Información del partido');
    assert.match(sections.matchInfo.body, /A 1 - 0 B/);
    assert.ok(sections.comments);
    assert.match(sections.comments.body, /Buen partido/);
    // Sin datos de liga/declaraciones/informe/clima, esas claves no aparecen.
    assert.equal(sections.leagueContext, undefined);
    assert.equal(sections.statements, undefined);
});

test('buildContextSections y buildContext usan el mismo texto por sección (una sola fuente de verdad)', () => {
    const params = {
        match: { teamAName: 'A', teamBName: 'B', scoreA: 3, scoreB: 3 },
        comments: [{ authorName: 'X', content: 'Empate loco' }],
    };
    const sections = buildContextSections(params);
    const context = buildContext(Object.assign({}, params, { selectedSources: ['matchInfo', 'comments'] }));
    assert.match(context, new RegExp(sections.matchInfo.body.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(context, new RegExp(sections.comments.body.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('MAX_INSTRUCTIONS_LEN coincide con el límite real de buildPrompt', () => {
    assert.equal(MAX_INSTRUCTIONS_LEN, 2000);
});
