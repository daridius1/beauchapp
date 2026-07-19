/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Actualizar posts existentes de forma segura
  const posts = app.findRecordsByFilter("posts", "id != ''", "", 2000, 0);
  for (const post of posts) {
    const rawStr = post.getString("tags");
    if (rawStr) {
      try {
        const tags = JSON.parse(rawStr);
        if (Array.isArray(tags)) {
          const lowerTags = tags.map(t => typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim());
          post.set("tags", lowerTags);
          app.save(post);
        }
      } catch (e) {
        // Ignorar si no es JSON válido
      }
    }
  }

  // Actualizar problems existentes de forma segura
  const problems = app.findRecordsByFilter("problems", "id != ''", "", 2000, 0);
  for (const problem of problems) {
    const rawStr = problem.getString("tags");
    if (rawStr) {
      try {
        const tags = JSON.parse(rawStr);
        if (Array.isArray(tags)) {
          const lowerTags = tags.map(t => typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim());
          problem.set("tags", lowerTags);
          app.save(problem);
        }
      } catch (e) {
        // Ignorar si no es JSON válido
      }
    }
  }
}, (app) => {
  // Down migration no-op
});
