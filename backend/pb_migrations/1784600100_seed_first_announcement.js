/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const collection = app.findCollectionByNameOrId("announcements");

    const title = "Bienvenida: normas y privacidad de Beauchapp";

    try {
        app.findFirstRecordByFilter("announcements", "title = {:title}", { title: title });
        return; // Ya existe
    } catch (err) {}

    const body = `## Qué es Beauchapp

Beauchapp es una plataforma hecha y gestionada por un estudiante de la facultad, pensada como un espacio no anónimo que potencie la vida universitaria: pauteo colaborativo, ladders de deportes, marketplace y más. El no-anonimato existe a propósito, para mantener el respeto y la sana convivencia.

## Normas de convivencia

- El trato respetuoso es obligatorio en todo el contenido que se publique.
- Está prohibido difamar, funar, acosar, insultar o incitar a la mala conducta.
- El equipo se reserva el derecho de eliminar contenido y de suspender o eliminar cuentas que incumplan estas normas.
- Si ves algo que no corresponde, repórtalo: en cualquier publicación, comentario, perfil o producto vas a encontrar un botón "⋮" con la opción "Reportar".

## Privacidad y datos

- Beauchapp no tiene fines de lucro.
- Se recolecta solo la información mínima necesaria para que la plataforma funcione.
- Ese compromiso es real: no se revisan tus datos, salvo lo estrictamente necesario para el funcionamiento técnico, o para colaborar con una investigación académica formal y seria de la universidad.
- Por ejemplo, en Tinder Beauchef guardamos tus likes y matches — es la única forma viable de que esa funcionalidad pueda existir. Hoy no están anonimizados del lado del servidor (por costo técnico de implementación), pero el compromiso de no revisarlos es el mismo que con cualquier otro dato de la plataforma.
- Por eso, por ejemplo, no existe un chat dentro de la app: cualquier contacto se coordina a través de otras plataformas (WhatsApp, Instagram, Telegram, etc.).

## Contacto

¿Bugs, problemas o sugerencias? Escribe por Telegram a @MatadorMarceloSalas1994, o usa el botón de reporte/sugerencia en la sección "Info y Políticas" de Ajustes.`;

    const record = new Record(collection);
    record.set("title", title);
    record.set("body", body);
    app.save(record);
}, (app) => {
    try {
        const record = app.findFirstRecordByFilter("announcements", "title = 'Bienvenida: normas y privacidad de Beauchapp'");
        if (record) app.delete(record);
    } catch (e) {}
});
