import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme/useTheme';
import type { ThemePreference } from '@/lib/theme/theme';
import { cn } from '@/lib/utils';

const options: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'โหมดสว่าง', Icon: Sun },
  { value: 'dark', label: 'โหมดมืด', Icon: Moon },
  { value: 'system', label: 'ตามระบบ', Icon: Monitor },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="ธีมการแสดงผล"
      className="inline-flex rounded-lg border bg-card p-1"
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          aria-label={label}
          title={label}
          onClick={() => setPreference(value)}
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground',
            preference === value &&
              'bg-primary text-primary-foreground hover:text-primary-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
