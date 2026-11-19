import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { listQuizzes } from '@/features/assessment/api';
import { getPrePostReport, summarize } from '@/features/assessment/prepost';
import { downloadText, toCsv } from '@/features/classroom/csv';
import { getCourse } from '@/features/courses/api';
import { Markdown } from '@/features/learning/components/Markdown';
import {
  categoryLabels,
  competencySummary,
  evidenceCategories,
  listEvidence,
  listSurveys,
  surveySummary,
} from '../api';
import { SurveyResults } from '../components/SurveyManager';

async function loadReport(courseId: string) {
  const [course, evidence, quizzes, competencies, surveys] = await Promise.all([
    getCourse(courseId),
    listEvidence(courseId),
    listQuizzes(courseId),
    competencySummary(courseId),
    listSurveys(courseId),
  ]);
  const pre = quizzes.find((q) => q.kind === 'pretest');
  const post = quizzes.find((q) => q.kind === 'posttest');
  const prepost = pre && post ? await getPrePostReport(courseId, pre.id, post.id, true) : null;
  return { course, evidence, competencies, surveys, prepost, pre, post };
}

export default function EvidenceReportPage() {
  const { courseId = '' } = useParams();
  const q = useQuery({
    queryKey: ['evidence-report', courseId],
    queryFn: () => loadReport(courseId),
  });
  if (q.isPending) return <PageSkeleton />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;
  const { course, evidence, competencies, surveys, prepost, pre, post } = q.data;
  const s = prepost ? summarize(prepost) : null;
  const generated = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const exportCsv = async () => {
    const rows: (string | number | null)[][] = [['หมวด', 'ชื่อหลักฐาน', 'วันที่', 'ลิงก์', 'รายละเอียด']];
    for (const e of evidence)
      rows.push([categoryLabels[e.category], e.title, e.occurred_on, e.url, e.body_md]);
    for (const c of competencies)
      rows.push([
        categoryLabels.competency_results,
        `${c.code} ${c.name}`,
        null,
        null,
        `ผ่าน ${c.passed}/${c.students} (ประเมินแล้ว ${c.assessed})`,
      ]);
    for (const sv of surveys) {
      const sum = await surveySummary(sv.id);
      for (const i of sum.items ?? [])
        if (i.type === 'likert')
          rows.push([
            categoryLabels.satisfaction,
            i.text,
            null,
            null,
            `x̄=${i.mean ?? '-'} S.D.=${i.sd ?? '-'} n=${i.n ?? 0}`,
          ]);
    }
    downloadText(`evidence-${course?.code ?? 'course'}.csv`, toCsv(rows));
  };

  return (
    <article className="mx-auto max-w-4xl space-y-8 print:max-w-none">
      <div className="flex flex-wrap justify-between gap-2 print:hidden">
        <Link
          to="/teacher/evidence"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          ศูนย์หลักฐาน
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void exportCsv()}>
            <Download aria-hidden />
            CSV
          </Button>
          <Button onClick={() => window.print()}>
            <Printer aria-hidden />
            พิมพ์ / บันทึก PDF
          </Button>
        </div>
      </div>
      <header className="space-y-1 border-b pb-4">
        <h1 className="text-2xl font-bold">รายงานหลักฐานนวัตกรรมการเรียนการสอน ClassQuest</h1>
        {course && (
          <p>
            รายวิชา {course.code} {course.name} · ภาคเรียน {course.term}/{course.academicYear}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          สร้างจากข้อมูลจริงในระบบ ณ {generated} · ผู้เรียนแสดงด้วยรหัสนิรนาม
        </p>
      </header>

      {evidenceCategories.map((c, i) => {
        const items = evidence.filter((e) => e.category === c);
        return (
          <section key={c} className="space-y-3 break-inside-avoid-page">
            <h2 className="text-lg font-semibold">
              {i + 1}. {categoryLabels[c]}
            </h2>
            {c === 'prepost_results' &&
              (s && pre && post ? (
                <div className="space-y-2 text-sm">
                  <p>
                    เปรียบเทียบ “{pre.title}” กับ “{post.title}” ผู้เรียนที่มีผลครบ {s.paired} จาก{' '}
                    {s.enrolled} คน
                  </p>
                  <table className="w-full max-w-lg border text-sm">
                    <caption className="sr-only">สรุปผลก่อนและหลังเรียน</caption>
                    <tbody>
                      <tr className="border-b">
                        <th scope="row" className="p-2 text-left font-normal">
                          ค่าเฉลี่ยก่อนเรียน (ร้อยละ)
                        </th>
                        <td className="p-2 text-right">{s.meanPre ?? '–'}</td>
                      </tr>
                      <tr className="border-b">
                        <th scope="row" className="p-2 text-left font-normal">
                          ค่าเฉลี่ยหลังเรียน (ร้อยละ)
                        </th>
                        <td className="p-2 text-right">{s.meanPost ?? '–'}</td>
                      </tr>
                      <tr className="border-b">
                        <th scope="row" className="p-2 text-left font-normal">
                          ผลต่างเฉลี่ย (S.D.)
                        </th>
                        <td className="p-2 text-right">
                          {s.meanGain ?? '–'} ({s.sdGain ?? '–'})
                        </td>
                      </tr>
                      <tr className="border-b">
                        <th scope="row" className="p-2 text-left font-normal">
                          Normalized gain เฉลี่ย
                        </th>
                        <td className="p-2 text-right">{s.meanNormalizedGain ?? '–'}</td>
                      </tr>
                      <tr>
                        <th scope="row" className="p-2 text-left font-normal">
                          paired t (df)
                        </th>
                        <td className="p-2 text-right">
                          {s.t ?? '–'} ({s.df ?? '–'})
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-xs text-muted-foreground">
                    ควรตรวจสอบนัยสำคัญทางสถิติด้วยโปรแกรมสถิติก่อนสรุปผล
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลแบบทดสอบก่อน/หลังเรียนครบ</p>
              ))}
            {c === 'competency_results' &&
              (competencies.length ? (
                <table className="w-full border text-sm">
                  <caption className="sr-only">สรุปผลสมรรถนะ</caption>
                  <thead>
                    <tr className="border-b text-left">
                      <th scope="col" className="p-2">
                        สมรรถนะ
                      </th>
                      <th scope="col" className="p-2 text-right">
                        ผ่าน
                      </th>
                      <th scope="col" className="p-2 text-right">
                        ประเมินแล้ว
                      </th>
                      <th scope="col" className="p-2 text-right">
                        ผู้เรียน
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {competencies.map((k) => (
                      <tr key={k.code} className="border-b last:border-0">
                        <th scope="row" className="p-2 text-left font-normal">
                          {k.code} {k.name}
                        </th>
                        <td className="p-2 text-right">{k.passed}</td>
                        <td className="p-2 text-right">{k.assessed}</td>
                        <td className="p-2 text-right">{k.students}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">ยังไม่ได้กำหนดสมรรถนะ</p>
              ))}
            {c === 'satisfaction' &&
              surveys.map((sv) => (
                <div key={sv.id} className="space-y-1">
                  <h3 className="font-medium">{sv.title}</h3>
                  <SurveyResults surveyId={sv.id} />
                </div>
              ))}
            {items.map((e) => (
              <div key={e.id} className="space-y-1">
                <h3 className="font-medium">{e.title}</h3>
                {e.body_md && <Markdown>{e.body_md}</Markdown>}
                {e.url && <p className="text-sm break-all">ลิงก์: {e.url}</p>}
              </div>
            ))}
            {!items.length &&
              !['prepost_results', 'competency_results', 'satisfaction'].includes(c) && (
                <p className="text-sm text-muted-foreground">— ยังไม่มีหลักฐาน —</p>
              )}
          </section>
        );
      })}
    </article>
  );
}
