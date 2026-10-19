import type { Workbook } from "./workbook.ts";

export type DependencyMode = "updates" | "structural";
export type DependencyInput = Readonly<{
  id: string;
  role?: string;
  expectedKind?: string;
}>;
export type DependencyNode = Readonly<{
  id: string;
  kind: string;
  inputs: readonly DependencyInput[];
  frozen?: boolean;
}>;
export type DependencyIssue = Readonly<{
  code:
    | "duplicate_id"
    | "missing_input"
    | "wrong_input_kind"
    | "cycle"
    | "source_mismatch"
    | "unknown_node";
  nodeIds: readonly string[];
  inputId?: string;
  role?: string;
  message: string;
}>;
export type DependencyBlock = {
  id: string;
  issues: readonly DependencyIssue[];
  blockedBy: string[];
};
export type DependencySchedule = {
  ready: string[];
  blocked: DependencyBlock[];
  frozen: string[];
};
type Model = {
  inputs: Map<string, string[]>;
  declaredInputs: Map<string, string[]>;
  consumers: Map<string, string[]>;
  issues: DependencyIssue[];
  directIssues: Map<string, DependencyIssue[]>;
  blocked: Set<string>;
  order: string[];
};

function issue(value: DependencyIssue): DependencyIssue {
  return Object.freeze({
    ...value,
    nodeIds: Object.freeze([...value.nodeIds]),
  });
}

/** Iterative Kosaraju: distinguish actual cycle members from their downstream
 * blockers without a recursion limit or treating every Kahn residual as a cycle.
 */
function cycleComponents(
  ids: string[],
  inputs: Map<string, string[]>,
  consumers: Map<string, string[]>,
) {
  const visited = new Set<string>(),
    finish: string[] = [],
    components: string[][] = [];
  for (const id of ids) {
    if (visited.has(id)) continue;
    visited.add(id);
    const stack = [{ id, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1],
        next = inputs.get(frame.id)!;
      if (frame.next === next.length) {
        finish.push(frame.id);
        stack.pop();
        continue;
      }
      const child = next[frame.next++];
      if (!visited.has(child)) {
        visited.add(child);
        stack.push({ id: child, next: 0 });
      }
    }
  }
  visited.clear();
  for (let i = finish.length - 1; i >= 0; i--) {
    const first = finish[i];
    if (visited.has(first)) continue;
    const component: string[] = [],
      stack = [first];
    visited.add(first);
    while (stack.length) {
      const id = stack.pop()!;
      component.push(id);
      for (const child of consumers.get(id)!)
        if (!visited.has(child)) {
          visited.add(child);
          stack.push(child);
        }
    }
    if (component.length > 1 || inputs.get(first)!.includes(first))
      components.push(component);
  }
  return components;
}

// Rank heap gives deterministic workbook-order tie breaking without repeatedly
// sorting a wide queue or spreading large arrays into function arguments.
class RankQueue {
  private values: number[] = [];
  push(value: number) {
    let i = this.values.length;
    this.values.push(value);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.values[parent] <= value) break;
      this.values[i] = this.values[parent];
      i = parent;
    }
    this.values[i] = value;
  }
  pop(): number | undefined {
    if (!this.values.length) return undefined;
    const first = this.values[0],
      last = this.values.pop()!;
    if (!this.values.length) return first;
    let i = 0;
    while (i * 2 + 1 < this.values.length) {
      let child = i * 2 + 1;
      if (
        child + 1 < this.values.length &&
        this.values[child + 1] < this.values[child]
      )
        child++;
      if (this.values[child] >= last) break;
      this.values[i] = this.values[child];
      i = child;
    }
    this.values[i] = last;
    return first;
  }
}

/** Generic graph infrastructure; it does not implement additional sheet kinds
 * or chained analysis execution. Input records are copied and frozen, so later
 * caller mutation cannot change an existing graph's answers.
 */
