import { pb } from './pocketbase';
import { User } from '../context/AuthContext';

export interface OrganizationMemberRecord {
  id: string;
  user: string;
  organization: string;
  status: 'active' | 'inactive';
  created: string;
  updated: string;
  expand?: {
    user?: User;
    organization?: User;
  };
}

export const organizationService = {
  /**
   * Obtener las membresías activas de un estudiante (a qué organizaciones pertenece)
   */
  async getStudentMemberships(studentUserId: string): Promise<OrganizationMemberRecord[]> {
    try {
      const records = await pb.collection('organization_members').getList<OrganizationMemberRecord>(1, 50, {
        filter: `user = "${studentUserId}" && status = "active"`,
        expand: 'organization',
        sort: '-created',
      });
      return records.items;
    } catch (err) {
      console.error('Error al obtener membresías de estudiante:', err);
      return [];
    }
  },

  /**
   * Obtener los integrantes/miembros de una organización
   */
  async getOrganizationMembers(organizationId: string): Promise<OrganizationMemberRecord[]> {
    try {
      const records = await pb.collection('organization_members').getList<OrganizationMemberRecord>(1, 100, {
        filter: `organization = "${organizationId}" && status = "active"`,
        expand: 'user',
        sort: '-created',
      });
      return records.items;
    } catch (err) {
      console.error('Error al obtener integrantes de organización:', err);
      return [];
    }
  },

  /**
   * Agregar a un estudiante como integrante de una organización
   */
  async addMember(organizationId: string, studentUserId: string): Promise<OrganizationMemberRecord> {
    // Comprobar si ya existe un registro previo
    const existing = await pb.collection('organization_members').getList<OrganizationMemberRecord>(1, 1, {
      filter: `organization = "${organizationId}" && user = "${studentUserId}"`,
    });

    if (existing.items.length > 0) {
      const rec = existing.items[0];
      if (rec.status === 'inactive') {
        return await pb.collection('organization_members').update<OrganizationMemberRecord>(rec.id, {
          status: 'active',
        });
      }
      return rec;
    }

    return await pb.collection('organization_members').create<OrganizationMemberRecord>({
      organization: organizationId,
      user: studentUserId,
      status: 'active',
    });
  },

  /**
   * Remover a un integrante de una organización
   */
  async removeMember(membershipId: string): Promise<void> {
    await pb.collection('organization_members').delete(membershipId);
  },

  /**
   * Buscar estudiantes para agregar como integrantes
   */
  async searchStudents(query: string): Promise<User[]> {
    if (!query || query.trim().length === 0) return [];
    const cleanQuery = query.trim().toLowerCase();
    try {
      const records = await pb.collection('users').getList<User>(1, 20, {
        filter: `type = "student" && (name ~ "${cleanQuery}" || username ~ "${cleanQuery}")`,
        sort: 'name',
      });
      return records.items;
    } catch (err) {
      console.error('Error buscando estudiantes:', err);
      return [];
    }
  },

  /**
   * Configurar el chip de la organización (texto y color)
   */
  async updateChipConfig(organizationId: string, chipText: string, chipColor: string): Promise<User> {
    const updated = await pb.collection('users').update<User>(organizationId, {
      chip_text: chipText.trim(),
      chip_color: chipColor.trim(),
    });
    await pb.collection('users').authRefresh();
    return updated;
  },
};
