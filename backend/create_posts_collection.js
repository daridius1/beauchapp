

const BACKEND_URL = 'http://127.0.0.1:8090';

async function createPostsCollection() {
  try {
    const authRes = await fetch(BACKEND_URL + '/api/admins/auth-with-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'admin@ug.uchile.cl', password: 'admin123456' })
    });
    
    if (!authRes.ok) throw new Error(`Auth failed: ${authRes.statusText}`);
    const token = (await authRes.json()).token;
    console.log('Autenticado como admin.');

    const usersColRes = await fetch(BACKEND_URL + '/api/collections/users', { headers: { 'Authorization': token } });
    const usersCol = await usersColRes.json();

    const collectionData = {
      name: 'posts',
      type: 'base',
      system: false,
      schema: [
        {
          system: false,
          id: 'content_text',
          name: 'content',
          type: 'text',
          required: true,
          presentable: true,
          unique: false,
          options: { min: 1, max: 280, pattern: '' }
        },
        {
          system: false,
          id: 'tags_json',
          name: 'tags',
          type: 'json',
          required: false,
          presentable: false,
          unique: false,
          options: { maxSize: 2000000 }
        },
        {
          system: false,
          id: 'author_rel',
          name: 'author',
          type: 'relation',
          required: true,
          presentable: false,
          unique: false,
          options: {
            collectionId: usersCol.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: null
          }
        },
        {
          system: false,
          id: 'likes_rel',
          name: 'likes',
          type: 'relation',
          required: false,
          presentable: false,
          unique: false,
          options: {
            collectionId: usersCol.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: null, // Multiple selection allowed
            displayFields: null
          }
        }
      ],
      // We will add replyTo after creating the collection to avoid self-reference errors on creation
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id = author',
      updateRule: '@request.auth.id = author',
      deleteRule: '@request.auth.id = author',
    };

    console.log('Creando colección "posts"...');
    let createRes = await fetch(BACKEND_URL + '/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify(collectionData)
    });

    let postsCol;
    if (createRes.ok) {
      console.log('Colección "posts" creada.');
      postsCol = await createRes.json();
    } else {
      const errText = await createRes.text();
      if (errText.includes('name')) {
        console.log('La colección "posts" ya existe. Actualizando...');
        const listRes = await fetch(BACKEND_URL + '/api/collections/posts', { headers: { 'Authorization': token } });
        postsCol = await listRes.json();
      } else {
        throw new Error(`Error al crear colección: ${errText}`);
      }
    }

    // Add replyTo field referencing posts itself
    console.log('Agregando campo replyTo...');
    const replyToField = {
      system: false,
      id: 'replyto_rel',
      name: 'replyTo',
      type: 'relation',
      required: false,
      presentable: false,
      unique: false,
      options: {
        collectionId: postsCol.id,
        cascadeDelete: true,
        minSelect: null,
        maxSelect: 1,
        displayFields: null
      }
    };

    // Ensure the field is in the schema
    const schemaHasReplyTo = postsCol.schema.some(f => f.name === 'replyTo');
    if (!schemaHasReplyTo) {
      postsCol.schema.push(replyToField);
      
      const updateRes = await fetch(BACKEND_URL + '/api/collections/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify(postsCol)
      });

      if (updateRes.ok) {
        console.log('Campo replyTo agregado exitosamente. ¡Estructura lista!');
      } else {
        console.error('Error al actualizar colección:', await updateRes.text());
      }
    } else {
      console.log('El campo replyTo ya existe. ¡Estructura lista!');
    }

  } catch (err) {
    console.error('Error fatal:', err);
  }
}

createPostsCollection();
