import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Gift, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field-utils';
import {
  awardBadge,
  createCourseBadge,
  listBadges,
  listCourseAwards,
  listCourseStudents,
  setBadgeActive,
  type Badge,
} from '../badgeApi';
import { BadgeTile } from '../BadgeTile';
import {
  badgeIconNames,
  badgeIcons,
  ruleTypeLabels,
  ruleTypes,
  type BadgeIcon,
  type RuleType,
} from '../badges';

export default function CourseBadgesPage() {
  const { courseId = '' } = useParams();
  const query = useQuery({
    queryKey: ['badges', 'course', courseId],
    queryFn: async () => {
      const [badges, awards, students] = await Promise.all([
        listBadges([courseId]),
        listCourseAwards(courseId),
        listCourseStudents(courseId),
      ]);
      return { badges, awards, students };
    },
  });

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
        <h1 className="text-2xl font-bold tracking-tight">Badge</h1>
        <p className="text-sm text-muted-foreground">
          Badge อัตโนมัติจะมอบให้เมื่อนักเรียนทำตามเงื่อนไข ส่วน Badge ที่ครูมอบใช้ยกย่องพฤติกรรม เช่น การช่วยเหลือเพื่อน
        </p>
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {query.data.badges.map((b) => (
              <li key={b.id}>
                <BadgeTile
                  name={b.name}
                  description={b.description}
                  icon={b.icon}
                  rule={b.rule}
                  xpBonus={b.xp_bonus}
                  earnedAt="x"
                  headingLevel="h2"
                  footer={
                    <BadgeFooter
                      badge={b}
                      courseId={courseId}
                      earnedCount={query.data.awards.filter((a) => a.badge_id === b.id).length}
                      students={query.data.students}
                    />
                  }
                />
              </li>
            ))}
          </ul>
          <NewBadgeForm courseId={courseId} />
        </>
      )}
    </div>
  );
}

function BadgeFooter({
  badge,
  courseId,
  earnedCount,
  students,
}: {
  badge: Badge;
  courseId: string;
  earnedCount: number;
  students: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [reason, setReason] = useState('');
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['badges', 'course', courseId] });
  const award = useMutation({
    mutationFn: () => awardBadge(badge.id, studentId, courseId, reason),
    onSuccess: (granted) => {
      toast[granted ? 'success' : 'info'](granted ? 'มอบ Badge แล้ว' : 'นักเรียนคนนี้ได้รับ Badge นี้แล้ว');
      setOpen(false);
      setStudentId('');
      setReason('');
      refresh();
    },
    onError: () => toast.error('มอบ Badge ไม่สำเร็จ'),
  });
  const toggle = useMutation({
    mutationFn: () => setBadgeActive(badge.id, !badge.active),
    onSuccess: refresh,
    onError: () => toast.error('บันทึกไม่สำเร็จ'),
  });

  return (
    <div className="w-full space-y-2 pt-1">
      <p className="text-xs font-medium tabular-nums">
        ได้รับแล้ว {earnedCount} คน{badge.course_id ? '' : ' · Badge ระบบ'}
        {!badge.active && ' · ปิดใช้งาน'}
      </p>
      {badge.course_id && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
        >
          {badge.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
        </Button>
      )}
      {badge.active &&
        (open ? (
          <form
            className="space-y-2 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              if (studentId) award.mutate();
            }}
          >
            <label htmlFor={`award-${badge.id}`} className="block text-xs font-medium">
              นักเรียน
            </label>
            <select
              id={`award-${badge.id}`}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">เลือกนักเรียน</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label htmlFor={`reason-${badge.id}`} className="block text-xs font-medium">
              เหตุผล
            </label>
            <input
              id={`reason-${badge.id}`}
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!studentId || award.isPending}>
                มอบ
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Gift aria-hidden />
            มอบให้นักเรียน
          </Button>
        ))}
    </div>
  );
}

function NewBadgeForm({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<BadgeIcon>('award');
  const [xpBonus, setXpBonus] = useState(0);
  const [ruleType, setRuleType] = useState<RuleType | 'manual'>('manual');
  const [count, setCount] = useState(1);
  const create = useMutation({
    mutationFn: () =>
      createCourseBadge(courseId, {
        name: name.trim(),
        description: description.trim(),
        icon,
        xp_bonus: xpBonus,
        rule: ruleType === 'manual' ? null : { type: ruleType, count },
      }),
    onSuccess: () => {
      toast.success('สร้าง Badge แล้ว');
      setName('');
      setDescription('');
      void queryClient.invalidateQueries({ queryKey: ['badges'] });
    },
    onError: () => toast.error('สร้าง Badge ไม่สำเร็จ'),
  });

  return (
    <Card>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <h2 className="text-lg font-semibold sm:col-span-2">สร้าง Badge ของรายวิชา</h2>
        <div className="space-y-1.5">
          <label htmlFor="nb-name" className="block text-sm font-medium">
            ชื่อ Badge
          </label>
          <input
            id="nb-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="nb-xp" className="block text-sm font-medium">
            XP โบนัส
          </label>
          <input
            id="nb-xp"
            type="number"
            min={0}
            max={1000}
            value={xpBonus}
            onChange={(e) => setXpBonus(Number(e.target.value))}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="nb-desc" className="block text-sm font-medium">
            คำอธิบาย
          </label>
          <input
            id="nb-desc"
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="nb-rule" className="block text-sm font-medium">
            วิธีได้รับ
          </label>
          <select
            id="nb-rule"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as RuleType | 'manual')}
            className={inputClass}
          >
            {(['manual', ...ruleTypes] as const).map((t) => (
              <option key={t} value={t}>
                {ruleTypeLabels[t]}
              </option>
            ))}
          </select>
        </div>
        {ruleType !== 'manual' && ruleType !== 'boss_approved' && (
          <div className="space-y-1.5">
            <label htmlFor="nb-count" className="block text-sm font-medium">
              {ruleType === 'level_reached' ? 'เลเวล' : 'จำนวน'}
            </label>
            <input
              id="nb-count"
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
              className={inputClass}
            />
          </div>
        )}
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">ไอคอน</legend>
          <div className="flex flex-wrap gap-2">
            {badgeIconNames.map((n) => {
              const Icon = badgeIcons[n];
              return (
                <label key={n} className="cursor-pointer">
                  <input
                    type="radio"
                    name="nb-icon"
                    value={n}
                    checked={icon === n}
                    onChange={() => setIcon(n)}
                    className="peer sr-only"
                  />
                  <span className="inline-flex size-11 items-center justify-center rounded-lg border peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                    <Icon className="size-5" aria-hidden />
                    <span className="sr-only">{n}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            <Plus aria-hidden />
            สร้าง Badge
          </Button>
        </div>
      </form>
    </Card>
  );
}
