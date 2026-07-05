migrate((app) => {
  const settings = app.settings();
  settings.meta.appName = "Beauchapp";
  settings.meta.senderName = "Beauchapp";
  app.save(settings);
}, (app) => {
  return null;
});
