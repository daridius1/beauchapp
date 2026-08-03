/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const laddersColl = app.findCollectionByNameOrId("ladders");
  
  const defaultLadders = [
    {
      id: "tacatacaladder1",
      name: "Taca Taca",
      slug: "taca-taca",
      icon: "activity",
      description: "Ranking oficial de Taca Taca en la FCFM. Partidos 2v2 a 5 goles.",
      max_score: 10,
      allowed_modes: JSON.stringify(["1v1", "2v2"]),
      is_active: true
    },
    {
      id: "tenisdemesalad1",
      name: "Tenis de Mesa",
      slug: "tenis-de-mesa",
      icon: "activity",
      description: "Ranking oficial de Tenis de Mesa (Ping Pong) FCFM.",
      max_score: 11,
      allowed_modes: JSON.stringify(["1v1", "2v2"]),
      is_active: true
    },
    {
      id: "tiptapladder101",
      name: "TipTap",
      slug: "tiptap",
      icon: "activity",
      description: "Competencia oficial de TipTap 1v1 FCFM.",
      max_score: 30,
      allowed_modes: JSON.stringify(["1v1"]),
      is_active: true
    },
    {
      id: "ajedrezladder10",
      name: "Ajedrez",
      slug: "ajedrez",
      icon: "chess-king",
      description: "Ranking oficial de Ajedrez en la FCFM.",
      max_score: 1,
      allowed_modes: JSON.stringify(["1v1"]),
      is_active: true
    }
  ];

  for (const item of defaultLadders) {
    try {
      app.findFirstRecordByFilter("ladders", `slug = '${item.slug}'`);
    } catch (err) {
      // Record missing, create it
      const rec = new Record(laddersColl);
      rec.set("id", item.id);
      rec.set("name", item.name);
      rec.set("slug", item.slug);
      rec.set("icon", item.icon);
      rec.set("description", item.description);
      rec.set("max_score", item.max_score);
      rec.set("allowed_modes", item.allowed_modes);
      rec.set("is_active", item.is_active);
      app.save(rec);
    }
  }
}, (app) => {});
