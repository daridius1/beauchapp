migrate((app) => {
    const records = app.findRecordsByFilter(
        "users",
        "username = 'cefcfm'",
        "",
        1,
        0
    );
    
    if (records.length > 0) {
        const record = records[0];
        record.set("verified", true);
        app.save(record);
    }
}, (app) => {
    // rollback
});
