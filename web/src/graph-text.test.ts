import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProject, sample } from "./data.ts";
import { cssFont, formatText, resolveTextStyle, stepTextSize, textStyleProps, validTextStyles } from "./graph-text.ts";

test("text formatting stores only changes from GP's defaults", () => {
  const graph = sample("column").graph;
  const bigger = formatText(graph, "title", { size: 24, italic: true });
  assert.deepEqual(bigger.text_styles, { title: { size: 24, italic: true } });
  assert.deepEqual(resolveTextStyle(bigger, "title"), { font: "Arial", size: 24, bold: true, italic: true, color: "#000000" });
  assert.equal(cssFont(resolveTextStyle(bigger, "title")), "italic 700 24px Arial, Helvetica, sans-serif");
  const back = formatText(formatText(bigger, "title", { size: 18 }), "title", { italic: false });
  assert.equal(back.text_styles, undefined, "returning to the defaults removes the override");
  assert.equal(textStyleProps(back, "title"), undefined, "unformatted text keeps the stylesheet look");
  const ticks = formatText(graph, "y_ticks", { font: "Times New Roman", bold: false, color: "#d62728" });
  assert.deepEqual(textStyleProps(ticks, "y_ticks"), { font: '400 14px "Times New Roman", Times, serif', fill: "#d62728" });
});

test("larger and smaller text step through Prism's size list", () => {
  assert.equal(stepTextSize(14, 1), 16);
  assert.equal(stepTextSize(14, -1), 13);
  assert.equal(stepTextSize(15, 1), 16);
  assert.equal(stepTextSize(72, 1), 72);
  assert.equal(stepTextSize(6, -1), 6);
});

test("saved text styles are validated", () => {
  assert.equal(validTextStyles({ legend: { size: 12, bold: false } }), true);
  assert.equal(validTextStyles({ legend: { size: 15 } }), false, "sizes come from the list");
  assert.equal(validTextStyles({ caption: { size: 12 } }), false);
  assert.equal(validTextStyles({ title: { color: "red" } }), false);
  assert.equal(validTextStyles({ title: { font: "Comic Sans MS" } }), false);
  const project = sample("column");
  project.graph.text_styles = { x_ticks: { size: 10 } };
  assert.doesNotThrow(() => parseProject(JSON.stringify(project)));
  project.graph.text_styles = { x_ticks: { size: 10, underline: true } } as never;
  assert.throws(() => parseProject(JSON.stringify(project)), /Invalid project graph settings/);
});
