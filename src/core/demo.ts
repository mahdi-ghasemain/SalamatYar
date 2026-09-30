import { initialState, localDay, State } from "./model";
export function demoState(): State {
  const day = localDay();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    ...initialState,
    welcomed: true,
    members: [
      { id: "self", name: "مهدی", relation: "من" },
      { id: "mother", name: "مادر", relation: "عضو خانواده" },
      { id: "father", name: "پدر", relation: "عضو خانواده" },
      { id: "sara", name: "سارا", relation: "خواهر" },
    ],
    medicines: [
      {
        id: "m1",
        memberId: "self",
        name: "متفورمین ۵۰۰",
        dose: "دستور نمونه · بعد از غذا",
        time: "08:00",
        stock: 24,
        history: [day],
      },
      {
        id: "m2",
        memberId: "self",
        name: "ویتامین D",
        dose: "دستور نمونه · همراه غذا",
        time: "14:00",
        stock: 3,
        history: [],
      },
      {
        id: "m3",
        memberId: "self",
        name: "آسپرین ۸۰",
        dose: "دستور نمونه · بعد از غذا",
        time: "20:00",
        stock: 18,
        history: [],
      },
      {
        id: "m4",
        memberId: "mother",
        name: "داروی نمونه مادر",
        dose: "صرفاً برای نمایش قالب",
        time: "09:00",
        stock: 12,
        history: [],
      },
    ],
    appointments: [
      {
        id: "a1",
        memberId: "self",
        name: "دکتر علی رضایی",
        date: localDay(tomorrow),
        time: "16:30",
        specialty: "متخصص قلب و عروق",
        location: "مطب نمونه · تهران",
        note: "همراه داشتن مدارک قبلی",
      },
      {
        id: "a2",
        memberId: "self",
        name: "دکتر سارا محمدی",
        date: localDay(tomorrow),
        time: "18:00",
        specialty: "متخصص پوست و مو",
        location: "کلینیک نمونه",
        note: "",
      },
      {
        id: "a3",
        memberId: "self",
        name: "دکتر حسین کریمی",
        date: day,
        time: "09:00",
        specialty: "متخصص داخلی",
        location: "درمانگاه نمونه",
        note: "",
      },
    ],
    records: [
      {
        id: "r1",
        memberId: "self",
        name: "آزمایش خون کامل (CBC)",
        date: day,
        kind: "lab",
        note: "تمام مقادیر این صفحه ساختگی و صرفاً برای نمایش رابط هستند.",
        results: [
          { label: "WBC", value: "6.5", unit: "10³/µL", range: "4–10" },
          { label: "RBC", value: "4.8", unit: "10⁶/µL", range: "4.2–5.4" },
          { label: "Hemoglobin", value: "14.2", unit: "g/dL", range: "12–16" },
          { label: "Hematocrit", value: "42", unit: "%", range: "36–48" },
          { label: "MCV", value: "88", unit: "fL", range: "80–100" },
          { label: "MCH", value: "29", unit: "pg", range: "27–33" },
          { label: "Platelet", value: "250", unit: "10³/µL", range: "150–450" },
        ],
      },
      {
        id: "r2",
        memberId: "self",
        name: "نسخه دکتر رضایی",
        date: day,
        kind: "prescription",
        note: "یادداشت نمونه ویزیت",
      },
      {
        id: "r3",
        memberId: "self",
        name: "تصویربرداری",
        date: day,
        kind: "image",
        note: "جایگاه تصویر پزشکی؛ فایل واقعی پیوست نشده است.",
      },
      {
        id: "r4",
        memberId: "self",
        name: "آزمایش قند خون (FBS)",
        date: day,
        kind: "lab",
        note: "یادداشت نمونه",
        results: [
          {
            label: "FBS",
            value: "94",
            unit: "mg/dL",
            range: "طبق برگه آزمایش",
          },
        ],
      },
    ],
    metrics: ["pressure", "glucose", "weight"].flatMap((kind, i) =>
      Array.from({ length: 7 }, (_, j) => {
        const d = new Date();
        d.setDate(d.getDate() - 6 + j);
        return {
          id: `metric-${i}-${j}`,
          memberId: "self",
          kind: kind as "pressure" | "glucose" | "weight",
          date: localDay(d),
          value:
            kind === "pressure"
              ? `${[120, 125, 118, 122, 116, 120, 120][j]}/80`
              : String(
                  kind === "glucose"
                    ? [92, 98, 94, 90, 96, 91, 94][j]
                    : [72, 72.3, 72.1, 72.4, 72.1, 72.2, 72][j],
                ),
        };
      }),
    ),
  };
}
