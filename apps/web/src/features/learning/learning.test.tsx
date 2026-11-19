import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import * as api from './api';
import CourseBuilderPage from './pages/CourseBuilderPage';
import LessonEditorPage from './pages/LessonEditorPage';

vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  getBuilder: vi.fn(),
  reorderLessons: vi.fn(),
  getLesson: vi.fn(),
  listCourseLessons: vi.fn(),
  addResource: vi.fn(),
  updateLesson: vi.fn(),
}));

function renderAt(path: string, routePath: string, element: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

it('builder reorders lessons with one atomic call', async () => {
  vi.mocked(api.getBuilder).mockResolvedValue([
    {
      id: 'u1',
      position: 1,
      week_no: 1,
      title: 'สัปดาห์ที่ 1',
      published: true,
      lessons: [
        { id: 'l1', title: 'IoT คืออะไร', position: 1, published: true, quest_stage: 'question' },
        { id: 'l2', title: 'Hello Arduino', position: 2, published: false, quest_stage: null },
      ],
    },
  ]);
  vi.mocked(api.reorderLessons).mockResolvedValue();
  const { container } = renderAt(
    '/teacher/courses/c1/builder',
    '/teacher/courses/:courseId/builder',
    <CourseBuilderPage />,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'เลื่อน Hello Arduino ขึ้น' }));
  expect(api.reorderLessons).toHaveBeenCalledWith('u1', ['l2', 'l1']);
  expect(screen.getByRole('button', { name: 'เลื่อน IoT คืออะไร ขึ้น' })).toBeDisabled();
  expect((await axe(container)).violations).toEqual([]);
});

it('lesson editor validates resource URLs before saving', async () => {
  vi.mocked(api.getLesson).mockResolvedValue({
    id: 'l1',
    course_id: 'c1',
    unit_id: 'u1',
    title: 'IoT คืออะไร',
    body_md: '## สวัสดี',
    quest_stage: 'question',
    prerequisite_lesson_id: null,
    estimated_minutes: 30,
    published: false,
    lesson_resources: [],
  });
  vi.mocked(api.listCourseLessons).mockResolvedValue([]);
  vi.mocked(api.addResource).mockResolvedValue();
  const { container } = renderAt(
    '/teacher/courses/c1/lessons/l1',
    '/teacher/courses/:courseId/lessons/:lessonId',
    <LessonEditorPage />,
  );

  const url = await screen.findByLabelText('ลิงก์');
  await userEvent.type(url, 'http://youtube.com/watch?v=x');
  await userEvent.click(screen.getByRole('button', { name: 'เพิ่มสื่อ' }));
  expect(await screen.findByText('ลิงก์ต้องขึ้นต้นด้วย https://')).toBeInTheDocument();
  expect(api.addResource).not.toHaveBeenCalled();

  await userEvent.clear(url);
  await userEvent.type(url, 'https://youtu.be/abc');
  await userEvent.click(screen.getByRole('button', { name: 'เพิ่มสื่อ' }));
  expect(api.addResource).toHaveBeenCalledWith(
    'l1',
    1,
    expect.objectContaining({ type: 'youtube', url: 'https://youtu.be/abc' }),
  );
  expect((await axe(container)).violations).toEqual([]);
});

it('lesson editor previews markdown and saves typed values', async () => {
  vi.mocked(api.getLesson).mockResolvedValue({
    id: 'l1',
    course_id: 'c1',
    unit_id: 'u1',
    title: 'IoT',
    body_md: '## หัวข้อ',
    quest_stage: null,
    prerequisite_lesson_id: null,
    estimated_minutes: null,
    published: false,
    lesson_resources: [],
  });
  vi.mocked(api.listCourseLessons).mockResolvedValue([]);
  vi.mocked(api.updateLesson).mockResolvedValue();
  renderAt(
    '/teacher/courses/c1/lessons/l1',
    '/teacher/courses/:courseId/lessons/:lessonId',
    <LessonEditorPage />,
  );

  await userEvent.click(await screen.findByRole('tab', { name: 'ดูตัวอย่าง' }));
  expect(screen.getByRole('heading', { name: 'หัวข้อ' })).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('ขั้นตอน QUEST'), 'experiment');
  await userEvent.type(screen.getByLabelText('เวลาโดยประมาณ (นาที)'), '45');
  await userEvent.click(screen.getByRole('button', { name: 'บันทึกบทเรียน' }));
  expect(api.updateLesson).toHaveBeenCalledWith(
    'l1',
    expect.objectContaining({
      quest_stage: 'experiment',
      estimated_minutes: 45,
      prerequisite_lesson_id: null,
    }),
  );
});
