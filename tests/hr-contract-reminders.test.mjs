import test from "node:test";
import assert from "node:assert/strict";
import { getContractReminders } from "../assets/js/hr-contract-reminders.mjs";

const today = "2026-11-06";

test("contract reminders include 30-day and 15-day deadlines and overdue contracts", () => {
  const employees = [
    { id:"a", name:"A", status:"Activo", contractType:"Temporal", contractEndDate:"2026-12-06" },
    { id:"b", name:"B", status:"Activo", contractType:"Temporal", contractEndDate:"2026-11-21" },
    { id:"c", name:"C", status:"Activo", contractType:"Temporal", contractEndDate:"2026-11-05" },
    { id:"d", name:"D", status:"Activo", contractType:"Indefinido", contractEndDate:"2026-11-10" },
    { id:"e", name:"E", status:"Inactivo", contractType:"Temporal", contractEndDate:"2026-11-10" },
    { id:"f", name:"F", status:"Activo", contractType:"Temporal", contractEndDate:"2027-01-01" }
  ];
  const reminders = getContractReminders(employees, today);
  assert.deepEqual(reminders.map(item => [item.employeeId, item.daysRemaining]), [["c",-1],["b",15],["a",30]]);
});

test("contract reminders ignore malformed dates and sort same-day names deterministically", () => {
  const employees = [
    { id:"b", name:"Zoe", status:"Activo", contractType:"Temporal", contractEndDate:"2026-11-06" },
    { id:"a", name:"Ana", status:"Activo", contractType:"Temporal", contractEndDate:"2026-11-06" },
    { id:"x", name:"Bad", status:"Activo", contractType:"Temporal", contractEndDate:"2026-02-30" }
  ];
  assert.deepEqual(getContractReminders(employees, today).map(item => item.employeeName), ["Ana","Zoe"]);
});
