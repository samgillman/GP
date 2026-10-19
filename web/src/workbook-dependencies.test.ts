import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDependencyGraph,
  workbookDependencies,
  assertWorkbookDependencyIntegrity,
} from "./workbook-dependencies.ts";
import type { DependencyNode } from "./workbook-dependencies.ts";
import { addData, fromProject, recordResult } from "./workbook.ts";
import type { Workbook } from "./workbook.ts";
import { deleteSheet } from "./workbook-actions.ts";
import { sample } from "./data.ts";

const node = (
  id: string,
  inputs: string[] = [],
  frozen = false,
): DependencyNode => ({
  id,
  kind: "test-node",
  inputs: inputs.map((id) => ({ id })),
  frozen,
});

test("fan-out and diamond dependencies get deterministic prerequisite-first ordering", () => {
  const graph = buildDependencyGraph([
    node("d", ["b", "c"]),
    node("c", ["a"]),
    node("b", ["a"]),
    node("a"),
    node("other"),
  ]);
  assert.deepEqual(graph.order(), ["a", "c", "b", "d", "other"]);
  assert.deepEqual(graph.schedule(["d", "b", "c"]).ready, ["c", "b", "d"]);
  assert.deepEqual(graph.dependencies("d"), ["b", "c"]);
  assert.deepEqual(graph.dependencies("d", { transitive: true }), [
    "c",
    "b",
    "a",
  ]);
  assert.deepEqual(graph.affected(["a"]), ["d", "c", "b"]);
  assert.deepEqual(graph.affected(["b"]), ["d"]);
  assert.deepEqual(graph.family("c"), ["d", "c", "b", "a"]);
  assert.deepEqual(graph.family("other"), ["other"]);
  assert.deepEqual(graph.issues(), []);
});

test("missing input blocks its family without stopping independent jobs", () => {
  const graph = buildDependencyGraph([
    node("orphan", ["deleted"]),
    node("child", ["orphan"]),
    node("sibling", ["deleted"]),
    node("ok"),
    node("ok-child", ["ok"]),
  ]);
  const scheduled = graph.schedule();
  assert.deepEqual(scheduled.ready, ["ok", "ok-child"]);
  assert.deepEqual(
    scheduled.blocked.map((entry) => entry.id),
    ["orphan", "child", "sibling"],
  );
  assert.equal(graph.block("orphan")!.issues[0].code, "missing_input");
  assert.deepEqual(graph.block("child")!.issues, []);
  assert.deepEqual(graph.block("child")!.blockedBy, ["orphan"]);
  assert.equal(graph.causes("child")[0].inputId, "deleted");
  assert.deepEqual(graph.dependencies("orphan"), ["deleted"]);
  assert.deepEqual(graph.dependencies("child", { transitive: true }), [
    "orphan",
    "deleted",
  ]);
  assert.deepEqual(graph.affected(["deleted"], { mode: "structural" }), [
    "orphan",
    "child",
    "sibling",
  ]);
  assert.deepEqual(graph.family("child"), ["orphan", "child", "sibling"]);
});

test("SCC diagnostics separate cycle members, downstream blockers and independent nodes", () => {
  const graph = buildDependencyGraph([
    node("a", ["b"]),
    node("b", ["a"]),
    node("downstream", ["a"]),
    node("leaf", ["downstream"]),
    node("independent"),
    node("independent-child", ["independent"]),
  ]);
  assert.deepEqual(
    graph
      .issues()
      .filter((entry) => entry.code === "cycle")
      .map((entry) => entry.nodeIds),
    [["a", "b"]],
  );
  assert.deepEqual(graph.block("downstream")!.issues, []);
  assert.deepEqual(graph.block("leaf")!.blockedBy, ["downstream"]);
  assert.equal(graph.causes("leaf").length, 1);
  assert.deepEqual(graph.causes("leaf")[0].nodeIds, ["a", "b"]);
  assert.deepEqual(graph.schedule().ready, [
    "independent",
    "independent-child",
  ]);
});

test("self loops and disjoint cycles are diagnosed independently", () => {
  const graph = buildDependencyGraph([
    node("self", ["self"]),
    node("a", ["b"]),
    node("b", ["a"]),
    node("safe"),
  ]);
  const cycles = graph.issues().filter((entry) => entry.code === "cycle");
  assert.equal(cycles.length, 2);
  assert.ok(
    cycles.some(
      (entry) => entry.nodeIds.length === 1 && entry.nodeIds[0] === "self",
    ),
  );
  assert.deepEqual(graph.schedule().ready, ["safe"]);
});

