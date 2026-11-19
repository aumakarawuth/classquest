import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { listQuizzes } from '../api';
import { getPrePostReport, summarize, toCsv } from '../prepost';

export default function PrePostReportPage() {
  const { courseId = '' } = useParams();
  const quizzes = useQuery({
    queryKey: ['quizzes', courseId],
    queryFn: () => listQuizzes(courseId),
  });
  const [pre, setPre] = useState('');
  const [post, setPost] = useState('');
  const [anonymized, setAnonymized] = useState(true);
  const preId = pre || quizzes.data?.find((q) => q.kind === 'pretest')?.id || '';
  const postId = post || quizzes.data?.find((q) => q.kind === 'posttest')?.id || '';

  const report = useQuery({
    queryKey: ['prepost', courseId, preId, postId, anonymized],
    queryFn: () => getPrePostReport(courseId, preId, postId, anonymized),
    enabled: !!preId && !!postId,
  });

  const download = () => {
    if (!report.data) return;
    const url = URL.createObjectURL(
      new Blob([toCsv(report.data)], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `prepost-${anonymized ? 'anonymized' : 'named'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Link
        to={`/teacher/courses/${courseId}/quizzes`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        แบบทดสอบ
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">เปรียบเทียบผลก่อนเรียน–หลังเรียน</h1>
        <p className="text-sm text-muted-foreground">
          คำนวณจากการทำครั้งแรกที่ตรวจเสร็จแล้วของแต่ละแบบทดสอบ ใช้เฉพาะนักเรียนที่มีผลทั้งสองครั้ง ไม่มีการเติมค่าแทน
        </p>
      </div>

      <Card className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="pp-pre" className="block text-sm font-medium">
            แบบทดสอบก่อนเรียน
          </label>
          <select
            id="pp-pre"
            value={preId}
            onChange={(e) => setPre(e.target.value)}
            className={inputClass}
          >
            <option value="">เลือก</option>
            {quizzes.data?.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="pp-post" className="block text-sm font-medium">
            แบบทดสอบหลังเรียน
          </label>
          <select
            id="pp-post"
            value={postId}
            onChange={(e) => setPost(e.target.value)}
            className={inputClass}
          >
            <option value="">เลือก</option>
            {quizzes.data?.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
        </div>
        <label className="inline-flex min-h-11 items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={anonymized}
            onChange={(e) => setAnonymized(e.target.checked)}
            className="size-5 accent-[var(--primary)]"
          />
          ใช้รหัสนิรนาม (สำหรับรายงานเผยแพร่)
        </label>
      </Card>

      {!preId || !postId ? (
        <EmptyState title="เลือกแบบทดสอบก่อนเรียนและหลังเรียน" />
      ) : report.isPending ? (
        <PageSkeleton />
      ) : report.isError ? (
        <ErrorState onRetry={() => void report.refetch()} />
      ) : (
        <Report rows={report.data} onDownload={download} />
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="space-y-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

const fmt = (x: number | null, unit = '') =>
  x === null ? '–' : `${x.toLocaleString('th-TH')}${unit}`;

function Report({
  rows,
  onDownload,
}: {
  rows: Awaited<ReturnType<typeof getPrePostReport>>;
  onDownload: () => void;
}) {
  const s = summarize(rows);
  const paired = rows.filter((r) => r.pre_percent !== null && r.post_percent !== null);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="นักเรียนที่มีผลครบทั้งสองครั้ง" value={`${s.paired}/${s.enrolled}`} />
        <Stat
          label="เฉลี่ยก่อน → หลังเรียน"
          value={`${fmt(s.meanPre)} → ${fmt(s.meanPost)}`}
          hint="ร้อยละ"
        />
        <Stat
          label="ผลต่างเฉลี่ย (SD)"
          value={`${fmt(s.meanGain)} (${fmt(s.sdGain)})`}
          hint={`พัฒนาขึ้น ${s.improved} คน`}
        />
        <Stat
          label="Normalized gain เฉลี่ย"
          value={fmt(s.meanNormalizedGain)}
          hint={s.t !== null ? `paired t = ${s.t}, df = ${s.df}` : undefined}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        ค่าสถิติเป็นการคำนวณเบื้องต้นจากข้อมูลจริง การสรุปผลทางสถิติ (เช่น ระดับนัยสำคัญ)
        ควรตรวจสอบด้วยโปรแกรมสถิติก่อนใช้ในรายงาน
      </p>

      {paired.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold">คะแนนรายบุคคล (ร้อยละ)</h2>
          <div className="h-72" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paired} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="student"
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  interval={0}
                  angle={paired.length > 12 ? -45 : 0}
                  textAnchor={paired.length > 12 ? 'end' : 'middle'}
                  height={paired.length > 12 ? 50 : 30}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar
                  dataKey="pre_percent"
                  name="ก่อนเรียน"
                  fill="var(--secondary)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="post_percent"
                  name="หลังเรียน"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">กราฟแสดงข้อมูลเดียวกับตารางด้านล่าง</p>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">ตารางผลรายบุคคล</h2>
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download aria-hidden />
            ดาวน์โหลด CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="sr-only">ผลก่อนเรียนและหลังเรียนรายบุคคล</caption>
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="p-2">
                  นักเรียน
                </th>
                <th scope="col" className="p-2 text-right">
                  ก่อนเรียน
                </th>
                <th scope="col" className="p-2 text-right">
                  หลังเรียน
                </th>
                <th scope="col" className="p-2 text-right">
                  ผลต่าง
                </th>
                <th scope="col" className="p-2 text-right">
                  Normalized gain
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student} className="border-b last:border-0">
                  <th scope="row" className="p-2 text-left font-normal">
                    {r.student}
                  </th>
                  <td className="p-2 text-right tabular-nums">{fmt(r.pre_percent)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.post_percent)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.gain)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.normalized_gain)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
