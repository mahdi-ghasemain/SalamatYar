import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Text, TextInput } from "../components/Typography";
import { useStore } from "../core/store";
import {
  digits,
  id,
  localDay,
  toggleDose,
  validDate,
  validTime,
} from "../core/model";
import { cancelReminder, scheduleDaily } from "../core/notifications";

const blue = "#5263ED";
const tabs = [
  "home",
  "medicines",
  "appointments",
  "records",
  "family",
] as const;
const icons = ["⌂", "✚", "▦", "▤", "♡"];
type Form = "medicines" | "appointments" | "records" | "family" | null;
export default function Dashboard() {
  const { state, update, ready, error } = useStore();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const page = section || "home";
  const fa = state.language === "fa";
  const t = (persian: string, english: string) => (fa ? persian : english);
  const row = {
    flexDirection: fa ? ("row-reverse" as const) : ("row" as const),
  };
  const align = { textAlign: fa ? ("right" as const) : ("left" as const) };
  const labels = [
    t("خانه", "Today"),
    t("داروها", "Medicines"),
    t("نوبت‌ها", "Visits"),
    t("مدارک", "Records"),
    t("خانواده", "Family"),
  ];
  const [memberId, setMember] = useState("self");
  const [day, setDay] = useState(localDay());
  const [form, setForm] = useState<Form>(null);
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [time, setTime] = useState("08:00");
  const [stock, setStock] = useState("30");
  const [date, setDate] = useState(localDay());
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setDay(localDay()), 30000);
    const listener = AppState.addEventListener("change", () =>
      setDay(localDay()),
    );
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  const memberName = (key: string) =>
    state.members.find((m) => m.id === key)?.name || t("من", "Me");
  const meds = state.medicines
    .filter((m) => m.memberId === memberId)
    .sort((a, b) => a.time.localeCompare(b.time));
  const visits = state.appointments
    .filter((a) => a.memberId === memberId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const records = state.records
    .filter((a) => a.memberId === memberId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const done = meds.filter((m) => m.history.includes(day)).length;
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", {
      calendar: state.calendar,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${value}T12:00:00`));
  const go = (value: string) =>
    router.replace(value === "home" ? "/" : (`/${value}` as never));
  function openForm(value: Form) {
    setName("");
    setDetail("");
    setTime("08:00");
    setStock("30");
    setDate(day);
    setConsent(false);
    setMessage("");
    setForm(value);
  }
  function save() {
    if (!name.trim())
      return setMessage(t("نام را وارد کنید.", "Enter a name."));
    if (form === "family" && !consent)
      return setMessage(
        t(
          "رضایت عضو خانواده لازم است.",
          "Confirm the family member’s consent.",
        ),
      );
    if (
      form === "medicines" &&
      (!validTime(time) ||
        !/^\d+$/.test(digits(stock)) ||
        Number(digits(stock)) > 100000 ||
        !detail.trim())
    )
      return setMessage(
        t(
          "دستور ثبت‌شده، ساعت معتبر (08:00) و موجودی صحیح را وارد کنید.",
          "Enter the recorded instructions, a valid time (08:00), and whole-number stock.",
        ),
      );
    if (
      (form === "appointments" || form === "records") &&
      !validDate(digits(date))
    )
      return setMessage(
        t(
          "تاریخ میلادی معتبر به شکل 2026-10-01 وارد کنید.",
          "Enter a valid Gregorian date: 2026-10-01.",
        ),
      );
    const key = id();
    update((s) => {
      if (form === "family")
        return {
          ...s,
          members: [
            ...s.members,
            { id: key, name: name.trim(), relation: detail.trim() },
          ],
        };
      if (form === "medicines")
        return {
          ...s,
          medicines: [
            ...s.medicines,
            {
              id: key,
              memberId,
              name: name.trim(),
              dose: detail.trim(),
              time: digits(time),
              stock: Number(digits(stock)),
              history: [],
            },
          ],
        };
      if (form === "appointments")
        return {
          ...s,
          appointments: [
            ...s.appointments,
            {
              id: key,
              memberId,
              name: name.trim(),
              date: digits(date),
              note: detail.trim(),
            },
          ],
        };
      return {
        ...s,
        records: [
          ...s.records,
          {
            id: key,
            memberId,
            name: name.trim(),
            date: digits(date),
            note: detail.trim(),
          },
        ],
      };
    });
    if (form === "family") setMember(key);
    setForm(null);
    setMessage("");
  }
  async function reminder(medicine: (typeof meds)[number]) {
    setBusy(true);
    try {
      if (medicine.notificationId) {
        await cancelReminder(medicine.notificationId);
        update((s) => ({
          ...s,
          medicines: s.medicines.map((m) =>
            m.id === medicine.id ? { ...m, notificationId: undefined } : m,
          ),
        }));
      } else {
        const notificationId = await scheduleDaily(
          medicine.time,
          state.language,
        );
        update((s) => ({
          ...s,
          medicines: s.medicines.map((m) =>
            m.id === medicine.id ? { ...m, notificationId } : m,
          ),
        }));
      }
    } catch {
      setMessage(
        t(
          "یادآوری فعال نشد. مجوز اعلان را در نسخه اندروید بررسی کنید.",
          "Reminder unavailable. Check notification permission in the Android app.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const title =
    page === "settings"
      ? t("تنظیمات", "Settings")
      : labels[tabs.indexOf(page as (typeof tabs)[number])] || labels[0];
  const button = (label: string, action: () => void, secondary = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={action}
      style={[styles.button, secondary && styles.secondary]}
    >
      <Text style={[styles.buttonText, secondary && { color: blue }]}>
        {label}
      </Text>
    </Pressable>
  );
  const empty = (
    symbol: string,
    heading: string,
    body: string,
    action?: () => void,
  ) => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{symbol}</Text>
      <Text style={styles.cardTitle}>{heading}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action && button(t("افزودن اولین مورد", "Add your first item"), action)}
    </View>
  );
  const medCard = (m: (typeof meds)[number]) => (
    <View key={m.id} style={styles.card}>
      <View style={[styles.between, row]}>
        <View style={[styles.tile, { backgroundColor: "#EEF0FF" }]}>
          <Text style={styles.tileIcon}>✚</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, align]}>{m.name}</Text>
          <Text style={[styles.muted, align]}>{m.dose}</Text>
        </View>
        <Text style={styles.time}>{m.time}</Text>
      </View>
      <View style={[styles.between, row, { marginTop: 18 }]}>
        <Text
          style={[styles.small, { color: m.stock < 5 ? "#C17A26" : "#7B8398" }]}
        >
          {t("موجودی:", "Stock:")} {m.stock}
        </Text>
        <Pressable
          disabled={busy}
          accessibilityRole="button"
          onPress={() => reminder(m)}
        >
          <Text style={styles.link}>
            {m.notificationId
              ? t("خاموش کردن یادآوری", "Disable reminder")
              : t("فعال‌سازی یادآوری", "Enable reminder")}
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: m.history.includes(day) }}
        style={[
          styles.doseButton,
          m.history.includes(day) && { backgroundColor: "#E7F7F0" },
        ]}
        onPress={() => {
          if (m.stock === 0 && !m.history.includes(day)) {
            setMessage(
              t(
                "موجودی تمام شده؛ از صفحه داروها موجودی اضافه کنید.",
                "Out of stock. Add stock on the Medicines page.",
              ),
            );
            return;
          }
          update((s) => ({
            ...s,
            medicines: s.medicines.map((x) =>
              x.id === m.id ? toggleDose(x, day) : x,
            ),
          }));
        }}
      >
        <Text
          style={{
            color: m.history.includes(day) ? "#258866" : blue,
            fontWeight: "500",
          }}
        >
          {m.history.includes(day)
            ? t("✓ امروز انجام شد · لغو ثبت", "✓ Taken today · Undo")
            : t("ثبت مصرف امروز", "Mark taken today")}
        </Text>
      </Pressable>
      {page === "medicines" && (
        <View style={[styles.between, row, { marginTop: 14 }]}>
          <Pressable
            onPress={() =>
              update((s) => ({
                ...s,
                medicines: s.medicines.map((x) =>
                  x.id === m.id ? { ...x, stock: x.stock + 1 } : x,
                ),
              }))
            }
          >
            <Text style={styles.link}>{t("۱+ موجودی", "+1 stock")}</Text>
          </Pressable>
          <Text style={styles.small}>
            {t("روزهای ثبت‌شده:", "Days recorded:")} {m.history.length}
          </Text>
        </View>
      )}
    </View>
  );
  if (!ready)
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.empty}>
          {error ? <Text>{error}</Text> : <ActivityIndicator color={blue} />}
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.shell}>
        <View style={[styles.header, row]}>
          <View style={[styles.brand, row]}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>✚</Text>
            </View>
            <View>
              <Text style={[styles.brandName, align]}>
                {t("سلامت‌یار", "SalamatYar")}
              </Text>
              <Text style={[styles.small, align]}>
                {t("همراه هر روزِ شما", "A little care, every day")}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("تنظیمات", "Settings")}
            onPress={() => go("settings")}
            style={styles.settings}
          >
            <Text style={{ fontSize: 22, color: blue }}>⚙</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.between, row]}>
            <View>
              <Text style={[styles.eyebrow, align]}>
                {t("مراقبت، با خیال آسوده", "YOUR EVERYDAY WELLBEING")}
              </Text>
              <Text
                style={[
                  styles.heading,
                  align,
                  { fontWeight: fa || page === "home" ? "700" : "600" },
                ]}
              >
                {page === "home"
                  ? t("امروز، حال خوب را بساز", "Make room for feeling good")
                  : title}
              </Text>
            </View>
          </View>
          <Text style={[styles.muted, align, { marginBottom: 22 }]}>
            {formatDate(day)}
          </Text>
          {page !== "settings" && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.members, row]}
            >
              {state.members.map((m, index) => (
                <Pressable
                  accessibilityRole="button"
                  key={m.id}
                  onPress={() => setMember(m.id)}
                  style={[
                    styles.member,
                    row,
                    memberId === m.id && styles.memberActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: ["#ECEBFF", "#FFF1DC", "#E2F4F0"][
                          index % 3
                        ],
                      },
                    ]}
                  >
                    {index === 0 ? "☺" : "♡"}
                  </Text>
                  <Text
                    style={{
                      color: memberId === m.id ? blue : "#737B91",
                      fontWeight: "500",
                    }}
                  >
                    {memberName(m.id)}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.addMember}
                onPress={() => openForm("family")}
              >
                <Text style={styles.link}>＋</Text>
              </Pressable>
            </ScrollView>
          )}
          {(message || error) && !form ? (
            <Text accessibilityRole="alert" style={styles.notice}>
              {message || error}
            </Text>
          ) : null}
          {page === "home" && (
            <>
              <View style={styles.hero}>
                <View style={[styles.between, row]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.heroEyebrow, align]}>
                      {t(
                        "یک قدم نزدیک‌تر به سلامتی",
                        "SMALL STEPS. BETTER DAYS.",
                      )}
                    </Text>
                    <Text style={[styles.heroTitle, align]}>
                      {t(
                        "مراقبت از عزیزان،\nاز همین‌جا شروع می‌شود.",
                        "Caring for your family\nstarts right here.",
                      )}
                    </Text>
                    <Text style={[styles.heroBody, align]}>
                      {t(
                        "داروها و برنامه‌های مراقبت، همه در یک جا.",
                        "Your medicines and care plans, together.",
                      )}
                    </Text>
                  </View>
                  <View style={styles.heroArt}>
                    <Text style={{ fontSize: 54, color: "white" }}>♡</Text>
                    <View style={styles.artBadge}>
                      <Text style={{ color: blue, fontSize: 30 }}>✚</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={[styles.stats, row]}>
                {[
                  [String(meds.length), t("داروی روزانه", "Daily medicines")],
                  [
                    String(visits.filter((v) => v.date >= day).length),
                    t("نوبت پیش رو", "Upcoming visits"),
                  ],
                  [String(records.length), t("مدرک سلامت", "Health records")],
                ].map(([value, label]) => (
                  <View key={label} style={styles.stat}>
                    <Text style={styles.statNumber}>{value}</Text>
                    <Text style={styles.small}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.between, row, { marginVertical: 20 }]}>
                <Text style={styles.sectionTitle}>
                  {t("برنامه امروز", "Today’s care plan")}
                </Text>
                <Pressable onPress={() => go("medicines")}>
                  <Text style={styles.link}>
                    {t("همه داروها", "All medicines")}
                  </Text>
                </Pressable>
              </View>
              {meds.length > 0 && (
                <View style={styles.progressCard}>
                  <View style={[styles.between, row]}>
                    <Text style={styles.small}>
                      {t("پیشرفت امروز", "Today’s progress")}
                    </Text>
                    <Text style={styles.link}>
                      {done} / {meds.length}
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${(100 * done) / meds.length}%` },
                      ]}
                    />
                  </View>
                </View>
              )}
              {meds.length
                ? meds.map(medCard)
                : empty(
                    "✚",
                    t(
                      "اولین قدم، ثبت برنامه شماست",
                      "Your care plan starts here",
                    ),
                    t(
                      "داروی ثبت‌شده توسط پزشک را اضافه کنید و برنامه روزانه‌تان را بسازید.",
                      "Add a medicine from your existing prescription to begin your daily plan.",
                    ),
                    () => openForm("medicines"),
                  )}
              <View style={[styles.tip, row]}>
                <Text style={{ fontSize: 26 }}>♡</Text>
                <Text style={[styles.tipText, align]}>
                  {t(
                    "کنار هم، مراقبت آسان‌تر است. برنامه هر عضو خانواده را جداگانه مدیریت کنید.",
                    "Care feels easier together. Keep a separate plan for every family member.",
                  )}
                </Text>
              </View>
            </>
          )}
          {page === "medicines" && (
            <>
              {button(t("＋ افزودن دارو", "＋ Add medicine"), () =>
                openForm("medicines"),
              )}
              <Text style={[styles.muted, align, { marginVertical: 16 }]}>
                {t(
                  "هر ثبت، یک نوبت روزانه و یک واحد موجودی است. برای ساعت دیگر، نوبت جدا ثبت کنید.",
                  "Each entry is one daily intake and one stock unit. Add a separate entry for another time.",
                )}
              </Text>
              {meds.length
                ? meds.map(medCard)
                : empty(
                    "✚",
                    t("هنوز دارویی ثبت نشده", "No medicines yet"),
                    t(
                      "نام و دستور مصرف را از نسخه خود وارد کنید.",
                      "Enter the name and instructions from your prescription.",
                    ),
                  )}
            </>
          )}
          {page === "appointments" && (
            <>
              {button(t("＋ ثبت نوبت", "＋ Add appointment"), () =>
                openForm("appointments"),
              )}
              {visits.length
                ? visits.map((v) => (
                    <View style={[styles.card, { marginTop: 14 }]} key={v.id}>
                      <Text style={[styles.cardTitle, align]}>{v.name}</Text>
                      <Text
                        style={[styles.link, align, { marginVertical: 12 }]}
                      >
                        {formatDate(v.date)}
                      </Text>
                      <Text style={[styles.muted, align]}>{v.note}</Text>
                      <Text style={[styles.small, align, { marginTop: 12 }]}>
                        {v.date < day
                          ? t("گذشته", "Past")
                          : t("پیش رو", "Upcoming")}
                      </Text>
                    </View>
                  ))
                : empty(
                    "▦",
                    t("نوبت‌های شما، مرتب و یکجا", "Every visit, in one place"),
                    t(
                      "مراجعه بعدی خود را ثبت کنید. ثبت نوبت در این نسخه اعلان ندارد.",
                      "Record your next visit. Appointment notifications are not included yet.",
                    ),
                  )}
            </>
          )}
          {page === "records" && (
            <>
              {button(t("＋ ثبت یادداشت سلامت", "＋ Add health note"), () =>
                openForm("records"),
              )}
              <Text style={[styles.muted, align, { marginVertical: 16 }]}>
                {t(
                  "در این نسخه عنوان و یادداشت مدارک ثبت می‌شود؛ پیوست فایل هنوز اضافه نشده است.",
                  "This version saves record titles and notes. File attachments are not available yet.",
                )}
              </Text>
              {records.length
                ? records.map((r) => (
                    <View key={r.id} style={styles.card}>
                      <Text style={[styles.cardTitle, align]}>{r.name}</Text>
                      <Text
                        style={[styles.small, align, { marginVertical: 12 }]}
                      >
                        {formatDate(r.date)}
                      </Text>
                      <Text style={[styles.muted, align]}>{r.note}</Text>
                    </View>
                  ))
                : empty(
                    "▤",
                    t("داستان سلامت شما", "Your health, remembered"),
                    t(
                      "خلاصه مراجعه‌ها و مدارک را برای دفعه بعد نگه دارید.",
                      "Keep notes about visits and records for next time.",
                    ),
                  )}
            </>
          )}
          {page === "family" && (
            <>
              {state.members.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() => setMember(m.id)}
                  style={[
                    styles.card,
                    styles.between,
                    row,
                    memberId === m.id && { borderColor: "#BFC5FF" },
                  ]}
                >
                  <View style={[styles.tile, { backgroundColor: "#EFEDFF" }]}>
                    <Text style={styles.tileIcon}>{i === 0 ? "☺" : "♡"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, align]}>
                      {memberName(m.id)}
                    </Text>
                    <Text style={[styles.muted, align]}>
                      {m.relation || t("پرونده شخصی", "Personal profile")}
                    </Text>
                  </View>
                  {memberId === m.id && <Text style={styles.link}>✓</Text>}
                </Pressable>
              ))}
              {button(t("＋ افزودن عضو خانواده", "＋ Add family member"), () =>
                openForm("family"),
              )}
              <Text style={[styles.muted, align, { marginTop: 16 }]}>
                {t(
                  "پروفایل‌ها فقط روی این دستگاه هستند؛ اشتراک‌گذاری آنلاین هنوز فعال نیست.",
                  "Profiles stay on this device. Online sharing is not available yet.",
                )}
              </Text>
            </>
          )}
          {page === "settings" && (
            <>
              <View style={styles.card}>
                <Text style={[styles.cardTitle, align]}>
                  {t("زبان برنامه", "App language")}
                </Text>
                <View style={[styles.options, row]}>
                  {button(
                    "فارسی",
                    () => update((s) => ({ ...s, language: "fa" })),
                    !fa,
                  )}
                  {button(
                    "English",
                    () => update((s) => ({ ...s, language: "en" })),
                    fa,
                  )}
                </View>
              </View>
              <View style={styles.card}>
                <Text style={[styles.cardTitle, align]}>
                  {t("نمایش تقویم", "Calendar display")}
                </Text>
                <View style={[styles.options, row]}>
                  {button(
                    t("شمسی", "Persian"),
                    () => update((s) => ({ ...s, calendar: "persian" })),
                    state.calendar !== "persian",
                  )}
                  {button(
                    t("میلادی", "Gregorian"),
                    () => update((s) => ({ ...s, calendar: "gregory" })),
                    state.calendar !== "gregory",
                  )}
                </View>
              </View>
              <View style={styles.card}>
                <Text style={[styles.cardTitle, align]}>
                  {t(
                    "اطلاعات شما، روی دستگاه شما",
                    "Your data stays on your device",
                  )}
                </Text>
                <Text style={[styles.muted, align, { marginTop: 12 }]}>
                  {t(
                    "این نسخه آزمایشی آفلاین است، ورود یا سرور ندارد و فضای ذخیره‌سازی آن رمزگذاری اختصاصی ندارد. فعلاً با اطلاعات آزمایشی استفاده کنید. حذف برنامه ممکن است اطلاعات را پاک کند.",
                    "This offline prototype has no account or server and no dedicated storage encryption. Use sample data for now. Uninstalling may erase your data.",
                  )}
                </Text>
              </View>
              <Text style={[styles.muted, align]}>
                {t(
                  "سلامت‌یار دستور مصرف یا تشخیص پزشکی ارائه نمی‌کند؛ برنامه را مطابق دستور ثبت‌شده خود وارد کنید.",
                  "SalamatYar does not provide diagnoses or dosing advice. Enter your existing prescribed instructions.",
                )}
              </Text>
              <Text style={[styles.small, align, { marginTop: 20 }]}>
                SalamatYar · 0.1.0
              </Text>
            </>
          )}
          <Text style={styles.footer}>
            {t(
              "با توجه، برای روزهای بهتر",
              "Thoughtfully made for better days",
            )}{" "}
            ♡
          </Text>
        </ScrollView>
        <View style={[styles.nav, row]}>
          {tabs.map((tab, i) => (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: page === tab }}
              onPress={() => go(tab)}
              style={styles.navItem}
            >
              <Text style={[styles.navIcon, page === tab && { color: blue }]}>
                {icons[i]}
              </Text>
              <Text
                style={[
                  styles.navLabel,
                  page === tab && { color: blue, fontWeight: "700" },
                ]}
              >
                {labels[i]}
              </Text>
              {page === tab && <View style={styles.dot} />}
            </Pressable>
          ))}
        </View>
      </View>
      <Modal
        visible={!!form}
        animationType="slide"
        transparent
        onRequestClose={() => setForm(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={[styles.between, row]}>
                <Text style={styles.sectionTitle}>
                  {t("ثبت مورد جدید", "Add a new item")}
                </Text>
                <Pressable
                  accessibilityLabel={t("بستن", "Close")}
                  onPress={() => setForm(null)}
                >
                  <Text style={styles.close}>×</Text>
                </Pressable>
              </View>
              <Text style={[styles.muted, align, { marginBottom: 20 }]}>
                {memberName(memberId)}
              </Text>
              <Text style={[styles.fieldLabel, align]}>
                {t("نام / عنوان", "Name / title")}
              </Text>
              <TextInput
                maxLength={100}
                value={name}
                onChangeText={setName}
                style={[styles.input, align]}
                placeholder={t("اینجا بنویسید…", "Type here…")}
                placeholderTextColor="#A0A6B5"
              />
              <Text style={[styles.fieldLabel, align]}>
                {form === "medicines"
                  ? t("دستور ثبت‌شده مصرف", "Recorded instructions")
                  : form === "family"
                    ? t("نسبت", "Relationship")
                    : t("یادداشت", "Notes")}
              </Text>
              <TextInput
                maxLength={1000}
                value={detail}
                onChangeText={setDetail}
                style={[styles.input, align]}
                multiline
              />
              {form === "medicines" && (
                <>
                  <Text style={[styles.fieldLabel, align]}>
                    {t("ساعت روزانه (24 ساعته)", "Daily time (24-hour)")}
                  </Text>
                  <TextInput
                    value={time}
                    onChangeText={setTime}
                    style={[styles.input, { fontWeight: "500" }]}
                    placeholder="08:00"
                  />
                  <Text style={[styles.fieldLabel, align]}>
                    {t("موجودی (تعداد نوبت مصرف)", "Stock (number of intakes)")}
                  </Text>
                  <TextInput
                    value={stock}
                    onChangeText={setStock}
                    keyboardType="number-pad"
                    style={[styles.input, { fontWeight: "500" }]}
                  />
                </>
              )}
              {(form === "appointments" || form === "records") && (
                <>
                  <Text style={[styles.fieldLabel, align]}>
                    {t(
                      "ورود تاریخ میلادی (سال-ماه-روز)",
                      "Gregorian date (YYYY-MM-DD)",
                    )}
                  </Text>
                  <TextInput
                    value={date}
                    onChangeText={setDate}
                    style={styles.input}
                    placeholder="2026-10-01"
                  />
                  <Text style={[styles.small, align]}>
                    {validDate(digits(date)) ? formatDate(digits(date)) : ""}
                  </Text>
                </>
              )}
              {form === "family" && (
                <View style={[styles.between, row, { marginVertical: 12 }]}>
                  <Text style={[styles.muted, align, { flex: 1 }]}>
                    {t(
                      "برای مدیریت این اطلاعات رضایت دارم.",
                      "I have consent to manage this profile.",
                    )}
                  </Text>
                  <Switch
                    value={consent}
                    onValueChange={setConsent}
                    trackColor={{ true: blue }}
                  />
                </View>
              )}
              {message ? (
                <Text accessibilityRole="alert" style={styles.notice}>
                  {message}
                </Text>
              ) : null}
              <View style={{ marginTop: 22 }}>
                {button(t("ذخیره", "Save"), save)}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F8FC" },
  shell: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  brand: { alignItems: "center", gap: 12 },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: blue,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  logoText: { color: "white", fontSize: 30, fontWeight: "700" },
  brandName: { fontSize: 21, fontWeight: "700", color: "#242D49" },
  small: { fontSize: 12, fontWeight: "300", color: "#8990A2", lineHeight: 20 },
  settings: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#F1F3FE",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 24, paddingBottom: 12 },
  between: { alignItems: "center", justifyContent: "space-between", gap: 14 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.1,
    color: "#8791AE",
    marginBottom: 10,
  },
  heading: {
    fontSize: 27,
    fontWeight: "700",
    color: "#252D49",
    lineHeight: 42,
  },
  muted: { fontSize: 13, color: "#8990A2", lineHeight: 24 },
  members: { gap: 10, paddingBottom: 22 },
  member: {
    alignItems: "center",
    gap: 9,
    padding: 7,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EDF0F8",
  },
  memberActive: { borderColor: "#C9CDFF", backgroundColor: "#F0F1FF" },
  avatar: {
    width: 31,
    height: 31,
    borderRadius: 12,
    textAlign: "center",
    lineHeight: 31,
    color: blue,
    fontSize: 23,
  },
  addMember: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#DEE2F0",
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    backgroundColor: blue,
    borderRadius: 26,
    padding: 24,
    overflow: "hidden",
  },
  heroEyebrow: { fontSize: 10, color: "#D5DAFF", marginBottom: 14 },
  heroTitle: { fontSize: 22, fontWeight: "700", lineHeight: 35, color: "#FFF" },
  heroBody: { fontSize: 12, color: "#E0E4FF", lineHeight: 23, marginTop: 12 },
  heroArt: {
    width: 80,
    height: 96,
    borderRadius: 28,
    backgroundColor: "#7380F5",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-10deg" }],
  },
  artBadge: {
    position: "absolute",
    bottom: -10,
    right: -5,
    backgroundColor: "#FFF",
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: { gap: 10, marginTop: 18 },
  stat: {
    flex: 1,
    backgroundColor: "#FFF",
    paddingVertical: 17,
    alignItems: "center",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#EEF0F7",
  },
  statNumber: { fontSize: 23, fontWeight: "500", color: blue, marginBottom: 4 },
  sectionTitle: { fontSize: 19, fontWeight: "600", color: "#29324D" },
  link: { fontSize: 12, fontWeight: "500", color: blue },
  progressCard: {
    padding: 17,
    borderRadius: 18,
    backgroundColor: "#FFF",
    marginBottom: 14,
  },
  track: {
    height: 6,
    backgroundColor: "#EEF2F5",
    borderRadius: 9,
    marginTop: 13,
    overflow: "hidden",
  },
  fill: { height: 6, backgroundColor: "#63CBA8", borderRadius: 9 },
  card: {
    padding: 20,
    backgroundColor: "#FFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ECEEF7",
    marginBottom: 13,
  },
  tile: {
    width: 44,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  tileIcon: { fontSize: 26, color: blue },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333B55",
    lineHeight: 26,
  },
  time: { fontSize: 17, fontWeight: "500", color: "#596583" },
  doseButton: {
    padding: 13,
    marginTop: 15,
    backgroundColor: "#F0F2FF",
    borderRadius: 13,
    alignItems: "center",
  },
  empty: {
    alignItems: "center",
    padding: 28,
    backgroundColor: "#FFF",
    borderRadius: 24,
    gap: 12,
    marginTop: 14,
  },
  emptyIcon: {
    fontSize: 42,
    color: blue,
    backgroundColor: "#F1F1FF",
    width: 76,
    height: 76,
    lineHeight: 76,
    textAlign: "center",
    borderRadius: 26,
    overflow: "hidden",
  },
  emptyBody: {
    fontSize: 13,
    color: "#8990A2",
    lineHeight: 25,
    textAlign: "center",
    marginBottom: 8,
  },
  button: {
    backgroundColor: blue,
    borderRadius: 15,
    paddingHorizontal: 23,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: "#FFF", fontWeight: "500", fontSize: 14 },
  secondary: { backgroundColor: "#EFF1FF" },
  tip: {
    padding: 19,
    backgroundColor: "#EBF5F3",
    borderRadius: 20,
    alignItems: "center",
    gap: 14,
    marginTop: 18,
  },
  tipText: { flex: 1, fontSize: 12, color: "#638C83", lineHeight: 24 },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#A6ADBC",
    paddingVertical: 25,
  },
  nav: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#EEF0F7",
    justifyContent: "space-around",
  },
  navItem: { alignItems: "center", flex: 1, minHeight: 54 },
  navIcon: { fontSize: 25, color: "#A1A8BA" },
  navLabel: { fontSize: 10, color: "#A1A8BA", marginTop: 3 },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: blue,
    marginTop: 5,
  },
  options: { gap: 12, marginTop: 18, flexWrap: "wrap" },
  overlay: {
    flex: 1,
    backgroundColor: "#20294170",
    justifyContent: "flex-end",
  },
  modal: {
    maxHeight: "90%",
    backgroundColor: "#FFF",
    padding: 26,
    paddingBottom: Platform.OS === "ios" ? 44 : 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  close: { fontSize: 30, color: "#9197A8", padding: 6 },
  fieldLabel: {
    fontSize: 13,
    color: "#626C83",
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#F7F8FC",
    borderWidth: 1,
    borderColor: "#E4E8F3",
    borderRadius: 13,
    padding: 14,
    fontSize: 15,
    color: "#333B55",
    minHeight: 50,
  },
  notice: {
    backgroundColor: "#FFF2E9",
    color: "#A26132",
    padding: 14,
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 24,
    marginVertical: 12,
  },
});