test("frozen snapshot is an update barrier but remains in structural family/deletion links", () => {
  const graph = buildDependencyGraph([
    node("data"),
    node("frozen", ["data"], true),
    node("view", ["frozen"]),
    node("live", ["data"]),
  ]);
  assert.deepEqual(graph.dependencies("frozen"), []);
  assert.deepEqual(graph.dependencies("frozen", { mode: "structural" }), [
    "data",
  ]);
  assert.deepEqual(graph.affected(["data"]), ["live"]);
  assert.deepEqual(graph.affected(["data"], { mode: "structural" }), [
    "frozen",
    "view",
    "live",
  ]);
  assert.deepEqual(graph.family("view"), ["data", "frozen", "view", "live"]);
  assert.deepEqual(graph.schedule(["frozen", "view", "live"]), {
    ready: ["view", "live"],
    blocked: [],
    frozen: ["frozen"],
  });
  assert.deepEqual(
    graph.affected(["frozen"]),
    ["view"],
    "an explicitly changed snapshot can invalidate its own consumers",
  );
});

test("missing upstream data does not block consumers of a frozen value; structural damage is still diagnosed", () => {
  const graph = buildDependencyGraph([
    node("frozen", ["missing"], true),
    node("consumer", ["frozen"]),
  ]);
  assert.deepEqual(graph.issues("updates"), []);
  assert.equal(graph.issues("structural")[0].code, "missing_input");
  assert.equal(graph.block("consumer", "updates"), null);
  assert.deepEqual(graph.block("consumer", "structural")!.blockedBy, [
    "frozen",
  ]);
  assert.deepEqual(graph.schedule().ready, ["consumer"]);
});

test("frozen barrier can break an update cycle while structural integrity still reports it", () => {
  const graph = buildDependencyGraph([
    node("a", ["b"], true),
    node("b", ["a"]),
  ]);
  assert.equal(graph.issues("structural")[0].code, "cycle");
  assert.deepEqual(graph.issues("updates"), []);
  assert.deepEqual(graph.order(), ["a", "b"]);
  assert.deepEqual(graph.schedule(), {
    ready: ["b"],
    blocked: [],
    frozen: ["a"],
  });
});

test("duplicate IDs block ambiguous nodes and their consumers, including frozen duplicate nodes", () => {
  const graph = buildDependencyGraph([
    node("same", [], true),
    node("same"),
    node("child", ["same"]),
    node("independent"),
  ]);
  assert.equal(graph.block("same")!.issues[0].code, "duplicate_id");
  assert.deepEqual(graph.block("child")!.blockedBy, ["same"]);
  assert.deepEqual(graph.schedule().ready, ["independent"]);
});

test("typed inputs reject the wrong sheet kind and propagate that blocker", () => {
  const graph = buildDependencyGraph([
    { id: "graph", kind: "graph", inputs: [] },
    {
      id: "result",
      kind: "results",
      inputs: [{ id: "graph", expectedKind: "data", role: "source_data" }],
    },
    node("child", ["result"]),
  ]);
  assert.equal(graph.block("result")!.issues[0].code, "wrong_input_kind");
  assert.equal(graph.block("result")!.issues[0].role, "source_data");
  assert.equal(graph.causes("child")[0].inputId, "graph");
});

test("duplicate inputs do not inflate indegrees; unknown candidates are visible blockers", () => {
  const graph = buildDependencyGraph([node("a"), node("b", ["a", "a"])]);
  assert.deepEqual(graph.order(), ["a", "b"]);
  assert.deepEqual(graph.dependencies("b"), ["a"]);
  const schedule = graph.schedule(["b", "b", "missing"]);
  assert.deepEqual(schedule.ready, ["b"]);
  assert.equal(schedule.blocked[0].issues[0].code, "unknown_node");
  assert.deepEqual(graph.family("missing"), []);
});

function linkedBook(): Workbook {
  let book = fromProject(sample("column"));
  book = recordResult(book, {
    name: "Summary",
    dataId: book.activeSheetId,
    analysis: "descriptive",
    columnIndices: [0],
    sourceRevision: 0,
    result: {
      analysis: "descriptive",
      summary: [],
      results: [],
      fit: [],
      warnings: [],
    },
  });
  const resultId = book.activeSheetId;
  return {
    ...book,
    sheets: book.sheets.map((sheet) =>
      sheet.kind === "graph" ? { ...sheet, resultId } : sheet,
    ),
  };
}

test("workbook adapter includes graph data and linked-result inputs, with results ordered first", () => {
  const book = linkedBook(),
    graph = workbookDependencies(book);
  const dataId = book.sheets[0].id,
    graphId = book.sheets[1].id,
    resultId = book.sheets[2].id;
  assert.deepEqual(graph.order(), [dataId, resultId, graphId]);
  assert.deepEqual(graph.dependencies(graphId), [dataId, resultId]);
  assert.deepEqual(
    graph.node(graphId)!.inputs.map((input) => input.role),
    ["source_data", "linked_result"],
  );
  assert.doesNotThrow(() => assertWorkbookDependencyIntegrity(book));
});

