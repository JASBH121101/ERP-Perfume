const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDay(value) {
  if (value instanceof Date) {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(text + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return null;
  return date.getTime();
}

export function getContractReminders(employees, asOf = new Date()) {
  const today = toUtcDay(asOf);
  if (today === null) throw new TypeError("A valid reference date is required.");
  return (Array.isArray(employees) ? employees : [])
    .filter(employee => employee && employee.status === "Activo" &&
      employee.contractType === "Temporal" && employee.contractEndDate)
    .map(employee => {
      const end = toUtcDay(employee.contractEndDate);
      if (end === null) return null;
      return {
        employeeId: employee.id,
        employeeName: String(employee.name || "Colaborador"),
        contractEndDate: employee.contractEndDate,
        daysRemaining: Math.round((end - today) / DAY_MS)
      };
    })
    .filter(item => item && item.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining || a.employeeName.localeCompare(b.employeeName, "es"));
}
