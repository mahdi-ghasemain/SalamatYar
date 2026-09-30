import { test } from "node:test";
import assert from "node:assert/strict";
import {
  digits,
  localDay,
  toggleDose,
  validDate,
  validTime,
} from "../src/core/model.ts";
test("Iranian and Arabic digit input is accepted", () => {
  assert.equal(digits("۰۸:۳۰"), "08:30");
  assert.equal(digits("١٢"), "12");
  assert.ok(validTime("۲۳:۵۹"));
  assert.equal(validTime("24:00"), false);
});
test("invalid calendar dates do not silently roll forward", () => {
  assert.ok(validDate("2028-02-29"));
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(validDate("2026-04-31"), false);
  assert.equal(validDate("nonsense"), false);
});
test("dose tracking preserves inventory, undo, and history across dates", () => {
  const m = {
    id: "1",
    memberId: "self",
    name: "Sample",
    dose: "Recorded",
    time: "08:00",
    stock: 2,
    history: [],
  };
  const first = toggleDose(m, "2026-09-28");
  assert.equal(first.stock, 1);
  assert.deepEqual(toggleDose(first, "2026-09-28"), m);
  const second = toggleDose(first, "2026-09-29");
  assert.equal(second.stock, 0);
  assert.equal(second.history.length, 2);
  assert.deepEqual(toggleDose(second, "2026-09-30"), second);
  assert.equal(m.stock, 2);
});
test("day keys use local calendar components", () => {
  assert.equal(localDay(new Date(2026, 8, 28, 23, 59)), "2026-09-28");
});