test("deleting a source removes its structural family; deleting result detaches its graph link", () => {
  let book = linkedBook();
  const dataId = book.sheets[0].id,
    graphId = book.sheets[1].id,
    resultId = book.sheets[2].id;
  book = addData(book, sample("xy"));
  const dependencies = workbookDependencies(book);
  assert.deepEqual(
    dependencies.affected([dataId], { mode: "structural", includeSelf: true }),
    [dataId, graphId, resultId],
  );
  const removed = deleteSheet(book, dataId);
  assert.equal(removed.sheets.length, 2);
  assert.doesNotThrow(() => assertWorkbookDependencyIntegrity(removed));
  const detached = deleteSheet(book, resultId),
    graph = workbookDependencies(detached);
  assert.deepEqual(graph.dependencies(graphId), [dataId]);
  assert.doesNotThrow(() => assertWorkbookDependencyIntegrity(detached));
});

test("integrity rejects a graph linked to a different data family without suppressing unrelated jobs", () => {
  let book = linkedBook();
  const resultId = book.sheets[2].id;
  book = addData(book, sample("xy"));
  const otherGraphId = book.sheets[4].id;
  book = {
    ...book,
    sheets: book.sheets.map((sheet) =>
      sheet.id === otherGraphId && sheet.kind === "graph"
        ? { ...sheet, resultId }
        : sheet,
    ),
  };
  const graph = workbookDependencies(book);
  assert.equal(graph.block(otherGraphId)!.issues[0].code, "source_mismatch");
  assert.ok(graph.schedule([resultId, otherGraphId]).ready.includes(resultId));
  assert.throws(
    () => assertWorkbookDependencyIntegrity(book),
    /different source tables/,
  );
  const frozen = workbookDependencies({
    ...book,
    sheets: book.sheets.map((sheet) =>
      sheet.id === otherGraphId ? { ...sheet, frozen: true } : sheet,
    ),
  });
  assert.equal(
    frozen.block(otherGraphId, "updates"),
    null,
    "frozen captured values do not consume the damaged live link",
  );
  assert.equal(
    frozen.block(otherGraphId, "structural")!.issues[0].code,
    "source_mismatch",
  );
});

test("input mutation and mutation of returned collections cannot alter graph answers", () => {
  const inputs = [{ id: "a" }],
    mutable = [
      { id: "a", kind: "data", inputs: [] },
      { id: "b", kind: "results", inputs },
    ];
  const graph = buildDependencyGraph(mutable);
  inputs[0].id = "missing";
  mutable[0].id = "changed";
  graph.order().reverse();
  graph.dependencies("b").push("missing");
  assert.throws(() => {
    (graph.node("b")!.inputs[0] as { id: string }).id = "changed";
  }, TypeError);
  assert.deepEqual(graph.order(), ["a", "b"]);
  assert.deepEqual(graph.dependencies("b"), ["a"]);
});

test("large linear chain traversals and downstream blocking do not recurse or duplicate diagnostics", () => {
  const count = 30000;
  const nodes = Array.from({ length: count }, (_, i) =>
    node(`n${i}`, i ? [`n${i - 1}`] : ["missing"]),
  );
  nodes.push(node("independent"));
  const graph = buildDependencyGraph(nodes);
  assert.deepEqual(graph.order(), ["independent"]);
  const schedule = graph.schedule();
  assert.equal(schedule.blocked.length, count);
  assert.equal(schedule.blocked[count - 1].issues.length, 0);
  assert.deepEqual(schedule.blocked[count - 1].blockedBy, [`n${count - 2}`]);
  assert.equal(graph.causes(`n${count - 1}`).length, 1);
  assert.equal(
    graph.dependencies(`n${count - 1}`, { transitive: true }).length,
    count,
  );
});

test("wide fan-out exceeding argument-spread limits remains deterministic", () => {
  const count = 130000,
    nodes: DependencyNode[] = [node("source")];
  for (let i = 0; i < count; i++) nodes.push(node(`leaf${i}`, ["source"]));
  const graph = buildDependencyGraph(nodes),
    order = graph.order();
  assert.equal(order.length, count + 1);
  assert.equal(order[0], "source");
  assert.equal(order[count], `leaf${count - 1}`);
  assert.equal(graph.affected(["source"]).length, count);
  assert.equal(graph.family("leaf0").length, count + 1);
});
