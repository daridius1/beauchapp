/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");

    // 1. Colección 'courses' (ramos, importados desde el scrape de ucampus)
    const courses = new Collection({
        name: "courses",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "codigo",
                type: "text",
                required: true
            },
            {
                name: "nombre",
                type: "text",
                required: false
            },
            {
                name: "area",
                type: "text",
                required: false
            },
            {
                name: "tipo",
                type: "text",
                required: false
            },
            {
                name: "prefijo",
                type: "text",
                required: false
            },
            {
                name: "semestres",
                type: "json",
                required: false
            },
            {
                name: "commentCount",
                type: "number",
                min: 0,
                noDecimal: true,
                required: false
            },
            {
                name: "quoteCount",
                type: "number",
                min: 0,
                noDecimal: true,
                required: false
            },
            {
                id: "crs_crea_01",
                name: "created",
                type: "autodate",
                onCreate: true,
                onUpdate: false
            },
            {
                id: "crs_upd_01",
                name: "updated",
                type: "autodate",
                onCreate: true,
                onUpdate: true
            }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_courses_codigo ON courses (codigo)"
        ]
    });
    app.save(courses);
    const savedCourses = app.findCollectionByNameOrId("courses");

    // 2. Colección 'professors' (profesores, importados desde el scrape de ucampus)
    const professors = new Collection({
        name: "professors",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "nombre",
                type: "text",
                required: true
            },
            {
                id: "prf_crea_01",
                name: "created",
                type: "autodate",
                onCreate: true,
                onUpdate: false
            },
            {
                id: "prf_upd_01",
                name: "updated",
                type: "autodate",
                onCreate: true,
                onUpdate: true
            }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_professors_nombre ON professors (nombre)"
        ]
    });
    app.save(professors);
    const savedProfessors = app.findCollectionByNameOrId("professors");

    // 3. Colección 'course_professors' (tabla puente: qué profesor dictó qué ramo, en qué semestres)
    const coursesProfessors = new Collection({
        name: "course_professors",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "course",
                type: "relation",
                required: true,
                collectionId: savedCourses.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "professor",
                type: "relation",
                required: true,
                collectionId: savedProfessors.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "semestres",
                type: "json",
                required: false
            },
            {
                id: "cpr_crea_01",
                name: "created",
                type: "autodate",
                onCreate: true,
                onUpdate: false
            },
            {
                id: "cpr_upd_01",
                name: "updated",
                type: "autodate",
                onCreate: true,
                onUpdate: true
            }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_course_professor ON course_professors (course, professor)"
        ]
    });
    app.save(coursesProfessors);

    // 4. Colección 'course_ratings' (estrellas de un usuario a un ramo)
    const courseRatings = new Collection({
        name: "course_ratings",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.id = user",
        updateRule: "@request.auth.id != '' && @request.auth.id = user",
        deleteRule: "@request.auth.id != '' && @request.auth.id = user",
        fields: [
            {
                name: "course",
                type: "relation",
                required: true,
                collectionId: savedCourses.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "user",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "rating",
                type: "number",
                required: false
            },
            {
                id: "crt_crea_01",
                name: "created",
                type: "autodate",
                onCreate: true,
                onUpdate: false
            },
            {
                id: "crt_upd_01",
                name: "updated",
                type: "autodate",
                onCreate: true,
                onUpdate: true
            }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_course_rating_user ON course_ratings (course, user)"
        ]
    });
    app.save(courseRatings);

    // 5. Colección 'professor_ratings' (estrellas de un usuario a un profesor)
    const professorRatings = new Collection({
        name: "professor_ratings",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.id = user",
        updateRule: "@request.auth.id != '' && @request.auth.id = user",
        deleteRule: "@request.auth.id != '' && @request.auth.id = user",
        fields: [
            {
                name: "professor",
                type: "relation",
                required: true,
                collectionId: savedProfessors.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "user",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "rating",
                type: "number",
                required: false
            },
            {
                id: "pra_crea_01",
                name: "created",
                type: "autodate",
                onCreate: true,
                onUpdate: false
            },
            {
                id: "pra_upd_01",
                name: "updated",
                type: "autodate",
                onCreate: true,
                onUpdate: true
            }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_professor_rating_user ON professor_ratings (professor, user)"
        ]
    });
    app.save(professorRatings);

}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("professor_ratings")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("course_ratings")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("course_professors")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("professors")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("courses")); } catch (e) {}
});
