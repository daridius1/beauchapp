export type PostLocationSource = 'campus' | 'surroundings';

// El mapa 3D tiene lugares nombrados, mientras que los alrededores permiten señalar un
// punto libre. Se conserva el origen para explicar cómo interpretar cada ubicación.
export interface PostLocation {
  source: PostLocationSource;
  name: string;
  category: string;
  campusElementId?: string;
  campusX?: number;
  campusZ?: number;
  latitude?: number;
  longitude?: number;
}
