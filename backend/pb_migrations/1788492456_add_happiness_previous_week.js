/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const horarioAvailability = app.findCollectionByNameOrId("horario_availability");

    // Campo que guarda la disponibilidad de la semana anterior, para poder copiarla
    // a la semana actual. Se rellena en el hook de guardado (team_schedule.pb.js)
    // extrayendo los bloques de hace 7 días del JSON.
    horarioAvailability.fields.add(new Field({
        name: "happiness_previous_week",
        type: "json",
        required: false,
        maxSize: 8000
    }));

    app.save(horarioAvailability);
}, (app) => {
    const horarioAvailability = app.findCollectionByNameOrId("horario_availability");
    horarioAvailability.fields.removeByName("happiness_previous_week");
    app.save(horarioAvailability);
});
