import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { listCompetencies, recordCompetencyResult } from '../api';
import { CompetencyReport } from '../components/CompetencyReport';

/** Teacher view of one student's competency report + manual (practical) assessment. */
export default function StudentReportPage() {
  const { courseId = '', userId = '' } = useParams();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={`/teacher/courses/${courseId}/competency-matrix`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        ตารางสมรรถนะ
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">รายงานสมรรถนะรายบุคคล</h1>
      <ManualAssessment courseId={courseId} userId={userId} />
      <CompetencyReport courseId={courseId} userId={userId} />
    </div>
  );
}

function ManualAssessment({ courseId, userId }: { courseId: string; userId: string }) {
  const queryClient = useQueryClient();
  const competencies = useQuery({
    queryKey: ['competency', 'list', courseId],
    queryFn: () => listCompetencies(courseId),
  });
  const [competencyId, setCompetencyId] = useState('');
  const [percent, setPercent] = useState('');
  const [note, setNote] = useState('');
  const record = useMutation({
    mutationFn: () => recordCompetencyResult(competencyId, userId, Number(percent), note),
    onSuccess: () => {
      toast.success('บันทึกผลการประเมินแล้ว');
      setPercent('');
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['competency'] });
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });
  const valid = competencyId && percent !== '' && Number(percent) >= 0 && Number(percent) <= 100;
  return (
    <Card>
      <form
        className="grid gap-3 sm:grid-cols-[1fr_7rem]"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) record.mutate();
        }}
      >
        <h2 className="font-semibold sm:col-span-2">
          บันทึกผลการประเมินเพิ่ม (เช่น สอบปฏิบัติ สังเกตพฤติกรรม)
        </h2>
        <div className="space-y-1">
          <label htmlFor="ma-k" className="block text-sm">
            สมรรถนะ
          </label>
          <select
            id="ma-k"
            value={competencyId}
            onChange={(e) => setCompetencyId(e.target.value)}
            className={inputClass}
          >
            <option value="">เลือกสมรรถนะ</option>
            {competencies.data?.map((k) => (
              <option key={k.id} value={k.id}>
                {k.code} {k.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="ma-p" className="block text-sm">
            ผล (%)
          </label>
          <input
            id="ma-p"
            type="number"
            min={0}
            max={100}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="ma-n" className="block text-sm">
            บันทึก
          </label>
          <input
            id="ma-n"
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={!valid || record.isPending}>
            บันทึกผล
          </Button>
        </div>
      </form>
    </Card>
  );
}
