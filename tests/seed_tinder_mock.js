const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'http://127.0.0.1:8090';
const ADMIN_EMAIL = 'tempadmin@example.com';
const ADMIN_PASSWORD = 'tempadminpassword123';

async function request(pathStr, options = {}) {
  const url = `${BACKEND_URL}${pathStr}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request to ${pathStr} failed with status ${response.status}: ${text}`);
  }
  
  if (response.status === 204) {
    return null;
  }
  
  return response.json();
}

async function main() {
  try {
    console.log('Autenticando...');
    const authData = await request('/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
    });
    
    const token = authData.token;
    const authHeader = { 'Authorization': token };

    // Get users
    const users = await request('/api/collections/users/records?filter=type="student"', { headers: authHeader });
    console.log(`Encontrados ${users.items.length} estudiantes.`);

    // Mock tinder profile data for Juan, Sofía, Diego, Camila
    const mockData = {
      'Juan Pérez': {
        description: 'Hola! Soy Juan. Estudio Ingeniería Civil y me gusta tocar guitarra, ver series y salir a correr por las tardes. Busco gente simpática para conversar!',
        instagram: 'juan_perez_fcfm',
        whatsapp: '+56911112222',
        telegram: 'juan_perez',
        photos: [
          '/home/betty/.gemini/antigravity/brain/fac0904b-18fb-4292-b6fb-407dd423ff9b/media__1783275776484.png',
          '/home/betty/.gemini/antigravity/brain/fac0904b-18fb-4292-b6fb-407dd423ff9b/media__1783276555112.png'
        ]
      },
      'Sofía Gómez': {
        description: 'Estudiante de Computación. Fan de la tecnología, el anime y los videojuegos. Si juegas Valorant o LoL, hablemos! 👾',
        instagram: 'sofi_gomez_dev',
        whatsapp: '+56933334444',
        telegram: 'sofi_g',
        photos: [
          '/home/betty/.gemini/antigravity/brain/fac0904b-18fb-4292-b6fb-407dd423ff9b/media__1783286020594.png',
          '/home/betty/.gemini/antigravity/brain/fac0904b-18fb-4292-b6fb-407dd423ff9b/media__1783287593228.png'
        ]
      },
      'Diego Soto': {
        description: 'Hola! De Plan Común. Me gusta el senderismo, ir a la montaña los fines de semana y escuchar buena música. Busco partner para salir a recorrer cerros.',
        instagram: 'diego_soto_outdoor',
        whatsapp: '+56955556666',
        photos: [
          '/home/betty/.gemini/antigravity/brain/fac0904b-18fb-4292-b6fb-407dd423ff9b/media__1783287603966.png'
        ]
      },
      'Camila Silva': {
        description: 'Hola :) Estudio Industrial. Me gusta bailar salsa, la comida italiana y conocer cafés bonitos. Hablemos si quieres salir a tomar un café!',
        instagram: 'cami_silva_i',
        whatsapp: '+56977778888',
        telegram: 'cami_silva',
        photos: [
          '/home/betty/.gemini/antigravity/brain/fac0904b-18fb-4292-b6fb-407dd423ff9b/media__1783533292337.png',
          '/home/betty/.gemini/antigravity/brain/fac0904b-18fb-4292-b6fb-407dd423ff9b/media__1783559389982.png'
        ]
      }
    };

    for (const u of users.items) {
      if (mockData[u.name]) {
        const data = mockData[u.name];
        console.log(`Sembrando tinder profile para ${u.name}...`);
        
        // Check if tinder profile already exists
        let existingProfile = null;
        try {
          existingProfile = await request(`/api/collections/tinder_profiles/records?filter=user="${u.id}"`, { headers: authHeader });
        } catch (err) {}

        const formData = new FormData();
        formData.append('user', u.id);
        formData.append('description', data.description);
        formData.append('instagram', data.instagram);
        formData.append('whatsapp', data.whatsapp);
        if (data.telegram) formData.append('telegram', data.telegram);
        formData.append('isActive', 'true');
        
        // Add files to form data
        for (const photoPath of data.photos) {
          if (fs.existsSync(photoPath)) {
            const fileBuffer = fs.readFileSync(photoPath);
            const blob = new Blob([fileBuffer], { type: 'image/png' });
            formData.append('photos', blob, path.basename(photoPath));
          }
        }

        if (existingProfile && existingProfile.items && existingProfile.items.length > 0) {
          const profileId = existingProfile.items[0].id;
          console.log(`Perfil de Tinder ya existe para ${u.name} (ID: ${profileId}). Actualizando...`);
          await request(`/api/collections/tinder_profiles/records/${profileId}`, {
            method: 'PATCH',
            headers: { 'Authorization': token },
            body: formData
          });
        } else {
          console.log(`Creando perfil de Tinder para ${u.name}...`);
          await request('/api/collections/tinder_profiles/records', {
            method: 'POST',
            headers: { 'Authorization': token },
            body: formData
          });
        }
      }
    }
    console.log('Sembrado finalizado con éxito!');
  } catch (err) {
    console.error('Error sembrando perfiles:', err);
  }
}

main();
