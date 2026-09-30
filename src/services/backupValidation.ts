import { initialState, validDate, validTime } from "../core/model.ts";
import type { State } from "../core/model.ts";
export function validateBackup(input: unknown): State {
  if (!input || typeof input !== "object") throw new Error("INVALID_BACKUP");
  const s = input as State;
  for (const kind of [
    "members",
    "medicines",
    "appointments",
    "records",
    "metrics",
  ] as const) {
    if (kind === "metrics" && s[kind] === undefined) continue;
    if (!Array.isArray(s[kind]) || s[kind].length > 5000)
      throw new Error("INVALID_BACKUP");
    const ids = new Set();
    for (const entry of s[kind]) {
      if (
        !entry ||
        typeof entry.id !== "string" ||
        !entry.id ||
        ids.has(entry.id)
      )
        throw new Error("INVALID_BACKUP");
      ids.add(entry.id);
    }
  }
  if (
    !s.members.some((m) => m.id === "self") ||
    s.members.some(
      (m) => typeof m.name !== "string" || typeof m.relation !== "string",
    )
  )
    throw new Error("INVALID_BACKUP");
  const members = new Set(s.members.map((m) => m.id));
  for (const m of s.medicines) {
    if (
      !members.has(m.memberId) ||
      typeof m.name !== "string" ||
      typeof m.dose !== "string" ||
      !validTime(m.time) ||
      !Number.isInteger(m.stock) ||
      m.stock < 0 ||
      !Array.isArray(m.history) ||
      m.history.some((d) => typeof d !== "string" || !validDate(d))
    )
      throw new Error("INVALID_BACKUP");
  }
  for (const r of [...s.appointments, ...s.records])
    if (
      !members.has(r.memberId) ||
      typeof r.name !== "string" ||
      typeof r.note !== "string" ||
      !validDate(r.date)
    )
      throw new Error("INVALID_BACKUP");
  for(const a of s.appointments){
    for(const key of ['time','specialty','location','phone'] as const)if(a[key]!==undefined&&typeof a[key]!=='string')throw new Error('INVALID_BACKUP');
    if(a.time&&!validTime(a.time))throw new Error('INVALID_BACKUP');
  }
  for(const r of s.records){
    if(r.results!==undefined&&(!Array.isArray(r.results)||r.results.length>500||r.results.some(v=>!v||['label','value','unit','range'].some(k=>typeof v[k as keyof typeof v]!=='string'))))throw new Error('INVALID_BACKUP');
    if(r.attachment){const a=r.attachment;if(typeof a.path!=='string'||typeof a.name!=='string'||typeof a.mime!=='string'||typeof a.cloud!=='boolean'||!Number.isFinite(a.size)||a.size<0||a.size>10485760)throw new Error('INVALID_BACKUP');}
  }
  for (const m of s.metrics || [])
    if (
      !members.has(m.memberId) ||
      !["pressure", "glucose", "weight"].includes(m.kind) ||
      typeof m.value !== "string" ||
      !(m.kind==='pressure'?/^\d{2,3}\/\d{2,3}$/:/^\d{1,3}(\.\d{1,2})?$/).test(m.value) ||
      !validDate(m.date)
    )
      throw new Error("INVALID_BACKUP");
  return {
    ...initialState,
    ...s,
    language: s.language === "en" ? "en" : "fa",
    calendar: s.calendar === "gregory" ? "gregory" : "persian",
    theme: s.theme === "dark" ? "dark" : "light",
    metrics: s.metrics || [],
  };
}
