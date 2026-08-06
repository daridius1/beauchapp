# `tests/` — scripts de depuración local

Estos son scripts manuales de depuración/seed/inspección contra un PocketBase local, **no una suite de pruebas automatizadas**. No hay `assert`/`expect`, no corren en CI, y no deben ejecutarse contra un entorno de producción.

## Uso

Todos apuntan por defecto a `http://127.0.0.1:8090`. Las credenciales de administrador/usuario de prueba se leen de variables de entorno (nunca hardcodeadas), con un valor de respaldo obviamente falso para desarrollo local:

```bash
export PB_BACKEND_URL=http://127.0.0.1:8090      # opcional, default ya es este valor
export PB_ADMIN_EMAIL=tu-admin-local@example.test
export PB_ADMIN_PASSWORD=tu-password-local
export PB_TEST_USER_EMAIL=usuario-de-prueba@ing.uchile.cl
export PB_TEST_USER_PASSWORD=su-password

node tests/test_mentions.js
```

Si no defines estas variables, los scripts usan valores de ejemplo (`admin@example.test` / `changeme-local-only`) que solo funcionarán si tu instancia local de PocketBase tiene esas cuentas creadas.

## Lógica pura testeada de verdad

La lógica de negocio de mayor riesgo (fórmula de Karma, cálculo de OpenSkill, parseo de menciones) tiene tests reales con el runner nativo de Node en `backend/pb_hooks/lib/__tests__/` (`node --test backend/pb_hooks/lib/__tests__`). Este directorio sigue siendo solo para scripts de depuración manual.
