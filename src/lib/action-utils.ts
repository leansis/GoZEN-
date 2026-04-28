import { ActionStatus } from '../types';

/**
 * Calcula el estado automático de una acción basado en su fecha de vencimiento y estado actual.
 * 
 * Reglas:
 * - Si está finalizada o cancelada, mantiene ese estado (estados terminales).
 * - Si no tiene fecha de vencimiento, por defecto es 'en_progreso' (o 'pendiente').
 * - Si la fecha de vencimiento ya pasó, es 'retrasada'.
 * - Si la fecha de vencimiento es hoy o futura, es 'en_progreso'.
 */
export const calculateAutomaticStatus = (targetDate: string | undefined, currentStatus: ActionStatus): ActionStatus => {
  // Los estados terminales no se cambian automáticamente
  if (currentStatus === 'finalizada' || currentStatus === 'cancelada' || currentStatus === 'bloqueada') {
    return currentStatus;
  }
  
  if (!targetDate) return 'en_progreso';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const deadline = new Date(targetDate);
  deadline.setHours(0, 0, 0, 0);

  if (deadline < today) {
    return 'retrasada';
  }
  
  return 'en_progreso';
};
