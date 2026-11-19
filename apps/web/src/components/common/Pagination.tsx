import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="เลือกหน้า" className="flex items-center justify-between gap-2 text-sm">
      <Button
        variant="outline"
        size="sm"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft aria-hidden />
        ก่อนหน้า
      </Button>
      <span className="text-muted-foreground tabular-nums">
        หน้า {page + 1} / {pages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page + 1 >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        ถัดไป
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
