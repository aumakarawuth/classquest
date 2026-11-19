import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/lib/theme/useTheme';

export function Toaster() {
  const { resolved } = useTheme();
  return <Sonner theme={resolved} position="top-center" richColors closeButton />;
}
