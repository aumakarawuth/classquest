import type { Competency } from './api';
import { buildTree } from './tree';

const c = (id: string, parent: string | null, position = 1): Competency => ({
  id,
  course_id: 'c',
  parent_id: parent,
  code: id.toUpperCase(),
  name: id,
  description: '',
  pass_threshold: 60,
  position,
});

it('builds a sorted forest from parent ids', () => {
  const tree = buildTree([c('b', null, 2), c('a', null, 1), c('a2', 'a', 2), c('a1', 'a', 1)]);
  expect(tree.map((n) => n.competency.id)).toEqual(['a', 'b']);
  expect(tree[0]?.children.map((n) => n.competency.id)).toEqual(['a1', 'a2']);
});

it('treats orphans and cycles as roots instead of losing them', () => {
  const tree = buildTree([c('x', 'missing'), c('p', 'q'), c('q', 'p')]);
  const ids = (ns: ReturnType<typeof buildTree>): string[] =>
    ns.flatMap((n) => [n.competency.id, ...ids(n.children)]);
  expect(ids(tree).sort()).toEqual(['p', 'q', 'x']);
});