export class WorkbookDependencyGraph {
  private nodes = new Map<string, DependencyNode>();
  private ids: string[] = [];
  private ranks = new Map<string, number>();
  private structural: Model;
  private updates: Model;

  constructor(
    nodes: readonly DependencyNode[],
    extraIssues: readonly DependencyIssue[] = [],
  ) {
    const counts = new Map<string, number>();
    for (const node of nodes) {
      counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
      if (this.nodes.has(node.id)) continue;
      this.ranks.set(node.id, this.ids.length);
      this.ids.push(node.id);
      this.nodes.set(
        node.id,
        Object.freeze({
          ...node,
          inputs: Object.freeze(
            node.inputs.map((input) => Object.freeze({ ...input })),
          ),
        }),
      );
    }
    const duplicates: DependencyIssue[] = [];
    for (const [id, count] of counts)
      if (count > 1)
        duplicates.push(
          issue({
            code: "duplicate_id",
            nodeIds: [id],
            message: `Duplicate sheet ID “${id}” (${count} entries).`,
          }),
        );
    const base = duplicates.concat(extraIssues.map(issue));
    this.structural = this.buildModel("structural", base);
    this.updates = this.ids.some((id) => this.nodes.get(id)!.frozen)
      ? this.buildModel("updates", base)
      : this.structural;
  }

  private buildModel(mode: DependencyMode, base: DependencyIssue[]): Model {
    const inputs = new Map<string, string[]>(),
      declaredInputs = new Map<string, string[]>(),
      consumers = new Map<string, string[]>();
    const issues = base.filter(
      (problem) =>
        mode === "structural" ||
        problem.code === "duplicate_id" ||
        problem.nodeIds.some((id) => !this.nodes.get(id)?.frozen),
    );
    const directIssues = new Map<string, DependencyIssue[]>();
    for (const id of this.ids) {
      inputs.set(id, []);
      declaredInputs.set(id, []);
      consumers.set(id, []);
      directIssues.set(id, []);
    }
    for (const node of this.nodes.values()) {
      if (mode === "updates" && node.frozen) continue;
      const seen = new Set<string>();
      for (const input of node.inputs) {
        if (!seen.has(input.id)) {
          declaredInputs.get(node.id)!.push(input.id);
          const children = consumers.get(input.id) ?? [];
          children.push(node.id);
          consumers.set(input.id, children);
        }
        const source = this.nodes.get(input.id);
        if (!source)
          issues.push(
            issue({
              code: "missing_input",
              nodeIds: [node.id],
              inputId: input.id,
              role: input.role,
              message: `Sheet “${node.id}” needs missing input “${input.id}”.`,
            }),
          );
        else {
          if (input.expectedKind && input.expectedKind !== source.kind)
            issues.push(
              issue({
                code: "wrong_input_kind",
                nodeIds: [node.id],
                inputId: input.id,
                role: input.role,
                message: `Sheet “${node.id}” expects ${input.expectedKind} input “${input.id}”, but found ${source.kind}.`,
              }),
            );
          if (!seen.has(input.id)) {
            inputs.get(node.id)!.push(input.id);
          }
        }
        seen.add(input.id);
      }
    }
    for (const members of cycleComponents(this.ids, inputs, consumers)) {
      members.sort((a, b) => this.ranks.get(a)! - this.ranks.get(b)!);
      issues.push(
        issue({
          code: "cycle",
          nodeIds: members,
          message: `Circular dependency among: ${members.join(", ")}.`,
        }),
      );
    }
    const blocked = new Set<string>(),
      queue: string[] = [];
    for (const problem of issues)
      for (const id of problem.nodeIds) {
        directIssues.get(id)?.push(problem);
        if (this.nodes.has(id) && !blocked.has(id)) {
          blocked.add(id);
          queue.push(id);
        }
      }
    for (let i = 0; i < queue.length; i++)
      for (const child of consumers.get(queue[i])!) {
        if (!blocked.has(child)) {
          blocked.add(child);
          queue.push(child);
        }
      }
    const degrees = new Map<string, number>(),
      ready = new RankQueue(),
      order: string[] = [];
    for (const id of this.ids)
      if (!blocked.has(id)) {
        degrees.set(id, inputs.get(id)!.length);
        if (!inputs.get(id)!.length) ready.push(this.ranks.get(id)!);
      }
    for (let rank = ready.pop(); rank !== undefined; rank = ready.pop()) {
      const id = this.ids[rank];
      order.push(id);
      for (const child of consumers.get(id)!)
        if (!blocked.has(child)) {
          const degree = degrees.get(child)! - 1;
          degrees.set(child, degree);
          if (!degree) ready.push(this.ranks.get(child)!);
        }
    }
    return {
      inputs,
      declaredInputs,
      consumers,
      issues,
      directIssues,
      blocked,
      order,
    };
  }

