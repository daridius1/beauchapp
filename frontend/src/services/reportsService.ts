import { pb } from './pocketbase';

export interface SubmitReportParams {
  targetType?: string;
  targetId?: string;
  title: string;
  message: string;
}

export const reportsService = {
  submitReport: async ({ targetType, targetId, title, message }: SubmitReportParams): Promise<void> => {
    const user = pb.authStore.model;
    if (!user) throw new Error('Debes iniciar sesión para enviar un reporte.');

    await pb.collection('reports').create({
      reporter: user.id,
      targetType: targetType || '',
      targetId: targetId || '',
      title: title.trim(),
      message: message.trim(),
    });
  },
};
