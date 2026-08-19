import { pb } from './pocketbase';

export interface TeamPlayerRecord {
  id: string;
  team: string;
  name: string;
  photo?: string;
  user?: string;
  deleted?: boolean;
  created: string;
  updated: string;
  expand?: {
    user?: any;
  };
}

export const teamPlayersService = {
  /**
   * Roster de un equipo — sin los soft-borrados, ordenados por nombre.
   */
  async listTeamPlayers(teamId: string): Promise<TeamPlayerRecord[]> {
    try {
      const records = await pb.collection('team_players').getFullList<TeamPlayerRecord>({
        filter: `team = "${teamId}" && deleted = false`,
        expand: 'user',
        sort: 'name',
      });
      return records;
    } catch (err) {
      console.error('Error al obtener el roster del equipo:', err);
      return [];
    }
  },

  async createTeamPlayer(
    teamId: string,
    data: { name: string; photo?: File | null; userId?: string | null }
  ): Promise<TeamPlayerRecord> {
    const formData = new FormData();
    formData.append('team', teamId);
    formData.append('name', data.name.trim());
    if (data.userId) formData.append('user', data.userId);
    if (data.photo) formData.append('photo', data.photo);
    return await pb.collection('team_players').create<TeamPlayerRecord>(formData);
  },

  async updateTeamPlayer(
    id: string,
    patch: { name?: string; photo?: File | null; userId?: string | null }
  ): Promise<TeamPlayerRecord> {
    const formData = new FormData();
    if (patch.name !== undefined) formData.append('name', patch.name.trim());
    if (patch.userId !== undefined) formData.append('user', patch.userId || '');
    if (patch.photo) formData.append('photo', patch.photo);
    return await pb.collection('team_players').update<TeamPlayerRecord>(id, formData);
  },

  async softDeleteTeamPlayer(id: string): Promise<void> {
    await pb.collection('team_players').update(id, { deleted: true });
  },

  /**
   * Integrantes activos de la organización que todavía no están vinculados a ningún
   * jugador (no-borrado) del roster — son los únicos candidatos válidos para "vincular
   * cuenta" al crear/editar un jugador (el hook del servidor exige integrante activo,
   * esto solo evita ofrecer en la UI a alguien que igual va a ser rechazado).
   */
  async listLinkableMembers(teamId: string): Promise<any[]> {
    try {
      const [membersRes, playersRes] = await Promise.all([
        pb.collection('organization_members').getFullList({
          filter: `organization = "${teamId}" && status = "active"`,
          expand: 'user',
        }),
        pb.collection('team_players').getFullList<TeamPlayerRecord>({
          filter: `team = "${teamId}" && deleted = false && user != ""`,
        }),
      ]);
      const linkedUserIds = new Set(playersRes.map((p) => p.user).filter(Boolean));
      return membersRes
        .filter((m: any) => m.expand?.user && !linkedUserIds.has(m.expand.user.id))
        .map((m: any) => m.expand.user);
    } catch (err) {
      console.error('Error al obtener integrantes vinculables:', err);
      return [];
    }
  },
};
