import { InfoModalSection } from '../../components/InfoModal';

// Contenido del botón de info de Tinder Beauchef — mecánica real verificada contra el
// código (perfil separado, bloqueo de 24h, contacto oculto hasta match, etc.), no
// inventada.
export const TINDER_INFO_SECTIONS: InfoModalSection[] = [
  {
    title: '¿Qué es Tinder Beauchef?',
    body: 'Una sección para conocer gente de la facultad: armas un perfil aparte de tu perfil general (fotos, descripción, gustos), y das like a los perfiles que te van apareciendo en "Descubrir". Es exclusivo para estudiantes — las cuentas de organización no tienen acceso.',
  },
  {
    title: 'Match y contacto',
    body: 'Si dos personas se dan like mutuamente, se genera un match y aparece en la pestaña "Matches". Tus datos de contacto (Instagram, WhatsApp, Telegram, Signal) quedan 100% ocultos hasta que eso pase — recién ahí se muestran, para que puedan seguir la conversación fuera de la app. Un match se puede deshacer en cualquier momento.',
  },
  {
    title: 'Activar tu perfil',
    body: 'Una vez que activas tu perfil en "Mi Perfil", no puedes desactivarlo por 24 horas.',
  },
];
