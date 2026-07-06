migrate((app) => {
  const collection = app.findCollectionByNameOrId("communities");
  
  const record1 = new Record(collection);
  record1.set("name", "Deportes FCFM");
  record1.set("description", "Todo sobre deportes en Beauchef");
  app.save(record1);

  const record2 = new Record(collection);
  record2.set("name", "Programación");
  record2.set("description", "Para los amantes del código");
  app.save(record2);

  return;
}, (app) => {
  const records = app.findRecordsByFilter(
    "communities", 
    "name = 'Deportes FCFM' || name = 'Programación'"
  );
  records.forEach((r) => app.delete(r));
});
