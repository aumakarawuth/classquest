import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { cellStatus, getMatrix, listCompetencies, type MatrixCell } from '../api';
import { buildTree, type TreeNode } from '../tree';
import { StatusPill } from './StatusPill';

function Node({
  node,
  cells,
  parentPassed,
}: {
  node: TreeNode;
  cells: MatrixCell[];
  parentPassed: boolean;
}) {
  const cell = cells.find((c) => c.competency_id === node.competency.id);
  const status = cellStatus(cell);
  return (
    <li className="relative pl-6 before:absolute before:top-0 before:left-2 before:h-full before:border-l before:border-border last:before:h-6">
      <span aria-hidden className="absolute top-6 left-2 w-4 border-t border-border" />
      <div
        className={cn(
          'mt-2 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3',
          status === 'passed' && 'border-success/50',
          !parentPassed && status === 'not_assessed' && 'opacity-80',
        )}
      >
        <span className="text-xs font-semibold text-muted-foreground">{node.competency.code}</span>
        <span className="min-w-0 flex-1 font-medium">{node.competency.name}</span>
        <StatusPill status={status} percent={cell?.score_percent} />
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <Node key={c.competency.id} node={c} cells={cells} parentPassed={status === 'passed'} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function SkillTree({ courseId, userId }: { courseId: string; userId: string }) {
  const q = useQuery({
    queryKey: ['skill-tree', courseId, userId],
    queryFn: async () => {
      const [competencies, cells] = await Promise.all([
        listCompetencies(courseId),
        getMatrix(courseId, userId),
      ]);
      return { tree: buildTree(competencies), cells };
    },
  });
  if (!q.data?.tree.length) return null;
  return (
    <nav aria-label="Skill Tree">
      <ul className="-ml-6">
        {q.data.tree.map((n) => (
          <Node key={n.competency.id} node={n} cells={q.data.cells} parentPassed />
        ))}
      </ul>
    </nav>
  );
}
