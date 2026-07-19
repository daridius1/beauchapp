/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  function cleanTag(t) {
    let s = typeof t === 'string' ? t : String(t);
    return s.toLowerCase()
            .replace(/[áäâà]/g, "a")
            .replace(/[éëêè]/g, "e")
            .replace(/[íïîì]/g, "i")
            .replace(/[óöôò]/g, "o")
            .replace(/[úüûù]/g, "u")
            .replace(/[ñ]/g, "n")
            .replace(/[^a-z0-9]/g, "")
            .trim();
  }

  // 1. Limpiar posts
  const posts = app.findRecordsByFilter("posts", "id != ''", "", 2000, 0);
  let cleanedPostsCount = 0;
  for (const post of posts) {
    const rawStr = post.getString("tags");
    if (rawStr) {
      try {
        const tags = JSON.parse(rawStr);
        if (Array.isArray(tags)) {
          const cleaned = tags.map(cleanTag).filter(Boolean);
          const uniqueTags = Array.from(new Set(cleaned));
          post.set("tags", uniqueTags);
          app.save(post);
          cleanedPostsCount++;
        }
      } catch (err) {
        console.log("Error cleaning post tags", post.id, err);
      }
    }
  }
  console.log(`[CLEANUP] Cleaned accented/invalid tags for ${cleanedPostsCount} posts.`);

  // 2. Limpiar problems
  const problems = app.findRecordsByFilter("problems", "id != ''", "", 2000, 0);
  let cleanedProblemsCount = 0;
  for (const problem of problems) {
    const rawStr = problem.getString("tags");
    if (rawStr) {
      try {
        const tags = JSON.parse(rawStr);
        if (Array.isArray(tags)) {
          const cleaned = tags.map(cleanTag).filter(Boolean);
          const uniqueTags = Array.from(new Set(cleaned));
          problem.set("tags", uniqueTags);
          app.save(problem);
          cleanedProblemsCount++;
        }
      } catch (err) {
        console.log("Error cleaning problem tags", problem.id, err);
      }
    }
  }
  console.log(`[CLEANUP] Cleaned accented/invalid tags for ${cleanedProblemsCount} problems.`);
}, (app) => {
  // Down migration no-op
});
