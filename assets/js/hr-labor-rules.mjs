export const MINIMUM_WAGE_SECTORS = Object.freeze([
  { code: "agropecuario", label: "Agropecuario (más alimentación)", amountNio: 6188.02, effectiveFrom: "2026-03-01", effectiveTo: "2027-02-28" },
  { code: "pesca", label: "Pesca", amountNio: 9409.09, effectiveFrom: "2026-03-01", effectiveTo: "2027-02-28" },
  { code: "minas_canteras", label: "Minas y canteras", amountNio: 11113.46, effectiveFrom: "2026-03-01", effectiveTo: "2027-02-28" },
  { code: "manufactura", label: "Industria manufacturera", amountNio: 8320.48, effectiveFrom: "2026-03-01", effectiveTo: "2027-02-28" },
  { code: "regimen_especial", label: "Industria sujeta a régimen especial", amountNio: 9986.46, effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31" },
  { code: "artesanal_turistica", label: "Micro y pequeña industria artesanal y turística nacional", amountNio: 6519.58, effectiveFrom: "2026-03-01", effectiveTo: "2027-02-28" },
  { code: "commerce", label: "Electricidad, gas y agua; comercio, restaurantes, hoteles, transporte y almacenamiento", amountNio: 11350.08, effectiveFrom: "2026-03-01", effectiveTo: "2027-02-28" },
  { code: "construccion_finanzas", label: "Construcción, establecimientos financieros y seguros", amountNio: 13848.23, effectiveFrom: "2026-03-01", effectiveTo: "2027-02-28" },
  { code: "servicios", label: "Servicios comunales, sociales y personales", amountNio: 8674.94, effectiveFrom: "2026-03-01", effectiveTo: "2027-02-28" },
  { code: "gobierno", label: "Gobierno central y municipal", amountNio: 7716.70, effectiveFrom: "2026-03-01", effectiveTo: "2027-02-28" }
]);

export function getMinimumWageForSector(sectorCode = "commerce", effectiveDate = new Date().toISOString().slice(0, 10)) {
  const sector = MINIMUM_WAGE_SECTORS.find(item => item.code === String(sectorCode || "commerce"));
  if (!sector) return { available: false, code: "UNKNOWN_MINIMUM_WAGE_SECTOR" };
  const date = String(effectiveDate || "");
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return { available: false, code: "INVALID_MINIMUM_WAGE_DATE" };
  if (date < sector.effectiveFrom) {
    return { available: false, code: "MINIMUM_WAGE_TABLE_NOT_YET_EFFECTIVE", sector };
  }
  if (date > sector.effectiveTo) {
    return { available: false, code: "MINIMUM_WAGE_TABLE_EXPIRED", sector };
  }
  return { available: true, ...sector };
}

export function validateMonthlyMinimumWage({
  salaryNio,
  status = "Activo",
  workSchedule = "Por definir",
  effectiveDate = new Date().toISOString().slice(0, 10),
  settings = { sector_code: "commerce" }
}) {
  if (String(status || "Activo") !== "Activo") {
    return { valid: true, applies: false, reason: "inactive_employee" };
  }
  if (String(workSchedule || "Por definir") === "Parcial") {
    return {
      valid: true,
      applies: false,
      reviewRequired: true,
      code: "PARTIAL_SCHEDULE_REQUIRES_HOURLY_REVIEW",
      message: "La jornada parcial requiere registrar y revisar el equivalente salarial por horas; el ERP aún no calcula una tarifa horaria."
    };
  }

  const rule = getMinimumWageForSector(settings?.sector_code || "commerce", effectiveDate);
  if (!rule.available) {
    return {
      valid: false,
      code: rule.code,
      message: rule.code === "MINIMUM_WAGE_TABLE_EXPIRED"
        ? "La tabla de salario mínimo expiró. Actualiza la normativa vigente antes de contratar o modificar salarios."
        : "No existe una tabla de salario mínimo aplicable para el sector y fecha seleccionados."
    };
  }

  const salary = Number(salaryNio);
  if (!Number.isFinite(salary) || salary < 0) {
    return { valid: false, code: "INVALID_SALARY", message: "El salario mensual debe ser un importe válido y no negativo." };
  }
  if (salary + 0.001 < rule.amountNio) {
    return {
      valid: false,
      code: "MINIMUM_WAGE_VIOLATION",
      minimumSalaryNio: rule.amountNio,
      sectorCode: rule.code,
      message: "El salario base mensual de jornada completa no puede ser inferior al mínimo vigente de C$" +
        rule.amountNio.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        " para " + rule.label + " (vigencia " + rule.effectiveFrom + " a " + rule.effectiveTo + ")."
    };
  }
  return { valid: true, applies: true, minimumSalaryNio: rule.amountNio, sector: rule.label };
}
