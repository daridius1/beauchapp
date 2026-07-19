/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  function decodeASCIIArray(arr) {
    if (!Array.isArray(arr)) return arr;
    if (arr.length === 0) return arr;
    if (!arr.every(x => typeof x === 'string' && /^\d+$/.test(x))) {
      return arr;
    }
    try {
      const chars = arr.map(codeStr => String.fromCharCode(parseInt(codeStr, 10)));
      const decodedStr = chars.join("");
      const parsed = JSON.parse(decodedStr);
      return decodeASCIIArray(parsed);
    } catch (e) {
      return arr;
    }
  }

  // 1. Recuperar posts
  const posts = app.findRecordsByFilter("posts", "id != ''", "", 2000, 0);
  let recoveredPostsCount = 0;
  for (const post of posts) {
    const rawStr = post.getString("tags");
    if (rawStr) {
      try {
        const parsed = JSON.parse(rawStr);
        const decoded = decodeASCIIArray(parsed);
        if (Array.isArray(decoded)) {
          const cleanTags = decoded.map(t => typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim());
          post.set("tags", cleanTags);
          app.save(post);
          recoveredPostsCount++;
        }
      } catch (err) {
        console.log("Error recovering post", post.id, err);
      }
    }
  }
  console.log(`[FINAL RECOVERY] Recovered tags for ${recoveredPostsCount} posts.`);

  // 2. Recuperar problems
  const problems = app.findRecordsByFilter("problems", "id != ''", "", 2000, 0);
  let recoveredProblemsCount = 0;
  for (const problem of problems) {
    const rawStr = problem.getString("tags");
    if (rawStr) {
      try {
        const parsed = JSON.parse(rawStr);
        const decoded = decodeASCIIArray(parsed);
        if (Array.isArray(decoded)) {
          const cleanTags = decoded.map(t => typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim());
          problem.set("tags", cleanTags);
          app.save(problem);
          recoveredProblemsCount++;
        }
      } catch (err) {
        console.log("Error recovering problem", problem.id, err);
      }
    }
  }
  console.log(`[FINAL RECOVERY] Recovered tags for ${recoveredProblemsCount} problems.`);

  // 3. Limpiar registros de inspect anteriores
  try {
    app.db().newQuery("DELETE FROM _migrations WHERE file IN ('1783740280_inspect_final.js')").execute();
  } catch (err) {}
}, (app) => {
  // Down migration no-op
});
