// Copia frontend de la lista de lugares de Beaudle, usada solo por el selector de la UI
// (autocomplete local, sin red). La fuente de verdad es
// backend/pb_hooks/lib/beaudle.js — no hay forma de compartir un módulo entre el bundle
// de Expo y el runtime goja de PocketBase en este repo, así que ambas copias se
// mantienen sincronizadas a mano. NO reordenar/eliminar entradas: el backend depende del
// orden del arreglo equivalente para elegir el lugar secreto del día.

export interface BeaudlePlace {
  code: string;
  name: string;
  shortName: string;
  ubicacion: string;
  edificio: string[];
  piso: number[];
  tipo: string[];
}

export const BEAUDLE_PLACES: BeaudlePlace[] = [
  { code: 'dcc', name: "Departamento de Ciencias de la Computación", shortName: "DCC", ubicacion: "851", edificio: ["Torre Norte","Torre Poniente"], piso: [2,3], tipo: ["Departamento"] },
  { code: 'cmm', name: "Centro de Modelamiento Matemático", shortName: "CMM", ubicacion: "851", edificio: ["Torre Norte"], piso: [6,7], tipo: ["Centro"] },
  { code: 'dim', name: "Departamento de Ingeniería Matemática", shortName: "DIM", ubicacion: "851", edificio: ["Torre Norte"], piso: [4,5], tipo: ["Departamento"] },
  { code: 'dimec', name: "Departamento de Ingeniería Mecánica", shortName: "DIMEC", ubicacion: "851", edificio: ["Torre Poniente"], piso: [4,5], tipo: ["Departamento"] },
  { code: 'diqbm', name: "Departamento de Ingeniería Química, Biotecnología y Materiales", shortName: "DIQBM", ubicacion: "851", edificio: ["Torre Poniente"], piso: [6], tipo: ["Departamento"] },
  { code: 'fablab', name: "Laboratorio de Fabricación Digital", shortName: "FabLab", ubicacion: "851", edificio: ["Torre Poniente"], piso: [3], tipo: ["Centro","Laboratorio"] },
  { code: 'openbeauchef', name: "Centro de Innovación y Emprendimiento OpenBeauchef", shortName: "OpenBeauchef", ubicacion: "851", edificio: ["Torre Poniente"], piso: [2], tipo: ["Centro"] },
  { code: 'delta-te', name: "Cafetería Delta Té", shortName: "Delta Té", ubicacion: "851", edificio: ["Torre Poniente"], piso: [1], tipo: ["Servicio","Áreas comunes"] },
  { code: 'kinder', name: "Kinder", shortName: "Kinder", ubicacion: "851", edificio: ["Torre Poniente"], piso: [1], tipo: ["Áreas comunes","Estudio"] },
  { code: 'la-arana', name: "Auditorio Enrique D'Etigny", shortName: "La Araña", ubicacion: "851", edificio: ["Patio 851"], piso: [1], tipo: ["Auditorio"] },
  { code: 'sala-de-artes', name: "Sala de Artes", shortName: "Sala de Artes", ubicacion: "851", edificio: ["Subterráneo","Torre Oriente"], piso: [-3], tipo: ["Deportivo","Artístico"] },
  { code: 'dojo', name: "Dojo", shortName: "Dojo", ubicacion: "851", edificio: ["Subterráneo","Torre Oriente"], piso: [-3], tipo: ["Deportivo"] },
  { code: 'sala-de-juegos', name: "Sala de Juegos", shortName: "Sala de Juegos", ubicacion: "851", edificio: ["Subterráneo","Torre Oriente"], piso: [-3], tipo: ["Deportivo","Recreativo"] },
  { code: 'gimnasio-851', name: "Gimnasio 851", shortName: "Gimnasio 851", ubicacion: "851", edificio: ["Subterráneo","Torre Poniente"], piso: [-3], tipo: ["Deportivo"] },
  { code: 'cancha-squash', name: "Cancha de Squash", shortName: "Cancha de Squash", ubicacion: "851", edificio: ["Subterráneo","Torre Oriente"], piso: [-3], tipo: ["Deportivo","Cancha"] },
  { code: 'cancha-futsal-handball', name: "Cancha de Futsal/Handball", shortName: "Cancha de Futsal/Handball", ubicacion: "851", edificio: ["Subterráneo"], piso: [-3], tipo: ["Deportivo","Cancha"] },
  { code: 'cancha-volley-basket', name: "Cancha de Volley/Basket", shortName: "Cancha de Volley/Basket", ubicacion: "851", edificio: ["Subterráneo","Torre Norte"], piso: [-3], tipo: ["Deportivo","Cancha"] },
  { code: 'cdi', name: "Centro Deportivo de Ingeniería", shortName: "CDI", ubicacion: "851", edificio: ["Subterráneo","Torre Oriente"], piso: [-3], tipo: ["Oficina","CCEE"] },
  { code: 'adefa', name: "Área de Deportes, Educación Física y Expresiones Artísticas", shortName: "ADEFA", ubicacion: "851", edificio: ["Subterráneo","Torre Oriente"], piso: [-3], tipo: ["Oficina"] },
  { code: 'escalera-caracol', name: "Escalera Caracol", shortName: "Escalera Caracol", ubicacion: "851", edificio: ["Subterráneo"], piso: [-1,-2,-3,1], tipo: ["Infraestructura"] },
  { code: 'piscina', name: "Piscina", shortName: "Piscina", ubicacion: "851", edificio: ["Subterráneo"], piso: [-1], tipo: ["Deportivo"] },
  { code: 'camarines-851', name: "Camarines 851", shortName: "Camarines 851", ubicacion: "851", edificio: ["Subterráneo"], piso: [-3], tipo: ["Infraestructura","Deportivo"] },
  { code: 'cec', name: "CEC", shortName: "CEC", ubicacion: "851", edificio: ["Subterráneo","Torre Norte"], piso: [-1], tipo: ["Laboratorio","Estudio"] },
  { code: 'barras-calistenia', name: "Barras de Calistenia", shortName: "Barras de Calistenia", ubicacion: "850", edificio: ["Patio 850"], piso: [1], tipo: ["Deportivo"] },
  { code: 'multicancha-850', name: "Multicancha 850", shortName: "Multicancha 850", ubicacion: "850", edificio: ["Patio 850"], piso: [1], tipo: ["Deportivo","Cancha"] },
  { code: 'terraza-ebria', name: "Terraza Ebria", shortName: "Terraza Ebria", ubicacion: "850", edificio: ["Patio 850"], piso: [2], tipo: ["Áreas comunes"] },
  { code: 'el-muerto', name: "El Muerto", shortName: "El Muerto", ubicacion: "850", edificio: ["Patio 850"], piso: [1], tipo: ["Patrimonio"] },
  { code: 'carrito', name: "Carrito", shortName: "Carrito", ubicacion: "850", edificio: ["Patio 850"], piso: [1], tipo: ["Servicio"] },
  { code: 'pajarera', name: "Pajarera", shortName: "Pajarera", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [2], tipo: ["Áreas comunes","Estudio"] },
  { code: 'a2ic', name: "A2IC", shortName: "A2IC", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [3], tipo: ["Centro","Oficina"] },
  { code: 'zocalo', name: "Zócalo", shortName: "Zócalo", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [-1], tipo: ["Sala","Área común"] },
  { code: 'auditorio-gorbea', name: "Auditorio Gorbea", shortName: "Auditorio Gorbea", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [3], tipo: ["Auditorio"] },
  { code: 'hall-sur', name: "Hall Sur", shortName: "Hall Sur", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [1], tipo: ["Áreas comunes"] },
  { code: 'biblioteca-850', name: "Biblioteca 850", shortName: "Biblioteca 850", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [1,2,3], tipo: ["Áreas comunes","Estudio"] },
  { code: 'la-mona', name: "Estatua de Minerva", shortName: "La Mona", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [1], tipo: ["Patrimonio"] },
  { code: 'terraza-sobria', name: "Terraza Sobria", shortName: "Terraza Sobria", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [1], tipo: ["Áreas comunes"] },
  { code: 'cafeta-850', name: "Cafetería 850", shortName: "Cafeta 850", ubicacion: "850", edificio: ["Edificio Escuela"], piso: [-1], tipo: ["Áreas comunes","Servicio"] },
  { code: 'decanato', name: "Decanato FCFM", shortName: "Decanato", ubicacion: "850", edificio: ["Torre Justicia Espada"], piso: [8], tipo: ["Oficina"] },
  { code: 'el-piano', name: "El Piano", shortName: "El Piano", ubicacion: "850", edificio: ["Torre Justicia Espada"], piso: [8], tipo: ["Patrimonio"] },
  { code: 'gmi', name: "Grupo de Música de Ingeniería", shortName: "GMI", ubicacion: "Casa CEI", edificio: ["Casa CEI"], piso: [1], tipo: ["Sala","GGOO"] },
  { code: 'oficina-cei', name: "Oficina Centro de Estudiantes de Ingeniería", shortName: "Oficina CEI", ubicacion: "Casa CEI", edificio: ["Casa CEI"], piso: [2], tipo: ["Oficina","CCEE"] },
  { code: 'casino', name: "Casino Domeyko", shortName: "Casino", ubicacion: "Domeyko", edificio: ["Domeyko"], piso: [1,2,3], tipo: ["Áreas comunes","Servicio"] },
  { code: 'gimnasio-domeyko', name: "Gimnasio Polideportivo Domeyko", shortName: "Gimnasio Domeyko", ubicacion: "Domeyko", edificio: ["Domeyko"], piso: [1], tipo: ["Deportivo","Cancha"] },
  { code: 'camarines-domeyko', name: "Camarines Domeyko", shortName: "Camarines Domeyko", ubicacion: "Domeyko", edificio: ["Domeyko"], piso: [1], tipo: ["Infraestructura","Deportivo"] },
  { code: 'muro-escalada', name: "Muro de Escalada", shortName: "Muro de Escalada", ubicacion: "Domeyko", edificio: ["Domeyko"], piso: [1], tipo: ["Deportivo"] },
];
