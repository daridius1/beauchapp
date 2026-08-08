import { pb } from './pocketbase';

export interface CourseRecord {
  id: string;
  codigo: string;
  nombre: string;
  area?: string;
  tipo?: string;
  prefijo?: string;
  semestres?: Record<string, number>;
  commentCount?: number;
  quoteCount?: number;
  created: string;
  updated: string;
}

export interface ProfessorRecord {
  id: string;
  nombre: string;
  created: string;
  updated: string;
}

export interface CourseProfessorRecord {
  id: string;
  course: string;
  professor: string;
  semestres?: string[];
  expand?: {
    course?: CourseRecord;
    professor?: ProfessorRecord;
  };
}

// Mismo esquema de dos ejes que problem_ratings (rating + difficulty): un promedio/conteo
// por eje, más la calificación propia del usuario en cada eje.
export interface DualRatingSummary {
  rating: number;
  ratingCount: number;
  secondary: number;
  secondaryCount: number;
  myRating: number;
  mySecondary: number;
}

const EMPTY_DUAL: DualRatingSummary = { rating: 0, ratingCount: 0, secondary: 0, secondaryCount: 0, myRating: 0, mySecondary: 0 };

let cachedAreasPromise: Promise<string[]> | null = null;

const escapeFilter = (s: string) => s.replace(/"/g, '\\"');

interface DualRatingRow {
  [key: string]: any;
  user: string;
  rating: number;
}

function summarizeDual(items: DualRatingRow[], secondaryField: string, userId?: string): DualRatingSummary {
  let sumR = 0, countR = 0, sumS = 0, countS = 0, myR = 0, myS = 0;
  items.forEach((r) => {
    if (r.rating > 0) { sumR += r.rating; countR++; }
    if (r[secondaryField] > 0) { sumS += r[secondaryField]; countS++; }
    if (userId && r.user === userId) {
      myR = r.rating || 0;
      myS = r[secondaryField] || 0;
    }
  });
  return {
    rating: countR > 0 ? parseFloat((sumR / countR).toFixed(1)) : 0,
    ratingCount: countR,
    secondary: countS > 0 ? parseFloat((sumS / countS).toFixed(1)) : 0,
    secondaryCount: countS,
    myRating: myR,
    mySecondary: myS,
  };
}

function groupDualSummaries(items: DualRatingRow[], key: string, secondaryField: string, userId?: string): Record<string, DualRatingSummary> {
  const grouped: Record<string, DualRatingRow[]> = {};
  items.forEach((r) => {
    const k = r[key];
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(r);
  });
  const out: Record<string, DualRatingSummary> = {};
  Object.keys(grouped).forEach((k) => {
    out[k] = summarizeDual(grouped[k], secondaryField, userId);
  });
  return out;
}

// Actualiza un solo eje a la vez, fusionando con el valor del OTRO eje leído recién del
// servidor (no del estado local del cliente). Si se mandaran siempre los dos ejes juntos
// tomando el valor "no tocado" desde el estado de React, dos clics rápidos en ejes distintos
// pueden pisarse entre sí: el segundo clic puede llevar un valor del primer eje que todavía
// no reflejaba el resultado del primer clic (carrera confirmada con un spike contra un
// PocketBase aislado). Al leer el eje no tocado del servidor justo antes de escribir, cada
// submit es una actualización parcial real y no puede revertir el otro eje.
async function upsertSingleAxisRating(
  collection: string,
  targetField: string,
  targetId: string,
  userId: string,
  secondaryField: string,
  axis: 'rating' | 'secondary',
  value: number
) {
  const existing = await pb.collection(collection).getList(1, 1, {
    filter: `${targetField} = "${targetId}" && user = "${userId}"`,
  });

  const currentRating = existing.items[0]?.rating || 0;
  const currentSecondary = existing.items[0]?.[secondaryField] || 0;

  const nextRating = axis === 'rating' ? value : currentRating;
  const nextSecondary = axis === 'secondary' ? value : currentSecondary;

  if (nextRating === 0 && nextSecondary === 0) {
    if (existing.items.length > 0) {
      await pb.collection(collection).delete(existing.items[0].id);
    }
    return;
  }

  const payload = { rating: nextRating, [secondaryField]: nextSecondary };
  if (existing.items.length > 0) {
    await pb.collection(collection).update(existing.items[0].id, payload);
  } else {
    await pb.collection(collection).create({ [targetField]: targetId, user: userId, ...payload });
  }
}

export const reviewsService = {
  searchCourses: async (params: {
    query?: string;
    area?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ items: CourseRecord[]; totalPages: number; page: number }> => {
    const page = params.page || 1;
    const perPage = params.perPage || 30;
    const filters: string[] = [];

    if (params.query && params.query.trim()) {
      const q = escapeFilter(params.query.trim());
      filters.push(`(nombre ~ "${q}" || codigo ~ "${q}")`);
    }
    if (params.area) {
      filters.push(`area = "${escapeFilter(params.area)}"`);
    }

    const res = await pb.collection('courses').getList<CourseRecord>(page, perPage, {
      filter: filters.join(' && '),
      sort: 'nombre',
    });
    return { items: res.items, totalPages: res.totalPages, page: res.page };
  },

  searchProfessors: async (params: {
    query?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ items: ProfessorRecord[]; totalPages: number; page: number }> => {
    const page = params.page || 1;
    const perPage = params.perPage || 30;
    const filters: string[] = [];

    if (params.query && params.query.trim()) {
      filters.push(`nombre ~ "${escapeFilter(params.query.trim())}"`);
    }

    const res = await pb.collection('professors').getList<ProfessorRecord>(page, perPage, {
      filter: filters.join(' && '),
      sort: 'nombre',
    });
    return { items: res.items, totalPages: res.totalPages, page: res.page };
  },

  // getFullList pagina en lotes de 1000: con ~5000 ramos son ~5 requests encadenados solo
  // para llenar un dropdown de filtro. El área de un ramo no cambia salvo que se reimporte
  // el catálogo, así que se cachea en memoria y se resuelve una sola vez por sesión de la app
  // en vez de repetir el escaneo completo cada vez que se abre la pantalla de Reseñas.
  getCourseAreas: async (): Promise<string[]> => {
    if (!cachedAreasPromise) {
      cachedAreasPromise = pb.collection('courses').getFullList<{ area: string }>({ fields: 'area' })
        .then((res) => {
          const areas = Array.from(new Set(res.map((r) => r.area).filter(Boolean))).sort();
          // No cachear un resultado vacío: probablemente el catálogo todavía no tiene datos
          // (import en curso, o recién desplegado sin importar nada aún) — la próxima
          // llamada reintenta en vez de quedar pegada en "sin áreas" para toda la sesión.
          if (areas.length === 0) {
            cachedAreasPromise = null;
          }
          return areas;
        })
        .catch((err) => {
          cachedAreasPromise = null; // permitir reintentar si falló
          throw err;
        });
    }
    return cachedAreasPromise;
  },

  getCourseDetail: async (courseId: string): Promise<CourseRecord> => {
    return pb.collection('courses').getOne<CourseRecord>(courseId);
  },

  getProfessorDetail: async (professorId: string): Promise<ProfessorRecord> => {
    return pb.collection('professors').getOne<ProfessorRecord>(professorId);
  },

  getCourseProfessors: async (courseId: string): Promise<CourseProfessorRecord[]> => {
    return pb.collection('course_professors').getFullList<CourseProfessorRecord>({
      filter: `course = "${courseId}"`,
      expand: 'professor',
      sort: '-created',
    });
  },

  getProfessorCourses: async (professorId: string): Promise<CourseProfessorRecord[]> => {
    return pb.collection('course_professors').getFullList<CourseProfessorRecord>({
      filter: `professor = "${professorId}"`,
      expand: 'course',
      sort: '-created',
    });
  },

  getCourseRatingSummary: async (courseId: string, userId?: string): Promise<DualRatingSummary> => {
    const items = await pb.collection('course_ratings').getFullList<DualRatingRow>({
      filter: `course = "${courseId}"`,
    });
    return summarizeDual(items, 'difficulty', userId);
  },

  getProfessorRatingSummary: async (professorId: string, userId?: string): Promise<DualRatingSummary> => {
    const items = await pb.collection('professor_ratings').getFullList<DualRatingRow>({
      filter: `professor = "${professorId}"`,
    });
    return summarizeDual(items, 'administrative', userId);
  },

  // Traen todas las calificaciones de los ids visibles en un solo request (evita N+1 en listados).
  getCourseRatingSummaries: async (courseIds: string[], userId?: string): Promise<Record<string, DualRatingSummary>> => {
    if (courseIds.length === 0) return {};
    const filter = courseIds.map((id) => `course = "${id}"`).join(' || ');
    const items = await pb.collection('course_ratings').getFullList<DualRatingRow>({ filter });
    return groupDualSummaries(items, 'course', 'difficulty', userId);
  },

  getProfessorRatingSummaries: async (professorIds: string[], userId?: string): Promise<Record<string, DualRatingSummary>> => {
    if (professorIds.length === 0) return {};
    const filter = professorIds.map((id) => `professor = "${id}"`).join(' || ');
    const items = await pb.collection('professor_ratings').getFullList<DualRatingRow>({ filter });
    return groupDualSummaries(items, 'professor', 'administrative', userId);
  },

  submitCourseRating: async (courseId: string, userId: string, axis: 'rating' | 'secondary', value: number): Promise<void> => {
    await upsertSingleAxisRating('course_ratings', 'course', courseId, userId, 'difficulty', axis, value);
  },

  submitProfessorRating: async (professorId: string, userId: string, axis: 'rating' | 'secondary', value: number): Promise<void> => {
    await upsertSingleAxisRating('professor_ratings', 'professor', professorId, userId, 'administrative', axis, value);
  },
};

export const emptyDualRating = EMPTY_DUAL;
