import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Copy,
  Cpu,
  ExternalLink,
  FileCode2,
  ListChecks,
  Send,
  Target,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Markdown } from '@/features/learning/components/Markdown';
import { cn } from '@/lib/utils';
import { getLab, getWokwiEmbedEnabled, type Lab } from '../api';

type Tab = 'steps' | 'parts' | 'goal';
const tabs: { id: Tab; label: string; icon: typeof Cpu }[] = [
  { id: 'steps', label: 'ขั้นตอน', icon: ListChecks },
  { id: 'parts', label: 'อุปกรณ์', icon: Cpu },
  { id: 'goal', label: 'ผลลัพธ์', icon: Target },
];

function SidePanel({ l }: { l: Lab }) {
  const [tab, setTab] = useState<Tab>('steps');
  return (
    <section className="flex min-h-0 flex-col rounded-xl border bg-card">
      <div role="tablist" aria-label="ข้อมูลการทดลอง" className="flex border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`lab-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`lab-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm',
              tab === t.id
                ? 'border-b-2 border-primary font-semibold text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`lab-panel-${tab}`}
        aria-labelledby={`lab-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto p-4 text-sm"
      >
        {tab === 'steps' &&
          (l.instructions_md.trim() ? (
            <>
              <h2 className="mb-2 font-semibold">ขั้นตอนการทดลอง</h2>
              <Markdown>{l.instructions_md}</Markdown>
            </>
          ) : (
            <p className="text-muted-foreground">ครูยังไม่ได้ใส่ขั้นตอน</p>
          ))}
        {tab === 'parts' &&
          (l.components.length ? (
            <ul className="grid grid-cols-2 gap-2">
              {l.components.map((c) => (
                <li key={c} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <Cpu className="size-4 text-primary" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">ไม่ได้ระบุอุปกรณ์</p>
          ))}
        {tab === 'goal' &&
          (l.expected_result.trim() ? (
            <>
              <h2 className="mb-2 font-semibold">ผลลัพธ์ที่คาดหวัง</h2>
              <p className="whitespace-pre-line">{l.expected_result}</p>
            </>
          ) : (
            <p className="text-muted-foreground">ไม่ได้ระบุผลลัพธ์</p>
          ))}
      </div>
    </section>
  );
}

function CodePanel({ code }: { code: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('คัดลอกโค้ดแล้ว');
    } catch {
      toast.error('คัดลอกไม่สำเร็จ');
    }
  };
  const lines = code.replace(/\n$/, '').split('\n');
  return (
    <section
      aria-labelledby="lab-code-h"
      className="overflow-hidden rounded-xl border bg-slate-950 text-slate-100"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <h2 id="lab-code-h" className="flex items-center gap-2 text-sm font-semibold">
          <FileCode2 className="size-4 text-sky-400" aria-hidden />
          โค้ดตัวอย่าง <span className="font-normal text-slate-400">sketch.ino</span>
        </h2>
        <Button variant="secondary" size="sm" onClick={() => void copy()}>
          <Copy aria-hidden />
          คัดลอก
        </Button>
      </div>
      <pre className="max-h-96 overflow-auto p-3 font-mono text-[13px] leading-6">
        <code>
          {lines.map((ln, i) => (
            <span key={i} className="block">
              <span
                className="mr-4 inline-block w-8 text-right text-slate-500 select-none"
                aria-hidden
              >
                {i + 1}
              </span>
              {ln || ' '}
            </span>
          ))}
        </code>
      </pre>
    </section>
  );
}

export default function LabDetailPage() {
  const { labId = '' } = useParams();
  const lab = useQuery({ queryKey: ['lab', labId], queryFn: () => getLab(labId) });
  const embed = useQuery({ queryKey: ['settings', 'wokwi-embed'], queryFn: getWokwiEmbedEnabled });
  if (lab.isPending) return <PageSkeleton />;
  if (lab.isError) return <ErrorState onRetry={() => void lab.refetch()} />;
  if (!lab.data) return <EmptyState title="ไม่พบการทดลอง" />;
  const l = lab.data;
  const canEmbed = l.allow_embed && embed.data === true;

  return (
    <article className="space-y-4">
      <header className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-slate-100 shadow">
        <Link
          to="/student/labs"
          className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Virtual Lab ทั้งหมด
        </Link>
        <span className="hidden h-5 w-px bg-slate-700 sm:block" aria-hidden />
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{l.title}</h1>
        <a
          href={l.project_url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: 'sm' })}
        >
          <ExternalLink aria-hidden />
          เปิดใน Wokwi
        </a>
        {l.quest_id && (
          <Link
            to={`/student/quests/${l.quest_id}`}
            className={buttonVariants({ size: 'sm', variant: 'secondary' })}
          >
            <Send aria-hidden />
            ส่งหลักฐานการทดลอง
          </Link>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <SidePanel l={l} />
        <div className="space-y-4">
          <section
            aria-label="พื้นที่จำลองวงจร"
            className="overflow-hidden rounded-xl border bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px]"
          >
            {canEmbed ? (
              <iframe
                src={l.project_url}
                title={`Wokwi: ${l.title}`}
                loading="lazy"
                className="aspect-video w-full"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
              />
            ) : l.diagram_url ? (
              <figure className="flex justify-center p-4">
                <img
                  src={l.diagram_url}
                  alt={`แผนภาพวงจรของ ${l.title}`}
                  loading="lazy"
                  className="max-h-[28rem] rounded-lg bg-card"
                />
              </figure>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center">
                <Cpu className="size-12 text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  เปิดโปรเจกต์ใน Wokwi เพื่อต่อวงจรและกดรันการจำลอง
                </p>
              </div>
            )}
          </section>
          {l.diagram_url && canEmbed && (
            <details className="rounded-xl border bg-card p-3 text-sm">
              <summary className="cursor-pointer font-semibold">แผนภาพวงจร</summary>
              <img
                src={l.diagram_url}
                alt={`แผนภาพวงจรของ ${l.title}`}
                loading="lazy"
                className="mt-3 max-h-[28rem] rounded-lg"
              />
            </details>
          )}
          {l.source_code.trim() && <CodePanel code={l.source_code} />}
        </div>
      </div>
    </article>
  );
}