  private model(mode: DependencyMode) {
    return mode === "structural" ? this.structural : this.updates;
  }
  node(id: string): DependencyNode | undefined {
    return this.nodes.get(id);
  }
  issues(mode: DependencyMode = "structural"): readonly DependencyIssue[] {
    return [...this.model(mode).issues];
  }
  order(mode: DependencyMode = "updates"): string[] {
    return [...this.model(mode).order];
  }

  /** Direct inputs by default; transitive mode is iterative and excludes self. */
  dependencies(
    id: string,
    options: { mode?: DependencyMode; transitive?: boolean } = {},
  ): string[] {
    const model = this.model(options.mode ?? "updates");
    if (!options.transitive) return [...(model.declaredInputs.get(id) ?? [])];
    return this.walk([id], model.declaredInputs, false, true);
  }

  /** Changes stop before a frozen consumer in update mode. Structural mode is
   * useful for deletion impact and retains those links.
   */
  affected(
    ids: Iterable<string>,
    options: { mode?: DependencyMode; includeSelf?: boolean } = {},
  ): string[] {
    return this.walk(
      ids,
      this.model(options.mode ?? "updates").consumers,
      options.includeSelf ?? false,
    );
  }

  /** Undirected structural family, always including frozen links and siblings. */
  family(id: string): string[] {
    const seen = new Set<string>(),
      queue =
        this.nodes.has(id) || this.structural.consumers.has(id) ? [id] : [];
    if (queue.length) seen.add(id);
    for (let i = 0; i < queue.length; i++) {
      for (const adjacent of [
        this.structural.declaredInputs.get(queue[i]) ?? [],
        this.structural.consumers.get(queue[i]) ?? [],
      ]) {
        for (const next of adjacent)
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
      }
    }
    return this.ids.filter((key) => seen.has(key));
  }

