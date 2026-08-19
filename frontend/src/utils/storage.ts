// Envoltorio de localStorage tolerante a fallos.
//
// Los catch vacíos de acá SÍ son deliberados, a diferencia del resto del proyecto:
// localStorage lanza de forma legítima y frecuente (Safari en navegación privada, cuota
// llena, cookies de terceros bloqueadas), y en todos esos casos la respuesta correcta es
// comportarse como si no hubiera almacenamiento. Loguear cada vez llenaría la consola de
// ruido esperado. La persistencia real de la sesión no depende de esto: va por
// AsyncStorage en services/pocketbase.ts. Ver auditoria-2026-08-19.md §5.3.
export const storage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {}
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {}
  },
};
