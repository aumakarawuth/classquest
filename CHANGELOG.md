# Changelog
รูปแบบ: Keep a Changelog · Conventional Commits

## [Unreleased]
### Added
- P1-08: RPC `admin_set_user_status`/`admin_set_user_role` (audited, idempotent, กัน self-lockout), `private.bootstrap_admin`, หน้า Admin › ผู้ใช้งาน (อนุมัติ/สิทธิ์/ระงับ, ค้นหา, แบ่งหน้า), สิทธิ์การใช้งาน, Audit Log; pgTAP +14
- P1-06: Google sign-in (Supabase PKCE), AuthProvider + TanStack Query, หน้า Login/Callback/รออนุมัติ/ไม่มีสิทธิ์, RequireArea guard ตาม role จาก DB, ออกจากระบบพร้อมยืนยัน
### Removed
- หน้าแรกแบบ "ตัวอย่างโครงหน้า" (ถูกแทนด้วย login)
- P1-07: pgTAP RLS/permission tests (31 assertions) in `supabase/tests/database`, CI `database` job
- P1-05: migration core (profiles, user_roles, system_settings + feature flags, courses, course_members, enrollment_codes, audit_logs), RLS baseline, domain restriction trigger, local Postgres test harness
- P1-04: AppShell (sidebar desktop / bottom nav mobile, skip link) สำหรับ student/teacher/admin, lazy routes, EmptyState/ErrorState/PageSkeleton/ConfirmDialog/Toaster/ComingSoon, route error boundary
- P1-03: design tokens (Tailwind v4), light/dark/system theme, Inter + Noto Sans Thai, shadcn/ui config, Button/Card/Progress/ThemeToggle/XpBar, axe WCAG AA tests
- P1-01: scaffold `apps/web` (Vite 8, React 19, TypeScript 6 strict, ESLint 10, Prettier, Vitest 5, Playwright) + CI workflow
- P0-05: ADR-0006 Google Workspace for Education + Internal OAuth + domain restriction
- P0-01: เอกสาร Phase 0 (spec, architecture, database, security, free-tier budget, design system, roadmap, tasks, ADR 0001–0005)
