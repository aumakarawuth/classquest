import type { AccountStatus, AppRole } from '@/features/auth/access';

export const roleLabels: Record<AppRole, string> = {
  admin: 'ผู้ดูแลระบบ',
  teacher: 'ครูผู้สอน',
  student: 'นักเรียน',
};

export const statusLabels: Record<AccountStatus, string> = {
  pending: 'รออนุมัติ',
  active: 'ใช้งาน',
  suspended: 'ระงับ',
};

const actionLabels: Record<string, string> = {
  'user.status_changed': 'เปลี่ยนสถานะบัญชี',
  'user.role_granted': 'เพิ่มสิทธิ์',
  'user.role_revoked': 'ถอนสิทธิ์',
  'user.admin_bootstrapped': 'ตั้งผู้ดูแลระบบคนแรก',
};

export function actionLabel(action: string): string {
  return actionLabels[action] ?? action;
}

/** Thai message for known RPC error codes (CQ_*). */
export function adminErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : String((error as { message?: unknown })?.message ?? '');
  if (message.includes('CQ_SELF_LOCKOUT')) return 'ไม่สามารถลดสิทธิ์หรือระงับบัญชีของตัวเองได้';
  if (message.includes('CQ_FORBIDDEN')) return 'คุณไม่มีสิทธิ์ทำรายการนี้';
  if (message.includes('CQ_NOT_FOUND')) return 'ไม่พบผู้ใช้งาน';
  return 'ทำรายการไม่สำเร็จ กรุณาลองใหม่';
}
