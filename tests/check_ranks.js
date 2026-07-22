async function main() {
  try {
    const res = await fetch('http://127.0.0.1:8090/api/collections/ladder_ranks/records?expand=user,ladder');
    const data = await res.json();
    console.log('Ranks count:', data.totalItems);
    data.items.forEach(r => {
      console.log({
        id: r.id,
        ladder: r.ladder,
        ladderSlug: r.expand?.ladder?.slug,
        user: r.expand?.user?.name || r.user,
        ordinal_rating: r.ordinal_rating,
        matches_played: r.matches_played,
        wins: r.wins,
        losses: r.losses,
      });
    });

    const laddersRes = await fetch('http://127.0.0.1:8090/api/collections/ladders/records');
    const laddersData = await laddersRes.json();
    console.log('\nLadders:');
    laddersData.items.forEach(l => {
      console.log({ id: l.id, name: l.name, slug: l.slug });
    });

    const matchesRes = await fetch('http://127.0.0.1:8090/api/collections/ladder_matches/records?sort=-created&limit=5');
    const matchesData = await matchesRes.json();
    console.log('\nRecent Matches:');
    matchesData.items.forEach(m => {
      console.log({ id: m.id, ladder: m.ladder, status: m.status, mode: m.mode, score: `${m.score_red}-${m.score_blue}` });
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
