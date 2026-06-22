async function check() {
  try {
    const authRes = await fetch('http://127.0.0.1:8090/api/admins/auth-with-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'admin@b.com', password: 'admin123456' })
    });
    const authData = await authRes.json();
    const token = authData.token;

    const predRes = await fetch('http://127.0.0.1:8090/api/collections/predictions/records?expand=user,match', {
      headers: { 'Authorization': token }
    });
    const predData = await predRes.json();
    const predictions = predData.items || [];
    
    console.log(`Hay ${predictions.length} predicciones en total.`);
    
    if (predictions.length > 0) {
      console.log('Muestra de predicciones:');
      predictions.slice(0, 5).forEach(p => {
        const userName = p.expand?.user?.name || 'Desconocido';
        const homeTeam = p.expand?.match?.homeTeam || 'Desconocido';
        const awayTeam = p.expand?.match?.awayTeam || 'Desconocido';
        console.log(`- Usuario: ${userName} | Partido: ${homeTeam} vs ${awayTeam} | Marcador: ${p.homeScore}-${p.awayScore}`);
      });
    }
  } catch (e) {
    console.error(e);
  }
}
check();
