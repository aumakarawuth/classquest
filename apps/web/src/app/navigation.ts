import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Database,
  FileArchive,
  FolderKanban,
  Gauge,
  GraduationCap,
  History,
  LayoutDashboard,
  Link2,
  Map,
  Settings,
  ShieldCheck,
  Swords,
  Target,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type ShellArea = 'student' | 'teacher' | 'admin';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar (max 5 per area). */
  primary?: boolean;
}

export interface NavArea {
  basePath: string;
  title: string;
  items: NavItem[];
}

/**
 * Navigation per shell area. Which area a user may open is decided by the
 * backend role (route guards arrive in P1-06) — never by this file.
 */
export const navAreas: Record<ShellArea, NavArea> = {
  student: {
    basePath: '/student',
    title: 'นักเรียน',
    items: [
      { path: '', label: 'หน้าหลัก', icon: LayoutDashboard, primary: true },
      { path: 'courses', label: 'รายวิชาของฉัน', icon: BookOpen, primary: true },
      { path: 'roadmap', label: 'เส้นทางการเรียน', icon: Map },
      { path: 'quests', label: 'ภารกิจ', icon: Swords, primary: true },
      { path: 'achievements', label: 'ความสำเร็จ', icon: Trophy, primary: true },
      { path: 'competency', label: 'สมรรถนะ', icon: Target },
      { path: 'portfolio', label: 'แฟ้มสะสมผลงาน', icon: FolderKanban },
      { path: 'profile', label: 'โปรไฟล์', icon: User, primary: true },
    ],
  },
  teacher: {
    basePath: '/teacher',
    title: 'ครูผู้สอน',
    items: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard, primary: true },
      { path: 'courses', label: 'จัดการรายวิชา', icon: BookOpen, primary: true },
      { path: 'students', label: 'นักเรียน', icon: Users },
      { path: 'reviews', label: 'ตรวจงาน', icon: ClipboardCheck, primary: true },
      { path: 'gradebook', label: 'สมุดคะแนน', icon: GraduationCap },
      { path: 'competency', label: 'สมรรถนะ', icon: Target },
      { path: 'analytics', label: 'การวิเคราะห์', icon: BarChart3, primary: true },
      { path: 'classroom', label: 'Google Classroom', icon: Link2 },
      { path: 'evidence', label: 'หลักฐานการประกวด', icon: Award },
      { path: 'settings', label: 'ตั้งค่า', icon: Settings, primary: true },
    ],
  },
  admin: {
    basePath: '/admin',
    title: 'ผู้ดูแลระบบ',
    items: [
      { path: '', label: 'ภาพรวมระบบ', icon: Gauge, primary: true },
      { path: 'users', label: 'ผู้ใช้งาน', icon: Users, primary: true },
      { path: 'roles', label: 'สิทธิ์การใช้งาน', icon: ShieldCheck },
      { path: 'audit', label: 'Audit Log', icon: History, primary: true },
      { path: 'backup', label: 'สำรองและส่งออก', icon: FileArchive },
      { path: 'quota', label: 'โควตาบริการ', icon: Database, primary: true },
      { path: 'settings', label: 'ตั้งค่าระบบ', icon: Settings, primary: true },
    ],
  },
};

export function fullPath(area: NavArea, item: NavItem): string {
  return item.path ? `${area.basePath}/${item.path}` : area.basePath;
}
