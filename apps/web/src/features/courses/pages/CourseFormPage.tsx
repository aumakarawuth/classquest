import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { fieldA11y, inputClass } from '@/components/ui/field-utils';
import { useAuth } from '@/features/auth/useAuth';
import { courseErrorMessage, createCourse } from '../api';
import {
  courseFormSchema,
  courseLevelLabels,
  currentAcademicTerm,
  type CourseFormInput,
  type CourseFormValues,
} from '../schemas';

export default function CourseFormPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = currentAcademicTerm();

  const form = useForm<CourseFormInput, unknown, CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      code: '',
      name: '',
      level: 'pvc',
      classroom: '',
      term: now.term,
      academicYear: now.academicYear,
      weeks: 18,
      description: '',
    },
  });
  const errors = form.formState.errors;

  const mutation = useMutation({
    mutationFn: (values: CourseFormValues) => createCourse(userId ?? '', values),
    onSuccess: (id) => {
      toast.success('สร้างรายวิชาแล้ว');
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
      void navigate(`/teacher/courses/${id}`);
    },
    onError: (error) => toast.error(courseErrorMessage(error)),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">สร้างรายวิชา</h1>
        <p className="text-sm text-muted-foreground">รายวิชาใหม่จะเป็นฉบับร่างจนกว่าคุณจะเผยแพร่</p>
      </div>
      <Card>
        <form
          noValidate
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field id="code" label="รหัสวิชา" error={errors.code?.message}>
            <input
              {...form.register('code')}
              {...fieldA11y('code', errors.code?.message)}
              className={inputClass}
              placeholder="31910-2012"
            />
          </Field>
          <Field id="level" label="ระดับชั้น">
            <select {...form.register('level')} id="level" className={inputClass}>
              {Object.entries(courseLevelLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="name" label="ชื่อรายวิชา" error={errors.name?.message} className="sm:col-span-2">
            <input
              {...form.register('name')}
              {...fieldA11y('name', errors.name?.message)}
              className={inputClass}
            />
          </Field>
          <Field
            id="classroom"
            label="ห้องเรียน"
            hint="เช่น ปวส.1/1 (ไม่บังคับ)"
            error={errors.classroom?.message}
          >
            <input
              {...form.register('classroom')}
              {...fieldA11y('classroom', errors.classroom?.message, 'เช่น ปวส.1/1 (ไม่บังคับ)')}
              className={inputClass}
            />
          </Field>
          <Field id="weeks" label="จำนวนสัปดาห์" error={errors.weeks?.message}>
            <input
              type="number"
              inputMode="numeric"
              {...form.register('weeks')}
              {...fieldA11y('weeks', errors.weeks?.message)}
              className={inputClass}
            />
          </Field>
          <Field id="term" label="ภาคเรียน" error={errors.term?.message}>
            <select {...form.register('term')} id="term" className={inputClass}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>ฤดูร้อน</option>
            </select>
          </Field>
          <Field id="academicYear" label="ปีการศึกษา (พ.ศ.)" error={errors.academicYear?.message}>
            <input
              type="number"
              inputMode="numeric"
              {...form.register('academicYear')}
              {...fieldA11y('academicYear', errors.academicYear?.message)}
              className={inputClass}
            />
          </Field>
          <Field
            id="description"
            label="คำอธิบายรายวิชา"
            error={errors.description?.message}
            className="sm:col-span-2"
          >
            <textarea
              {...form.register('description')}
              id="description"
              rows={4}
              className={`${inputClass} py-2`}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <Link to="/teacher/courses" className={buttonVariants({ variant: 'outline' })}>
              ยกเลิก
            </Link>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'กำลังบันทึก…' : 'สร้างรายวิชา'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
