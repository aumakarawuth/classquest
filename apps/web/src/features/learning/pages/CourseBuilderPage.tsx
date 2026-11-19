import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import { cn } from '@/lib/utils';
import {
  createLesson,
  deleteLesson,
  getBuilder,
  learningErrorMessage,
  reorderLessons,
  setLessonPublished,
  updateUnit,
  type BuilderUnit,
} from '../api';
import { moveItem, questStageLabels } from '../resources';

export default function CourseBuilderPage() {
  const { courseId = '' } = useParams();
  const query = useQuery({ queryKey: ['builder', courseId], queryFn: () => getBuilder(courseId) });

  return (
    <div className="space-y-6">
      <Link
        to={`/teacher/courses/${courseId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        กลับไปที่รายวิชา
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ออกแบบรายวิชา</h1>
        <p className="text-sm text-muted-foreground">
          จัดหน่วยการเรียนรู้และบทเรียน นักเรียนจะเห็นเฉพาะหน่วยและบทเรียนที่ “เผยแพร่”
        </p>
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState title="ไม่พบหน่วยการเรียนรู้" description="คุณอาจไม่ได้เป็นผู้สอนรายวิชานี้" />
      ) : (
        <ol className="space-y-4">
          {query.data.map((unit) => (
            <UnitCard key={unit.id} unit={unit} courseId={courseId} />
          ))}
        </ol>
      )}
    </div>
  );
}

function UnitCard({ unit, courseId }: { unit: BuilderUnit; courseId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState(unit.title);
  const [editing, setEditing] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['builder', courseId] });
  const onError = (e: unknown) => {
    toast.error(learningErrorMessage(e));
    refresh();
  };

  const saveUnit = useMutation({
    mutationFn: (patch: { title?: string; published?: boolean }) => updateUnit(unit.id, patch),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
    onError,
  });
  const addLesson = useMutation({
    mutationFn: () => {
      const position = Math.max(0, ...unit.lessons.map((l) => l.position)) + 1;
      return createLesson(unit.id, 'บทเรียนใหม่', position);
    },
    onSuccess: (id) => void navigate(`/teacher/courses/${courseId}/lessons/${id}`),
    onError,
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderLessons(unit.id, ids),
    onSuccess: refresh,
    onError,
  });
  const publishLesson = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      setLessonPublished(id, published),
    onSuccess: refresh,
    onError,
  });
  const removeLesson = useMutation({
    mutationFn: deleteLesson,
    onSuccess: () => {
      toast.success('ลบบทเรียนแล้ว');
      refresh();
    },
    onError,
  });
  const busy = reorder.isPending || publishLesson.isPending || removeLesson.isPending;

  return (
    <li>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {editing ? (
            <form
              className="flex flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (title.trim()) saveUnit.mutate({ title: title.trim() });
              }}
            >
              <label htmlFor={`unit-${unit.id}`} className="sr-only">
                ชื่อหน่วยการเรียนรู้
              </label>
              <input
                id={`unit-${unit.id}`}
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                autoFocus
              />
              <Button type="submit" size="sm" disabled={saveUnit.isPending}>
                บันทึก
              </Button>
            </form>
          ) : (
            <h2 className="flex items-center gap-2 font-semibold">
              <span className="text-xs text-muted-foreground">หน่วย {unit.position}</span>
              {unit.title}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`แก้ชื่อ ${unit.title}`}
                onClick={() => setEditing(true)}
              >
                <Pencil aria-hidden />
              </Button>
            </h2>
          )}
          <Button
            variant={unit.published ? 'default' : 'outline'}
            size="sm"
            aria-pressed={unit.published}
            onClick={() => saveUnit.mutate({ published: !unit.published })}
            disabled={saveUnit.isPending}
          >
            {unit.published ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
            {unit.published ? 'เผยแพร่หน่วยแล้ว' : 'หน่วยยังไม่เผยแพร่'}
          </Button>
        </div>

        {unit.lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีบทเรียนในหน่วยนี้</p>
        ) : (
          <ol className="divide-y rounded-lg border">
            {unit.lessons.map((lesson, index) => (
              <li key={lesson.id} className="flex flex-wrap items-center gap-2 p-3">
                <span className="w-6 text-center text-sm text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/teacher/courses/${courseId}/lessons/${lesson.id}`}
                    className="block truncate font-medium hover:text-primary"
                  >
                    {lesson.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {lesson.quest_stage
                      ? questStageLabels[lesson.quest_stage]
                      : 'ยังไม่กำหนดขั้น QUEST'}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    lesson.published ? 'bg-success/15' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {lesson.published ? 'เผยแพร่' : 'ฉบับร่าง'}
                </span>
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`เลื่อน ${lesson.title} ขึ้น`}
                    disabled={busy || index === 0}
                    onClick={() =>
                      reorder.mutate(moveItem(unit.lessons, index, -1).map((l) => l.id))
                    }
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`เลื่อน ${lesson.title} ลง`}
                    disabled={busy || index === unit.lessons.length - 1}
                    onClick={() =>
                      reorder.mutate(moveItem(unit.lessons, index, 1).map((l) => l.id))
                    }
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={
                      lesson.published ? `ยกเลิกเผยแพร่ ${lesson.title}` : `เผยแพร่ ${lesson.title}`
                    }
                    disabled={busy}
                    onClick={() =>
                      publishLesson.mutate({ id: lesson.id, published: !lesson.published })
                    }
                  >
                    {lesson.published ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`ลบ ${lesson.title}`}
                        disabled={busy}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    }
                    title="ลบบทเรียน?"
                    description={`“${lesson.title}” และสื่อทั้งหมดในบทเรียนจะถูกลบ ไม่สามารถย้อนกลับได้`}
                    confirmLabel="ลบบทเรียน"
                    destructive
                    onConfirm={() => removeLesson.mutate(lesson.id)}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => addLesson.mutate()}
          disabled={addLesson.isPending}
        >
          <Plus aria-hidden />
          เพิ่มบทเรียน
        </Button>
      </Card>
    </li>
  );
}
