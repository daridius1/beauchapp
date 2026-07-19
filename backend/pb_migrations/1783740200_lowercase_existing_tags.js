/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Actualizar posts existentes
  const posts = app.findRecordsByFilter("posts", "id != ''", "", 2000, 0);
  for (const post of posts) {
    const tags = post.get("tags");
    if (tags && tags.length > 0) {
      const lowerTags = tags.map(t => typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim());
      post.set("tags", lowerTags);
      app.save(post);
    }
  }

  // Actualizar problems existentes
  const problems = app.findRecordsByFilter("problems", "id != ''", "", 2000, 0);
  for (const problem of problems) {
    const tags = problem.get("tags");
    if (tags && tags.length > 0) {
      const lowerTags = tags.map(t => typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim());
      problem.set("tags", lowerTags);
      app.save(problem);
    }
  }
}, (app) => {
  // Down migration no-op
});
