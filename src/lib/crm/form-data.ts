export {
  defaultFollowUpDueAt,
  endOfToday,
  formatDate,
  formatDateTime,
  parseDate,
  parseDateTimeLocal,
  startOfToday,
  toDateInputValue,
  toDateTimeLocalValue,
} from "@/lib/dates";

export function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function normalizeWebsite(value: string | null) {
  if (!value) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

export function formatMoney(value: string | number) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
