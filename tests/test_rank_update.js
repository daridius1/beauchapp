async function main() {
  const collections = ['ladders', 'ladder_matches', 'ladder_ranks', 'notifications'];
  for (const c of collections) {
    const res = await fetch(`http://127.0.0.1:8090/api/collections/${c}`);
    const data = await res.json();
    console.log(`Collection ${c}:`, {
      listRule: data.listRule,
      viewRule: data.viewRule,
      createRule: data.createRule,
      updateRule: data.updateRule,
      deleteRule: data.deleteRule,
    });
  }
}

main();
