/** Map Supabase OAuth callback errors to Thai messages. */
export function describeAuthError(description: string | null): string | null {
  if (!description) return null;
  if (/CQ_DOMAIN_NOT_ALLOWED|saving new user/i.test(description)) {
    return 'บัญชีนี้ไม่ได้อยู่ในโดเมนของสถานศึกษา กรุณาเข้าสู่ระบบด้วยบัญชี Google ของสถานศึกษา';
  }
  return 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
}
