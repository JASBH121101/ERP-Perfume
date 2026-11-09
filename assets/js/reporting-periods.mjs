function parseLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function formatReportingDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function resolveReportingPeriod(preset = "all", now = new Date(), customFrom = "", customTo = "") {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = null;
  let end = endOfDay(today);

  switch (preset) {
    case "month":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "previous_month":
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = endOfDay(new Date(today.getFullYear(), today.getMonth(), 0));
      break;
    case "last_30":
    case "last_90":
    case "last_180": {
      const days = preset === "last_30" ? 30 : preset === "last_90" ? 90 : 180;
      start = new Date(today);
      start.setDate(start.getDate() - (days - 1));
      break;
    }
    case "year":
      start = new Date(today.getFullYear(), 0, 1);
      break;
    case "custom": {
      start = parseLocalDate(customFrom);
      const customEnd = parseLocalDate(customTo);
      if (!start || !customEnd || start > customEnd) {
        return { valid: false, preset, from: customFrom || "", to: customTo || "", start: null, end: null, label: "Rango personalizado no válido" };
      }
      end = endOfDay(customEnd);
      break;
    }
    case "all":
      return { valid: true, preset, from: "", to: "", start: null, end: null, label: "Todo el historial" };
    default:
      return { valid: false, preset, from: "", to: "", start: null, end: null, label: "Período no válido" };
  }

  const from = formatReportingDate(start);
  const to = formatReportingDate(end);
  return {
    valid: true,
    preset,
    from,
    to,
    start,
    end,
    label: from + " al " + to
  };
}

export function isWithinReportingPeriod(value, period) {
  if (!period || period.valid === false) return false;
  if (!period.start && !period.end) return true;
  if (value == null || value === "") return false;

  let date;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date = parseLocalDate(value);
  } else {
    date = value instanceof Date ? value : new Date(value);
  }
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  return (!period.start || date >= period.start) && (!period.end || date <= period.end);
}
