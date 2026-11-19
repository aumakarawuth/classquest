# DESIGN SYSTEM

แนวทาง: Modern SaaS + Gaming progress, Bento grid, minimal, premium

## Tokens (CSS variables, HSL สำหรับ shadcn)
| Token | Light | Dark |
|---|---|---|
| --primary | indigo-600 `#4F46E5` | indigo-400 `#818CF8` |
| --accent (violet) | violet-600 `#7C3AED` | violet-400 |
| --secondary (cyan) | cyan-600 `#0891B2` | cyan-400 |
| --success | emerald-600 | emerald-400 |
| --warning | amber-500 (ข้อความใช้ amber-800) | amber-400 |
| --bg / --fg | slate-50 / slate-900 | slate-950 / slate-100 |
| XP gradient | indigo-500 → violet-500 → cyan-400 | เหมือนกัน |
ทุกคู่สีข้อความต้องผ่าน WCAG AA (4.5:1)

## Typography
`font-family: "Inter", "Noto Sans Thai", system-ui` (Inter จับละติน, Noto Sans Thai จับไทย) · base 16px, line-height 1.6 (ไทยต้องสูงกว่าปกติ) · scale: 12/14/16/18/20/24/30/36

## Components
- Primitives: shadcn/ui (Button, Card, Dialog, Sheet, Tabs, Toast/Sonner, Skeleton, Progress, Badge, Tooltip, Form)
- Game components: `XpBar`, `LevelRing`, `QuestCard` (ป้ายประเภท + difficulty dots + XP chip), `BadgeTile` (locked/unlocked), `SkillTreeNode`, `StageStepper` (Q-U-E-S-T), `StreakFlame` (weekly, ไม่ลงโทษ)
- States: `EmptyState`, `ErrorState` (retry), `PageSkeleton`, `ConfirmDialog`, `ComingSoonBadge`
- Quest type colors: Main=indigo, Side=cyan, Daily=emerald, Weekly=sky, Challenge=amber, Boss=violet+glow

## Layout
- Desktop: sidebar 256px + content bento grid 12 col
- Mobile: bottom nav 5 ปุ่ม (หน้าหลัก, วิชา, ภารกิจ, ความสำเร็จ, โปรไฟล์), touch target ≥ 44px
- Motion: 150–250ms ease-out; ปิดเมื่อ `prefers-reduced-motion`; level-up celebration แบบสั้น

## Accessibility
focus ring 2px primary + offset · ทุก input มี `<Label>` · keyboard navigable dialogs · icon buttons มี `aria-label` ภาษาไทย
