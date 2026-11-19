import { validateLab } from './api';

it('validates Wokwi labs', () => {
  expect(
    validateLab({
      title: 'LED',
      project_url: 'https://wokwi.com/projects/322062421191557714',
      diagram_url: null,
    }),
  ).toBeNull();
  expect(
    validateLab({ title: 'LED', project_url: 'https://wokwi.com/', diagram_url: null }),
  ).toContain('Wokwi');
  expect(
    validateLab({ title: '', project_url: 'https://wokwi.com/projects/1', diagram_url: null }),
  ).toBe('กรุณากรอกชื่อการทดลอง');
  expect(
    validateLab({
      title: 'x',
      project_url: 'https://wokwi.com/projects/1',
      diagram_url: 'http://x',
    }),
  ).toContain('https');
});
