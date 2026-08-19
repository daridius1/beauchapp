import { InfoModalSection } from '../components/InfoModal';

// Contenido del botón de info de cada ladder — reglas reales, sacadas de cada
// arbitrador (backend/frontend), no inventadas. Clave = groupSlug de ladderGroups.ts.
export const LADDER_INFO: Record<string, { title: string; sections: InfoModalSection[] }> = {
  'tenis-de-mesa': {
    title: 'Tenis de Mesa',
    sections: [
      {
        title: 'Formato',
        body: 'Se juega 1v1 o 2v2, según el modo que elijas arriba. En 2v2 el saque rota entre los integrantes de cada equipo.',
      },
      {
        title: 'Cómo se gana',
        body: 'El partido se juega a 11 puntos. Si ambos llegan a 10, hay "deuce": hace falta ganar por 2 puntos de diferencia para cerrar el partido.',
      },
      {
        title: 'Confirmación',
        body: 'Quien arbitra registra el resultado y queda pendiente hasta que el rival lo confirma. Si no está de acuerdo, puede marcarlo como disputado en vez de confirmarlo.',
      },
    ],
  },
  'taca-taca': {
    title: 'Taca Taca',
    sections: [
      {
        title: 'Formato',
        body: 'Se juega 1v1 o 2v2, según el modo que elijas arriba.',
      },
      {
        title: 'Cómo se gana',
        body: 'El partido se juega a 10 goles. A diferencia del tenis de mesa, acá no hay "deuce" — el primer equipo en llegar al marcador gana directo, sin necesitar diferencia.',
      },
      {
        title: 'Confirmación',
        body: 'El resultado queda pendiente hasta que el rival lo confirma o lo disputa, igual que en el resto de los ladders.',
      },
    ],
  },
  'tiptap': {
    title: 'TipTap',
    sections: [
      {
        title: 'Formato',
        body: 'Solo se juega 1v1. Se necesita una mesa y una pelota.',
      },
      {
        title: 'Cómo se juega',
        body: 'El jugador que parte lanza la pelota hacia el lado del rival, haciéndola botar una sola vez en la mesa. El rival debe devolverla dándole dos botes. Al volver al primer jugador, este debe devolverla con tres botes, y así sucesivamente — la cantidad de botes exigida sube de a uno cada vez que la pelota cambia de lado.',
      },
      {
        title: 'Cómo se gana',
        body: 'Cuando un jugador falla, se marca ese punto como perdido y la cantidad de botes que le tocaba hacer se suma al marcador del rival. Gana quien llegue primero a 30 puntos.',
      },
      {
        title: 'Confirmación',
        body: 'El resultado queda pendiente hasta que el rival lo confirma o lo disputa, igual que en el resto de los ladders.',
      },
    ],
  },
  'ajedrez': {
    title: 'Ajedrez',
    sections: [
      {
        title: 'Formato',
        body: 'Solo se juega 1v1.',
      },
      {
        title: 'Cómo se registra el resultado',
        body: 'No hay puntaje: quien arbitra elige directamente uno de tres resultados posibles — ganan blancas, tablas (empate), o ganan negras.',
      },
      {
        title: 'Confirmación',
        body: 'El resultado queda pendiente hasta que el rival lo confirma o lo disputa.',
      },
    ],
  },
  'clash-royale': {
    title: 'Clash Royale',
    sections: [
      {
        title: 'Formato',
        body: 'Se juega 1v1 o 2v2, según el modo que elijas arriba.',
      },
      {
        title: 'Cómo se gana',
        body: 'El partido se juega a 3 coronas. Para poder guardar el resultado, exactamente un equipo tiene que haber llegado a las 3 coronas — si ninguno llegó, o llegaron los dos, el partido no se puede cerrar.',
      },
      {
        title: 'Confirmación',
        body: 'El resultado queda pendiente hasta que el rival lo confirma o lo disputa, igual que en el resto de los ladders.',
      },
    ],
  },
  'karma': {
    title: 'Karma',
    sections: [
      {
        title: '¿Cómo se gana karma?',
        body: 'El karma se obtiene aportando contenido en la sección de Pautas y recibiendo buenas evaluaciones por parte de la comunidad, tanto en la calidad de los enunciados como de las pautas publicadas.',
      },
    ],
  },
  'beautokens': {
    title: 'BeauTokens',
    sections: [
      {
        title: '¿Cómo se ganan BeauTokens?',
        body: 'Todos ganan BeauTokens (ℬ) cada día solo por ser parte de la comunidad, y pueden apostarlos en los mercados de predicción de Beaumarket.',
      },
    ],
  },
  'beaudle-racha': {
    title: 'Racha de Beaudle',
    sections: [
      {
        title: '¿Cómo se mantiene la racha?',
        body: 'La racha sube en 1 cada vez que respondes el Beaudle del día exactamente ese mismo día (ganes o pierdas). Si te saltas un día completo, la racha se reinicia en 1 la próxima vez que respondas a tiempo.',
      },
      {
        title: 'Días atrasados',
        body: 'Puedes responder Beaudles de días pasados que te hayas saltado, pero esas respuestas nunca cuentan para la racha ni otorgan BeauTokens — solo sirven para ver el lugar y jugar por diversión.',
      },
    ],
  },
};
