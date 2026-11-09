import test from "node:test";
import assert from "node:assert/strict";
import { resolveReportingPeriod, isWithinReportingPeriod } from "../assets/js/reporting-periods.mjs";

const now = new Date(2026, 10, 9, 12, 30);

test("monthly and previous-month windows use local calendar boundaries", () => {
  const current = resolveReportingPeriod("month", now);
  assert.equal(current.from, "2026-11-01");
  assert.equal(current.to, "2026-11-09");
  const previous = resolveReportingPeriod("previous_month", now);
  assert.equal(previous.from, "2026-10-01");
  assert.equal(previous.to, "2026-10-31");
});

test("rolling windows include exactly the requested number of calendar days", () => {
  assert.equal(resolveReportingPeriod("last_30", now).from, "2026-10-11");
  assert.equal(resolveReportingPeriod("last_90", now).from, "2026-08-12");
  assert.equal(resolveReportingPeriod("last_180", now).from, "2026-05-14");
});

test("year-to-date and all-history windows are deterministic", () => {
  const year = resolveReportingPeriod("year", now);
  assert.equal(year.from, "2026-01-01");
  assert.equal(year.to, "2026-11-09");
  const all = resolveReportingPeriod("all", now);
  assert.equal(all.valid, true);
  assert.equal(all.start, null);
  assert.equal(isWithinReportingPeriod("2019-01-01", all), true);
});

test("custom windows validate calendar dates and order", () => {
  const valid = resolveReportingPeriod("custom", now, "2026-10-10", "2026-10-20");
  assert.equal(valid.valid, true);
  assert.equal(isWithinReportingPeriod("2026-10-10", valid), true);
  assert.equal(isWithinReportingPeriod("2026-10-20T23:59:59.999", valid), true);
  assert.equal(isWithinReportingPeriod("2026-10-21", valid), false);
  assert.equal(resolveReportingPeriod("custom", now, "2026-10-21", "2026-10-20").valid, false);
  assert.equal(resolveReportingPeriod("custom", now, "2026-02-30", "2026-03-01").valid, false);
});

test("dated records outside a window and invalid dates are excluded", () => {
  const period = resolveReportingPeriod("month", now);
  assert.equal(isWithinReportingPeriod("2026-11-01T00:00:00", period), true);
  assert.equal(isWithinReportingPeriod("2026-10-31T23:59:59", period), false);
  assert.equal(isWithinReportingPeriod("not-a-date", period), false);
});
