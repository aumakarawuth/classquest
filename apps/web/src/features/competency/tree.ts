import type { Competency } from './api';

export interface TreeNode {
  competency: Competency;
  children: TreeNode[];
}

/** Builds a forest from parent_id; orphans (missing parent) become roots; cycles are cut. */
export function buildTree(items: Competency[]): TreeNode[] {
  const byId = new Map(items.map((c) => [c.id, { competency: c, children: [] as TreeNode[] }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.competency.parent_id ? byId.get(node.competency.parent_id) : undefined;
    let cyclic = false;
    for (let p = parent, guard = 0; p && guard < items.length; guard++) {
      if (p === node) cyclic = true;
      p = p.competency.parent_id ? byId.get(p.competency.parent_id) : undefined;
    }
    if (parent && !cyclic) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (ns: TreeNode[]) => {
    ns.sort(
      (a, b) =>
        a.competency.position - b.competency.position ||
        a.competency.code.localeCompare(b.competency.code),
    );
    ns.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}
