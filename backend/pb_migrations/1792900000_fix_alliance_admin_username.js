/// <reference path="../pb_data/types.d.ts" />

// La cuenta real del CEI usa el username histórico CEIuchile. La migración inicial
// buscaba "cei", por lo que no encontraba la organización existente en producción.
migrate((app) => {
    try {
        const cei = app.findFirstRecordByFilter(
            "users", "username = {:username}", { username: "CEIuchile" }
        );
        if (cei.getString("type") === "organization") {
            cei.set("subtype", "alliance");
            app.save(cei);
        }
    } catch (notFound) { /* una base local puede no tener la cuenta del CEI */ }
}, (app) => {
    try {
        const cei = app.findFirstRecordByFilter(
            "users", "username = {:username}", { username: "CEIuchile" }
        );
        if (cei.getString("subtype") === "alliance") {
            cei.set("subtype", "center");
            app.save(cei);
        }
    } catch (notFound) {}
});
