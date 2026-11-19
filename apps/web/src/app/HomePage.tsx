import { Sparkles, Swords, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const stages = [
  { key: 'Q', name: 'Question', th: 'ตั้งคำถาม' },
  { key: 'U', name: 'Understand', th: 'ทำความเข้าใจ' },
  { key: 'E', name: 'Experiment', th: 'ทดลอง' },
  { key: 'S', name: 'Solve', th: 'แก้ปัญหา' },
  { key: 'T', name: 'Transfer', th: 'ถ่ายทอด' },
];

export function HomePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="xp-gradient inline-flex size-10 items-center justify-center rounded-lg text-white">
            <Swords className="size-5" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">ClassQuest</h1>
        </div>
        <ThemeToggle />
      </header>

      <p className="text-muted-foreground">
        แพลตฟอร์มการเรียนรู้แบบเกมและติดตามสมรรถนะ — กำลังพัฒนา (Phase 1)
      </p>

      <section aria-labelledby="quest-model" className="grid gap-4 sm:grid-cols-5">
        <h2 id="quest-model" className="sr-only">
          รูปแบบการเรียนรู้ QUEST
        </h2>
        {stages.map((stage) => (
          <Card key={stage.key} className="flex items-center gap-3 sm:flex-col sm:items-start">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
              {stage.key}
            </span>
            <div>
              <p className="font-semibold">{stage.name}</p>
              <p className="text-sm text-muted-foreground">{stage.th}</p>
            </div>
          </Card>
        ))}
      </section>

      <section aria-labelledby="shell-preview" className="space-y-3">
        <h2 id="shell-preview" className="font-semibold">
          ตัวอย่างโครงหน้า (ก่อนเปิดระบบเข้าสู่ระบบ)
        </h2>
        <p className="text-sm text-muted-foreground">
          ใช้ตรวจ layout ระหว่างพัฒนาเท่านั้น — เมื่อมีระบบเข้าสู่ระบบ (P1-06)
          ผู้ใช้จะเข้าได้เฉพาะหน้าตามสิทธิ์ที่ผู้ดูแลกำหนด
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/student" className={buttonVariants()}>
            นักเรียน
          </Link>
          <Link to="/teacher" className={buttonVariants({ variant: 'secondary' })}>
            ครูผู้สอน
          </Link>
          <Link to="/admin" className={buttonVariants({ variant: 'outline' })}>
            ผู้ดูแลระบบ
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-start gap-3">
          <Sparkles className="mt-1 size-5 text-secondary" aria-hidden />
          <p className="text-sm">ระบบ XP, เลเวล และ Badge จะเปิดใช้ใน Phase 3</p>
        </Card>
        <Card className="flex items-start gap-3">
          <Trophy className="mt-1 size-5 text-success" aria-hidden />
          <p className="text-sm">ติดตามสมรรถนะรายบุคคลจะเปิดใช้ใน Phase 4</p>
        </Card>
      </section>
    </main>
  );
}
