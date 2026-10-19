import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { errorMessage } from "./error-message.ts";

test("Pydantic traceback retains the numeric constraint instead of its footer URL", () => {
  const raw = `Traceback (most recent call last):
    File "<exec>", line 9, in gp_dispatch
      AnalysisRequest.model_validate(data)
pydantic_core._pydantic_core.ValidationError: 1 validation error for AnalysisRequest
columns.0.values.1
  Input should be a finite number [type=finite_number, input_value=inf, input_type=float]
    For further information visit https://errors.pydantic.dev/2.12/v/finite_number`;
  assert.equal(errorMessage(new Error(raw)), "columns.0.values.1; Input should be a finite number");
});

test("module-qualified domain errors retain their meaningful explanation", () => {
  assert.equal(errorMessage("Traceback (most recent call last):\n  File \"script\", line 3\ngp.statistics.AnalysisError: Paired columns need equal lengths."), "Paired columns need equal lengths.");
  assert.equal(errorMessage(new Error("FloatingPointError: overflow encountered in multiply")), "overflow encountered in multiply");
  assert.equal(errorMessage("gp.survival.SurvivalError: Logrank test is undefined because no events were observed in any group."), "Logrank test is undefined because no events were observed in any group.");
  assert.equal(errorMessage({ detail: "Value error, Values must have magnitude no greater than 1e100." }), "Values must have magnitude no greater than 1e100.");
});

test("structured validation errors show location and message without input/context echoes", () => {
  const message = errorMessage({ detail: [
    { loc: ["body", "columns", 0, "values", 1], msg: "Input should be a finite number", type: "finite_number", input: "secret data", ctx: { hidden: "private" } },
    { loc: ["body"], msg: "Value error, Values must have magnitude no greater than 1e100." },
  ] });
  assert.equal(message, "columns.0.values.1: Input should be a finite number; Values must have magnitude no greater than 1e100.");
  assert.doesNotMatch(message, /secret|private|finite_number/);
});

test("empty/malformed errors have a useful fallback and throwing accessors cannot crash", () => {
  const fallback = errorMessage(null);
  assert.match(fallback, /Check your data/);
  for (const value of [undefined, {}, 1, { detail: [null, "ignored", {}] }, "https://errors.pydantic.dev/2.12/v/value_error"])
    assert.equal(errorMessage(value), fallback);
  assert.equal(errorMessage({ get detail() { throw new Error("accessor"); } }), fallback);
});

test("hostile names remain text and React does not create HTML or event attributes", () => {
  const hostile = '<img src=x onerror="alert(1)">';
  const text = errorMessage({ detail: [{ loc: ["body", "groups", hostile], msg: "No observations" }] });
  assert.equal(text, `groups.${hostile}: No observations`);
  const html = renderToStaticMarkup(createElement("p", { role: "alert" }, text));
  assert.doesNotMatch(html, /<img|<script|<p[^>]*onerror=/);
  assert.match(html, /&lt;img/);
});
