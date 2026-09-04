import { pb } from './pocketbase';

export const accountService = {
  /**
   * Elimina (anonimiza) la cuenta propia de forma permanente. El backend pide la
   * contraseña como reautenticación — ver /api/account/delete en
   * backend/pb_hooks/account_deletion.pb.js.
   */
  async deleteAccount(password: string): Promise<void> {
    await pb.send('/api/account/delete', { method: 'POST', body: { password } });
  },
};
