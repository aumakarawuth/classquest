import { TrendingUp, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { flagLabels, type Dashboard, type DashboardStudent } from './api';
import { segmentColors, segmentLabels, summarize, type Segment } from './segments';

const order: Segment[] = ['excelling', 'on_track', 'needs_help'];

function Donut({ counts, total }: { counts: Record<Segment, number>; total: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const label = order.map((k) => `${segmentLabels[k]} ${counts[k]} คน`).join(', ');
  return (
    <svg
      viewBox="0 0 140 140"
      className="size-40 shrink-0"
      role="img"
      aria-label={`สัดส่วนผู้เรียน: ${label}`}
    >
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--muted)" strokeWidth="18" />
      {total > 0 &&
        order.map((k) => {
          const len = (counts[k] / total) * c;
          const seg = (
            <circle
              key={k}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={segmentColors[k]}
              strokeWidth="18"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += len;
          return seg;
        })}
      <text x="70" y="66" textAnchor="middle" className="fill-foreground text-2xl font-bold">
        {total}
      </text>
      <text x="70" y="86" textAnchor="middle" className="fill-muted-foreground text-[10px]">
        ผู้เรียน
      </text>
    </svg>
  );
}

function StudentList({
  items,
  courseId,
  detail,
}: {
  items: DashboardStudent[];
  courseId: string;
  detail: (s: DashboardStudent) => string;
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">ยังไม่มี</p>;
  return (
    <ol className="space-y-2">
      {items.map((s, i) => (
        <li key={s.user_id} className="flex items-center gap-3 text-sm">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
            aria-hidden
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <Link
              to={`/teacher/courses/${courseId}/portfolio/${s.user_id}`}
              className="block truncate font-medium hover:underline"
            >
              {s.display_name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{detail(s)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** LearningMate-style class overview: donut of segments + top / struggling lists. */
export function ClassHealth({ d, courseId }: { d: Dashboard; courseId: string }) {
  const { counts, top, struggling } = summarize(d);
  const pct = (x: number | null) => (x === null ? '–' : `${x}%`);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">ภาพรวมชั้นเรียน</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Donut counts={counts} total={d.students.length} />
          <ul className="space-y-2 text-sm">
            {order.map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ background: segmentColors[k] }}
                  aria-hidden
                />
                {segmentLabels[k]} <strong className="tabular-nums">{counts[k]}</strong>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          ทำได้ดีมาก = ไม่มีสัญญาณเตือนและคะแนนภารกิจเฉลี่ย ≥ 80%
        </p>
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <TrendingUp className="size-4 text-success" aria-hidden />
          ผู้เรียนโดดเด่น
        </h2>
        <StudentList
          items={top}
          courseId={courseId}
          detail={(s) => `คะแนนภารกิจ ${pct(s.avg_quest_pct)} · ${s.xp.toLocaleString('th-TH')} XP`}
        />
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <LifeBuoy className="size-4 text-warning" aria-hidden />
          ต้องการความช่วยเหลือ
        </h2>
        <StudentList
          items={struggling}
          courseId={courseId}
          detail={(s) => s.flags.map((f) => flagLabels[f]).join(' · ')}
        />
      </Card>
    </div>
  );
}
