/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const sellerProfilesColl = app.findCollectionByNameOrId("seller_profiles");

  sellerProfilesColl.fields.add(new Field({
    name: "telegram_handle",
    type: "text",
    required: false
  }));

  sellerProfilesColl.fields.add(new Field({
    name: "signal_phone",
    type: "text",
    required: false
  }));

  sellerProfilesColl.fields.add(new Field({
    name: "contact_email",
    type: "text",
    required: false
  }));

  app.save(sellerProfilesColl);
}, (app) => {
  const sellerProfilesColl = app.findCollectionByNameOrId("seller_profiles");
  sellerProfilesColl.fields.removeByName("telegram_handle");
  sellerProfilesColl.fields.removeByName("signal_phone");
  sellerProfilesColl.fields.removeByName("contact_email");
  app.save(sellerProfilesColl);
});
