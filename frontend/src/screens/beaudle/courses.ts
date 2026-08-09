// Copia frontend de la lista de ramos de Beaudle, usada solo por el selector de la UI
// (autocomplete local, sin red). La fuente de verdad es
// backend/pb_hooks/lib/beaudle.js — no hay forma de compartir un módulo entre el bundle
// de Expo y el runtime goja de PocketBase en este repo, así que ambas copias se
// mantienen sincronizadas a mano. NO reordenar/eliminar entradas: el backend depende del
// orden del arreglo equivalente para elegir el ramo secreto del día.

export interface BeaudleCourse {
  code: string;
  name: string;
  department: string;
  credits: number;
  semester: number;
  prerequisites: string[];
  altCode?: string;
  altName?: string;
}

export const BEAUDLE_COURSES: BeaudleCourse[] = [
  { code: 'MA1001', name: 'Introducción al Cálculo', department: 'MA', credits: 6, semester: 1, prerequisites: [] },
  { code: 'MA1101', name: 'Introducción al Álgebra', department: 'MA', credits: 6, semester: 1, prerequisites: [] },
  { code: 'FI1000', name: 'Introducción a la Física Clásica', department: 'FI', credits: 6, semester: 1, prerequisites: [] },
  { code: 'CC1000', name: 'Herramientas Computacionales para Ingeniería y Ciencias', department: 'CC', credits: 3, semester: 1, prerequisites: [] },
  { code: 'CD1100', name: 'Desafíos de Innovación en Ingeniería y Ciencias', department: 'CD', credits: 6, semester: 1, prerequisites: [] },
  { code: 'BT1211', name: 'Aplicaciones de la Biología a la Ingeniería y Ciencias', department: 'BT', credits: 3, semester: 1, prerequisites: [] },
  { code: 'MA1002', name: 'Cálculo Diferencial e Integral', department: 'MA', credits: 6, semester: 2, prerequisites: ['MA1001'] },
  { code: 'MA1102', name: 'Álgebra Lineal', department: 'MA', credits: 6, semester: 2, prerequisites: ['MA1101'] },
  { code: 'FI1100', name: 'Introducción a la Física Moderna', department: 'FI', credits: 6, semester: 2, prerequisites: ['FI1000', 'MA1101', 'MA1001'] },
  { code: 'CC1002', name: 'Introducción a la Programación', department: 'CC', credits: 6, semester: 2, prerequisites: [] },
  { code: 'CD1201', name: 'Proyecto de Innovación en Ingeniería y Ciencias', department: 'CD', credits: 3, semester: 2, prerequisites: ['CD1100'] },
  { code: 'MA2001', name: 'Cálculo en Varias Variables', department: 'MA', credits: 6, semester: 3, prerequisites: ['MA1002', 'MA1102'] },
  { code: 'MA2601', name: 'Ecuaciones Diferenciales Ordinarias', department: 'MA', credits: 6, semester: 3, prerequisites: ['MA1002', 'MA1102'] },
  { code: 'FI2001', name: 'Mecánica', department: 'FI', credits: 6, semester: 3, prerequisites: ['FI1100', 'MA1102', 'MA1002'] },
  { code: 'FI2003', name: 'Métodos Experimentales', department: 'FI', credits: 6, semester: 3, prerequisites: ['FI1100', 'MA1002'] },
  { code: 'IQ2211', name: 'Química', department: 'IQ', credits: 6, semester: 3, prerequisites: [] },
  { code: 'MA2002', name: 'Cálculo Avanzado y Aplicaciones', department: 'MA', credits: 6, semester: 4, prerequisites: ['MA2001', 'MA2601'] },
  { code: 'IN2201', name: 'Economía', department: 'IN', credits: 6, semester: 4, prerequisites: ['MA2001'] },
  { code: 'FI2002', name: 'Electromagnetismo', department: 'FI', credits: 6, semester: 4, prerequisites: ['MA2001', 'MA2601', 'FI2003'] },
  { code: 'FI2004', name: 'Termodinámica', department: 'FI', credits: 6, semester: 4, prerequisites: ['IQ2211', 'FI2001', 'MA2001'], altCode: 'IQ2212', altName: 'Termodinámica Química' },
  { code: 'CD2201', name: 'Módulo Interdisciplinario', department: 'CD', credits: 3, semester: 4, prerequisites: ['CD1201'] },
];