  private walk(
    seeds: Iterable<string>,
    links: Map<string, string[]>,
    includeSelf: boolean,
    includeMissing = false,
  ): string[] {
    const seedSet = new Set(seeds),
      seen = new Set<string>(),
      queue: string[] = [];
    for (const id of seedSet)
      if (this.nodes.has(id) || links.has(id)) {
        seen.add(id);
        queue.push(id);
      }
    for (let i = 0; i < queue.length; i++)
      for (const next of links.get(queue[i]) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    const result = this.ids.filter(
      (id) => seen.has(id) && (includeSelf || !seedSet.has(id)),
    );
    if (includeMissing)
      for (const id of seen)
        if (!this.nodes.has(id) && (includeSelf || !seedSet.has(id)))
          result.push(id);
    return result;
  }

  block(id: string, mode: DependencyMode = "updates"): DependencyBlock | null {
    if (!this.nodes.has(id))
      return {
        id,
        blockedBy: [],
        issues: [
          issue({
            code: "unknown_node",
            nodeIds: [id],
            message: `Unknown sheet “${id}”.`,
          }),
        ],
      };
    const model = this.model(mode);
    if (!model.blocked.has(id)) return null;
    return {
      id,
      issues: [...model.directIssues.get(id)!],
      blockedBy: model.inputs
        .get(id)!
        .filter((input) => model.blocked.has(input)),
    };
  }

  /** Explain root causes only when requested; schedules retain immediate
   * blockers instead of materializing O(nodes × ancestors) diagnostic copies.
   */
  causes(
    id: string,
    mode: DependencyMode = "updates",
  ): readonly DependencyIssue[] {
    const block = this.block(id, mode);
    if (!block) return [];
    if (!this.nodes.has(id)) return block.issues;
    const ancestors = this.walk([id], this.model(mode).inputs, true),
      found = new Set<DependencyIssue>();
    for (const key of ancestors)
      for (const problem of this.model(mode).directIssues.get(key)!)
        found.add(problem);
    return [...found];
  }

  /** A deterministic eligible ordering, not a promise that upstream work has
   * completed. Execution owners must await earlier pending prerequisites before
   * dispatching later chained work. Current workbook results consume data only.
   */
  schedule(candidates: Iterable<string> = this.ids): DependencySchedule {
    const requested = new Set(candidates),
      blocked: DependencyBlock[] = [],
      frozen: string[] = [];
    for (const id of this.ids)
      if (requested.has(id)) {
        const problem = this.block(id);
        if (problem) blocked.push(problem);
        else if (this.nodes.get(id)!.frozen) frozen.push(id);
      }
    for (const id of requested)
      if (!this.nodes.has(id)) blocked.push(this.block(id)!);
    return {
      ready: this.updates.order.filter(
        (id) => requested.has(id) && !this.nodes.get(id)!.frozen,
      ),
      blocked,
      frozen,
    };
  }
}

export function buildDependencyGraph(
  nodes: readonly DependencyNode[],
): WorkbookDependencyGraph {
  return new WorkbookDependencyGraph(nodes);
}

/** Adapter for the sheet kinds GP actually implements today. Captured frozen
 * source/result payloads are values, not additional live sheet dependencies.
 */
export function workbookDependencies(
  book: Pick<Workbook, "sheets">,
): WorkbookDependencyGraph {
  const sheets = new Map(book.sheets.map((sheet) => [sheet.id, sheet]));
  const issues: DependencyIssue[] = [];
  const nodes = book.sheets.map((sheet): DependencyNode => {
    const inputs: DependencyInput[] = [];
    if (sheet.kind !== "data")
      inputs.push({
        id: sheet.dataId,
        role: "source_data",
        expectedKind: "data",
      });
    if (
      sheet.kind === "graph" &&
      sheet.resultId !== null &&
      !(
        sheet.frozen &&
        sheet.frozenResult?.id === sheet.resultId &&
        !sheets.has(sheet.resultId)
      )
    ) {
      inputs.push({
        id: sheet.resultId,
        role: "linked_result",
        expectedKind: "results",
      });
      const result = sheets.get(sheet.resultId);
      if (result?.kind === "results" && result.dataId !== sheet.dataId)
        issues.push({
          code: "source_mismatch",
          nodeIds: [sheet.id],
          inputId: result.id,
          role: "linked_result",
          message: `Graph “${sheet.id}” and linked result “${result.id}” use different source tables.`,
        });
    }
    return {
      id: sheet.id,
      kind: sheet.kind,
      inputs,
      frozen: "frozen" in sheet && sheet.frozen === true,
    };
  });
  return new WorkbookDependencyGraph(nodes, issues);
}

/** Complements existing schema/numeric/snapshot validation at parse boundaries. */
export function assertWorkbookDependencyIntegrity(
  book: Pick<Workbook, "sheets">,
): void {
  const issues = workbookDependencies(book).issues("structural");
  if (issues.length)
    throw new Error(issues.map((problem) => problem.message).join(" "));
}
