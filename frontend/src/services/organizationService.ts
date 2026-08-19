import { pb } from './pocketbase';
import { User } from '../context/AuthContext';

export interface OrganizationMemberRecord {
  id: string;
  user: string;
  organization: string;
  status: 'active' | 'inactive' | 'pending';
  role?: string;
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
   * Obtener los integrantes ACTIVOS de una organización — es lo que se muestra en
   * lugares públicos (contador "Integrantes" y listado del perfil), así que las
   * invitaciones todavía pendientes no cuentan acá a propósito.
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
   * Igual que `getOrganizationMembers`, pero para el panel de gestión en Ajustes de la
   * propia organización — ahí sí hace falta ver las invitaciones pendientes (para poder
   * mostrar su estado o cancelarlas), a diferencia de cualquier vista pública.
   */
  async getOrganizationMembersForManagement(organizationId: string): Promise<OrganizationMemberRecord[]> {
    try {
      const records = await pb.collection('organization_members').getList<OrganizationMemberRecord>(1, 100, {
        filter: `organization = "${organizationId}" && (status = "active" || status = "pending")`,
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
   * Invitar a un estudiante a ser integrante de una organización con un rol opcional —
   * el nombre del método se mantiene por compatibilidad, pero ya no agrega instantáneo:
   * el servidor fuerza `status: 'pending'` sin importar lo que se mande acá (ver
   * auth.pb.js), así que esto siempre crea/reenvía una invitación, nunca activa una
   * membresía directamente — eso solo lo hace el propio invitado, aceptando.
   */
  async addMember(organizationId: string, studentUserId: string, role: string = ''): Promise<OrganizationMemberRecord> {
    // Comprobar si ya existe un registro previo (ej. alguien que fue sacado antes)
    const existing = await pb.collection('organization_members').getList<OrganizationMemberRecord>(1, 1, {
      filter: `organization = "${organizationId}" && user = "${studentUserId}"`,
    });

    if (existing.items.length > 0) {
      const rec = existing.items[0];
      return await pb.collection('organization_members').update<OrganizationMemberRecord>(rec.id, {
        status: 'pending',
        role: role.trim(),
      });
    }

    return await pb.collection('organization_members').create<OrganizationMemberRecord>({
      organization: organizationId,
      user: studentUserId,
      status: 'pending',
      role: role.trim(),
    });
  },

  /**
   * Responder (aceptar/rechazar) una invitación pendiente de una organización — lo
   * llama el propio estudiante invitado.
   */
  async respondToInvite(organizationId: string, decision: 'accept' | 'reject'): Promise<void> {
    await pb.send('/api/org-invites/respond', {
      method: 'POST',
      body: { organizationId, decision },
    });
  },

  /**
   * Buscar si el estudiante actual tiene una invitación pendiente de una organización
   * puntual — usado en el perfil de la organización para mostrar el banner de
   * aceptar/rechazar.
   */
  async getPendingInvite(organizationId: string, studentUserId: string): Promise<OrganizationMemberRecord | null> {
    try {
      return await pb.collection('organization_members').getFirstListItem<OrganizationMemberRecord>(
        `organization = "${organizationId}" && user = "${studentUserId}" && status = "pending"`
      );
    } catch (err) {
      return null;
    }
  },

  /**
   * Actualizar el rol de un integrante de la organización
   */
  async updateMemberRole(membershipId: string, role: string): Promise<OrganizationMemberRecord> {
    return await pb.collection('organization_members').update<OrganizationMemberRecord>(membershipId, {
      role: role.trim(),
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
