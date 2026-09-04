export const APP_PAGES = [
  "pos",
  "otherSales",
  "categories",
  "products",
  "batches",
  "dailyPrices",
  "suppliers",
  "supplyInvoices",
  "customers",
  "saleInvoices",
  "debts",
  "distributions",
  "expenses",
  "dailyJournal",
  "employees",
  "waste",
  "reports",
  "paymentMethods",
];

export const ADMIN_ONLY_PAGES = ["settings", "users", "audit"];

export function parsePerms(perms) {
  if (!perms) return {};
  if (typeof perms === "string") {
    try { return JSON.parse(perms); } catch { return {}; }
  }
  return perms;
}

export function canAccess(user, key) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (ADMIN_ONLY_PAGES.includes(key)) return false;
  if (key === "dashboard" || key === "stats") return !!user.see_stats;
  const perms = parsePerms(user.permissions);
  return perms[key] === true;
}

export function defaultHome(user) {
  if (canAccess(user, "dashboard")) return "/dashboard";
  const first = APP_PAGES.find((p) => canAccess(user, p));
  return first ? `/${first}` : "/pos";
}