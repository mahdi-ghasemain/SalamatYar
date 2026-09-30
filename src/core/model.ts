export type Language = "fa" | "en";
export type Member = { id: string; name: string; relation: string };
export type Medicine = {
  id: string;
  memberId: string;
  name: string;
  dose: string;
  time: string;
  stock: number;
  history: string[];
  notificationId?: string;
};
export type Appointment = {
  notificationId?: string;
  id: string;
  memberId: string;
  name: string;
  date: string;
  note: string;
  time?: string;
  specialty?: string;
  location?: string;
  phone?: string;
  cancelled?: boolean;
};
export type Attachment = {
  name: string;
  mime: string;
  size: number;
  path: string;
  cloud: boolean;
};
export type RecordItem = {
  id: string;
  memberId: string;
  name: string;
  date: string;
  note: string;
  attachment?: Attachment;
  kind?: "lab" | "prescription" | "image" | "note";
  results?: { label: string; value: string; unit: string; range: string }[];
};
export type Metric = {
  id: string;
  memberId: string;
  kind: "pressure" | "glucose" | "weight";
  value: string;
  date: string;
};
export type State = {
  language: Language;
  calendar: "persian" | "gregory";
  theme: "light" | "dark";
  welcomed: boolean;
  metrics: Metric[];
  members: Member[];
  medicines: Medicine[];
  appointments: Appointment[];
  records: RecordItem[];
};
export const initialState: State = {
  language: "fa",
  calendar: "persian",
  theme: "light",
  welcomed: false,
  metrics: [],
  members: [{ id: "self", name: "", relation: "" }],
  medicines: [],
  appointments: [],
  records: [],
};
export const id = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
export const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const digits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
export const validTime = (value: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(digits(value));
export function validDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(date.getTime()) &&
    localDay(date) === value
  );
}
export function toggleDose(medicine: Medicine, day: string): Medicine {
  const done = medicine.history.includes(day);
  if (!done && medicine.stock < 1) return medicine;
  return {
    ...medicine,
    stock: medicine.stock + (done ? 1 : -1),
    history: done
      ? medicine.history.filter((x) => x !== day)
      : [...medicine.history, day],
  };
}
