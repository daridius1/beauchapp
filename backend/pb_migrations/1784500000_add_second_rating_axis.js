/// <reference path="../pb_data/types.d.ts" />

// Segundo eje de calificación, igual al patrón de problem_ratings (rating + difficulty):
// - course_ratings: 'rating' (Calidad) + 'difficulty' (Dificultad)
// - professor_ratings: 'rating' (Clases) + 'administrative' (Administración)
migrate((app) => {
    const courseRatings = app.findCollectionByNameOrId("course_ratings");
    if (courseRatings && !courseRatings.fields.find((f) => f.name === "difficulty")) {
        courseRatings.fields.add(new Field({
            name: "difficulty",
            type: "number",
            required: false,
        }));
        app.save(courseRatings);
    }

    const professorRatings = app.findCollectionByNameOrId("professor_ratings");
    if (professorRatings && !professorRatings.fields.find((f) => f.name === "administrative")) {
        professorRatings.fields.add(new Field({
            name: "administrative",
            type: "number",
            required: false,
        }));
        app.save(professorRatings);
    }
}, (app) => {
    try {
        const courseRatings = app.findCollectionByNameOrId("course_ratings");
        courseRatings.fields.removeByName("difficulty");
        app.save(courseRatings);
    } catch (e) {}
    try {
        const professorRatings = app.findCollectionByNameOrId("professor_ratings");
        professorRatings.fields.removeByName("administrative");
        app.save(professorRatings);
    } catch (e) {}
});
