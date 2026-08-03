# Solución al Bug de Contador de Comentarios Parpadeante / Inconsistente

## 📌 Descripción del Problema
En las publicaciones del foro, escalafones (ladders) y problemas de Beauchapp, al agregar un comentario o respuesta, el contador de comentarios (`commentCount`) mostraba un comportamiento intermitente:
- **Síntoma:** El número aumentaba brevemente por un milisegundo (actualización optimista en React) y luego **se devolvía al número original (0 o previo)**.
- **Comportamiento errático:** En algunas ocasiones (o tras reiniciar el servidor) parecía funcionar, mientras que en la mayoría de los intentos fallaba sin arrojar ningún error en consola ni en logs.

---

## 🔬 Análisis de la Causa Raíz (Race Condition)

### 1. Manejo Asíncrono de Hooks en PocketBase (`onRecordAfterCreateSuccess`)
Anteriormente, el incremento de `commentCount` se ejecutaba dentro del hook `onRecordAfterCreateSuccess`:
```javascript
onRecordAfterCreateSuccess((e) => {
    // Incrementar commentCount en la base de datos...
}, "posts");
```
En PocketBase v0.25+ (escrito en Go), los hooks de ciclo de vida `AfterSuccess` se ejecutan en goroutines **asíncronas** tras enviar la respuesta HTTP `200 OK` al cliente.

### 2. Flujo en el Frontend (`PostDetailScreen.tsx`)
Al publicar un comentario, el código del cliente ejecutaba:
```typescript
await pb.collection('posts').create(postData); // 1. Se crea la respuesta en PocketBase
setMainPost(prev => ({ ...prev, commentCount: prev.commentCount + 1 })); // 2. Estado optimista (+1)
await fetchData(true); // 3. Se solicita la información actualizada al servidor
```

### 3. La Condición de Carrera (*Race Condition*)
- Tan pronto como `create()` retornaba `HTTP 200 OK`, el cliente lanzaba de inmediato una petición `GET` (`fetchData`) para recargar la publicación desde SQLite.
- Si la petición `GET` llegaba a PocketBase **antes** de que la goroutine asíncrona de `onRecordAfterCreateSuccess` terminara de escribir y guardar `$app.save(parent)` en SQLite, el endpoint `GET` leía el valor antiguo (`0`).
- El frontend sobrescribía el estado optimista con los datos leídos del servidor, provocando el parpadeo de `1 -> 0`.
- Si la goroutine terminaba un par de milisegundos más rápido que la latencia del paquete de red del `GET`, el valor leía `1` y funcionaba. De ahí el comportamiento "aleatorio".

---

## 🛠️ Solución Implementada

Se modificó [backend/pb_hooks/forum.pb.js](file:///home/anastasia/beauchapp/backend/pb_hooks/forum.pb.js) para mover las actualizaciones de conteo (`commentCount` y `quoteCount`) al hook síncrono `onRecordCreateRequest` **antes** del `return e.next()`:

```javascript
onRecordCreateRequest((e) => {
    // ... asignación de actionType, replyTo, targetId ...

    // Incrementar síncronamente los contadores de ancestros/entidad ANTES de responder al cliente
    if (actionType === "comment" && targetId && targetType) {
        const targetRecord = $app.findRecordById(collectionName, targetId);
        const currentCount = targetRecord.getInt("commentCount") || 0;
        targetRecord.set("commentCount", currentCount + 1);
        $app.save(targetRecord);
    } else {
        let parentId = targetId || replyTo;
        if ((actionType === "reply" || replyTo) && parentId) {
            while (parentId && depth < 20) {
                const parent = $app.findRecordById("posts", parentId);
                const currentCount = parent.getInt("commentCount") || 0;
                parent.set("commentCount", currentCount + 1);
                $app.save(parent);
                parentId = parent.getString("replyTo") || ...;
            }
        }
    }

    return e.next();
}, "posts");
```

Del mismo modo, para el borrado de publicaciones o comentarios, el decremento se movió a `onRecordDeleteRequest`:

```javascript
onRecordDeleteRequest((e) => {
    // Decrementar síncronamente antes de borrar
    return e.next();
}, "posts");
```

---

## ✅ Resultados
1. Cuando la API `POST` retorna `200 OK` al cliente, **SQLite ya contiene el `commentCount` actualizado y persistido**.
2. Las peticiones `GET` subsecuentes de la aplicación obtienen de forma determinista el valor correcto del contador.
3. Se elimina al 100% el parpadeo y la condición de carrera.
