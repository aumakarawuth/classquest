import { inputClass } from '@/components/ui/field-utils';
import { type Course } from '@/features/courses/api';

export function CoursePicker({
  courses,
  value,
  onChange,
}: {
  courses: Course[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor="pick-course" className="block text-sm font-medium">
        รายวิชา
      </label>
      <select
        id="pick-course"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} sm:w-96`}
      >
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} {c.name} ({c.term}/{c.academicYear})
          </option>
        ))}
      </select>
    </div>
  );
}
