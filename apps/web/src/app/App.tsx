import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { HomePage } from './HomePage';
import { NotFoundPage } from './NotFoundPage';

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '*', element: <NotFoundPage /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
