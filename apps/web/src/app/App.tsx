import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from '@/components/common/Toaster';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
