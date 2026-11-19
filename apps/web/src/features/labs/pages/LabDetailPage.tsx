import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy, ExternalLink, Send } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Markdown } from '@/features/learning/components/Markdown';
import { getLab, getWokwiEmbedEnabled } from '../api';

export default function LabDetailPage() {
  const { labId = '' } = useParams();
  const lab = useQuery({ queryKey: ['lab', labId], queryFn: () => getLab(labId) });
  const embed = useQuery({ queryKey: ['settings', 'wokwi-embed'], queryFn: getWokwiEmbedEnabled });
  if (lab.isPending) return <PageSkeleton />;
  if (lab.isError) return <ErrorState onRetry={() => void lab.refetch()} />;
  if (!lab.data) return <EmptyState title="ไม่พบการทดลอง" />;
  const l = lab.data;
  const canEmbed = l.allow_embed && embed.data === true;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(l.source_code);
      toast.success('คัดลอกโค้ดแล้ว');
    } catch {
      toast.error('คัดลอกไม่สำเร็จ');
    }
  };

  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/student/labs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Virtual Lab ทั้งหมด
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{l.title}</h1>
          {l.components.length > 0 && (
            <p className="text-sm text-muted-foreground">อุปกรณ์: {l.components.join(', ')}</p>
          )}
        </div>
        <a
          href={l.project_url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants()}
        >
          <ExternalLink aria-hidden />
          เปิดใน Wokwi
        </a>
      </header>

      {canEmbed && (
        <div className="aspect-video overflow-hidden rounded-lg border bg-muted">
          <iframe
            src={l.project_url}
            title={`Wokwi: ${l.title}`}
            loading="lazy"
            className="size-full"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {l.instructions_md.trim() && (
        <Card className="space-y-2">
          <h2 className="font-semibold">ขั้นตอนการทดลอง</h2>
          <Markdown>{l.instructions_md}</Markdown>
        </Card>
      )}
      {l.diagram_url && (
        <Card className="space-y-2">
          <h2 className="font-semibold">แผนภาพวงจร</h2>
          <img
            src={l.diagram_url}
            alt={`แผนภาพวงจรของ ${l.title}`}
            loading="lazy"
            className="max-h-[32rem] rounded-lg"
          />
        </Card>
      )}
      {l.source_code.trim() && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">โค้ดตัวอย่าง</h2>
            <Button variant="outline" size="sm" onClick={() => void copy()}>
              <Copy aria-hidden />
              คัดลอก
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
            <code>{l.source_code}</code>
          </pre>
        </Card>
      )}
      {l.expected_result.trim() && (
        <Card className="space-y-2">
          <h2 className="font-semibold">ผลลัพธ์ที่คาดหวัง</h2>
          <p className="text-sm whitespace-pre-line">{l.expected_result}</p>
        </Card>
      )}
      {l.quest_id && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">เมื่อทดลองเสร็จ ส่งลิงก์โปรเจกต์ Wokwi ของคุณ และภาพผลการทดลองเป็นหลักฐาน</p>
          <Link
            to={`/student/quests/${l.quest_id}`}
            className={buttonVariants({ variant: 'secondary' })}
          >
            <Send aria-hidden />
            ส่งหลักฐานการทดลอง
          </Link>
        </Card>
      )}
    </article>
  );
}
