import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  ScrollView,
  Switch,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ClipboardList,
  FileText,
  FlaskConical,
  Heart,
  Home,
  Image as ImageIcon,
  Info,
  MapPin,
  MoreHorizontal,
  Pill,
  Search,
  Settings,
  ShieldCheck,
  SunMoon,
  User,
  Users,
  X,
  Pencil,
  Phone,
  Clock,
  BookOpen,
  ArrowDownToLine,
  Activity,
  Droplet,
  Weight,
} from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { Text, TextInput } from "../components/Typography";
import {
  Avatar,
  BackIcon,
  Brand,
  Button,
  Card,
  Illustration,
  Label,
  palettes,
  Row,
  Tap,
  UIContext,
  uiStyles,
} from "../components/TemplateUI";
import Account from "./Account";
import Nearby from "./Nearby";
import Backup from "./Backup";
import BarcodeScanner from "../components/BarcodeScanner";
import { useAuth } from "../services/auth";
import {
  pickAttachment,
  commitAttachment,
  discardPendingFiles,
  openAttachment,
  deleteAttachment,
} from "../services/files";
import { useStore } from "../core/store";
import {
  Attachment,
  digits,
  id,
  localDay,
  Metric,
  RecordItem,
  toggleDose,
  validDate,
  validTime,
} from "../core/model";
import {
  cancelReminder,
  scheduleDaily,
  scheduleVisit,
} from "../core/notifications";

type Icon = typeof Heart;
type FormKind =
  | "medicine"
  | "appointment"
  | "record"
  | "lab"
  | "member"
  | "metric"
  | "profile";
type Form = {
  kind: FormKind;
  id?: string;
  name: string;
  note: string;
  time: string;
  date: string;
  stock: string;
  category: string;
  location: string;
  phone: string;
  consent: boolean;
  attachment?: Attachment;
  results: string;
};
const articles = [
  {
    id: "food",
    icon: "🥗",
    fa: "چطور غذای روزانه را ثبت کنیم؟",
    en: "Keep a simple food journal",
    cat: "تغذیه",
    body: "زمان وعده‌ها و یادداشت‌های خودتان را ثبت کنید تا در مراجعه بعدی راحت‌تر درباره عادت‌های روزانه صحبت کنید.",
    english:
      "Record meal times and your own observations so you can discuss daily habits at your next visit.",
  },
  {
    id: "visit",
    icon: "📋",
    fa: "برای ویزیت بعدی آماده باشید",
    en: "Get ready for your next visit",
    cat: "سبک زندگی",
    body: "مدارک قبلی، فهرست داروهای ثبت‌شده و سؤال‌هایی که می‌خواهید بپرسید را یک‌جا نگه دارید.",
    english:
      "Keep previous records, your recorded medicine list, and the questions you want to ask together.",
  },
  {
    id: "family",
    icon: "💚",
    fa: "مراقبت خانوادگی با رضایت",
    en: "Family care starts with consent",
    cat: "سبک زندگی",
    body: "پیش از وارد کردن اطلاعات دیگران، اجازه بگیرید. مشخص کنید چه اطلاعاتی ثبت می‌شود و چه کسی به دستگاه دسترسی دارد.",
    english:
      "Ask permission before entering another person’s information. Agree on what is recorded and who can access the device.",
  },
];
const blankForm = (kind: FormKind): Form => ({
  kind,
  name: "",
  note: "",
  time: "08:00",
  date: localDay(),
  stock: "30",
  category: kind === "metric" ? "pressure" : kind === "lab" ? "lab" : "note",
  location: "",
  phone: "",
  consent: false,
  results: "",
});

export default function TemplateScreen() {
  const { state, update, ready, error, demo, setDemo, retry, syncStatus } =
    useStore();
  const auth = useAuth();
  const [scanner, setScanner] = useState(false);
  const {
    section = "home",
    item,
    member = "self",
  } = useLocalSearchParams<{
    section?: string;
    item?: string;
    member?: string;
  }>();
  const fa = state.language === "fa";
  const dark = state.theme === "dark";
  const colors = dark ? palettes.dark : palettes.light;
  const t = (a: string, b: string) => (fa ? a : b);
  const [day, setDay] = useState(localDay());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(0);
  const [subtab, setSubtab] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{
    text: string;
    action: () => Promise<void> | void;
  } | null>(null);

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
  const go = (page: string, key?: string, person = member) =>
    router.push({
      pathname: page === "home" ? "/" : "/[section]",
      params: {
        ...(page === "home" ? {} : { section: page }),
        ...(key ? { item: key } : {}),
        member: person,
      },
    });
  const home = () => router.replace("/");
  const fmt = (value: string) =>
    new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", {
      calendar: state.calendar,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${value}T12:00:00`));
  const num = (value: number | string) =>
    fa
      ? String(value).replace(/\d/g, (c) => "۰۱۲۳۴۵۶۷۸۹"[Number(c)])
      : String(value);
  const person = state.members.find((m) => m.id === member) || state.members[0];
  const personName = person?.name || t("من", "Me");
  const meds = state.medicines.filter((m) => m.memberId === member);
  const visits = state.appointments.filter((a) => a.memberId === member);
  const records = state.records.filter((r) => r.memberId === member);
  const medicine = meds.find((m) => m.id === item);
  const visit = visits.find((v) => v.id === item);
  const record = records.find((r) => r.id === item);
  const done = meds.filter((m) => m.history.includes(day)).length;
  const titles: Record<string, string> = {
    home: t("خانه", "Home"),
    medicines: t("داروها", "Medicines"),
    medicine: t("جزئیات دارو", "Medicine details"),
    reminders: t("یادآوری‌ها", "Reminders"),
    appointments: t("نوبت‌ها", "Appointments"),
    appointment: t("جزئیات نوبت", "Appointment details"),
    labs: t("آزمایش‌ها", "Lab tests"),
    lab: t("نتیجه آزمایش", "Lab result"),
    records: t("سوابق پزشکی", "Medical records"),
    record: t("جزئیات مدرک", "Record details"),
    family: t("اعضای خانواده", "Family members"),
    member: t("جزئیات عضو", "Member details"),
    metrics: t("شاخص‌های سلامتی", "Health indicators"),
    settings: t("پروفایل و تنظیمات", "Profile & settings"),
    notifications: t("اعلان‌ها", "Notifications"),
    articles: t("مقاله‌ها و نکات سلامتی", "Health articles"),
    article: t("مطالعه مقاله", "Read article"),
    centers: t("نزدیک‌ترین مراکز درمانی", "Nearby care"),
    privacy: t("امنیت و حریم خصوصی", "Privacy & security"),
    backup: t("پشتیبان‌گیری از اطلاعات", "Data backup"),
    gallery: t("همه صفحه‌های قالب", "Template gallery"),
  };
  const open = (kind: FormKind) => {
    setMessage("");
    setForm(blankForm(kind));
  };
  const change = (key: keyof Form, value: string | boolean) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));
  const search = (placeholder = t("جستجو ...", "Search ...")) => (
    <Row
      style={{
        backgroundColor: colors.soft,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 13,
        paddingHorizontal: 13,
        marginBottom: 16,
      }}
    >
      <Search size={17} color={colors.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        style={{
          flex: 1,
          color: colors.text,
          textAlign: fa ? "right" : "left",
          paddingVertical: 12,
          fontSize: 13,
        }}
      />
    </Row>
  );
  const chips = (
    labels: string[],
    value: number,
    select: (n: number) => void,
  ) => (
    <Row
      style={{
        backgroundColor: colors.soft,
        borderRadius: 18,
        padding: 4,
        marginBottom: 17,
        gap: 2,
      }}
    >
      {labels.map((label, i) => (
        <Tap
          key={label}
          accessibilityState={{ selected: value === i }}
          onPress={() => select(i)}
          style={[
            uiStyles.chip,
            {
              flex: 1,
              alignItems: "center",
              backgroundColor: value === i ? colors.blue : "transparent",
              paddingHorizontal: 5,
            },
          ]}
        >
          <Text
            style={{
              fontWeight: "500",
              fontSize: 11,
              color: value === i ? "#FFF" : colors.muted,
            }}
          >
            {label}
          </Text>
        </Tap>
      ))}
    </Row>
  );
  const iconBox = (I: Icon, color = colors.blue, bg = colors.soft) => (
    <View style={[uiStyles.icon, { backgroundColor: bg }]}>
      <I size={23} color={color} strokeWidth={1.7} />
    </View>
  );
  const sectionTitle = (title: string, more?: () => void) => (
    <Row
      style={{
        justifyContent: "space-between",
        marginTop: 8,
        marginBottom: 12,
      }}
    >
      <Label weight="600" size={16}>
        {title}
      </Label>
      {more && (
        <Tap onPress={more}>
          <Label muted size={11}>
            {t("همه", "See all")}
          </Label>
        </Tap>
      )}
    </Row>
  );
  const empty = (text: string, I: Icon = ClipboardList) => (
    <Card style={{ padding: 30, alignItems: "center" }}>
      {iconBox(I)}
      <Label muted style={{ textAlign: "center", marginTop: 12 }}>
        {text}
      </Label>
    </Card>
  );
  const badge = (text: string, green = false) => (
    <View
      style={{
        backgroundColor: green ? "#E4FAF2" : "#FFF4E5",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ fontSize: 10, color: green ? "#16A67D" : "#D99531" }}>
        {text}
      </Text>
    </View>
  );
  const navItems = [
    ["home", Home, t("خانه", "Home")],
    ["medicines", Pill, t("داروها", "Medicines")],
    ["appointments", CalendarDays, t("نوبت‌ها", "Visits")],
    ["family", User, t("خانواده", "Family")],
    ["settings", MoreHorizontal, t("بیشتر", "More")],
  ] as const;
  async function toggleReminder(m: (typeof meds)[number]) {
    if (demo) {
      setMessage(
        t(
          "اعلان واقعی در حالت نمونه فعال نمی‌شود.",
          "Real notifications are disabled in demo mode.",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      if (m.notificationId) {
        await cancelReminder(m.notificationId);
        update((s) => ({
          ...s,
          medicines: s.medicines.map((x) =>
            x.id === m.id ? { ...x, notificationId: undefined } : x,
          ),
        }));
      } else {
        const notificationId = await scheduleDaily(
          m.time,
          state.language,
          `care:${auth.session?.user.id || "guest"}:${m.id}`,
        );
        update((s) => ({
          ...s,
          medicines: s.medicines.map((x) =>
            x.id === m.id ? { ...x, notificationId } : x,
          ),
        }));
      }
    } catch {
      setMessage(
        t(
          "یادآوری فعال نشد؛ مجوز اعلان را در نسخه اندروید بررسی کنید.",
          "Reminder unavailable. Check permissions in the Android app.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  function take(m: (typeof meds)[number]) {
    if (!m.stock && !m.history.includes(day)) {
      setMessage(
        t(
          "موجودی تمام شده است؛ ابتدا موجودی را اصلاح کنید.",
          "Out of stock. Update inventory first.",
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
  }
  const medicineInfo = (
    m: (typeof meds)[number],
    compact: boolean,
    i: number,
  ) => (
    <Row>
      {iconBox(
        Pill,
        ["#2DA3FB", "#F9AF37", "#FE9250"][i % 3],
        ["#EAF6FF", "#FFF6E6", "#FFF0E7"][i % 3],
      )}
      <View style={{ flex: 1 }}>
        <Label weight="600" size={14}>
          {m.name}
        </Label>
        <Label muted size={11}>
          {compact ? num(m.time) : m.dose}
        </Label>
        {!compact && (
          <Label muted size={10}>
            {t("موجودی: ", "Stock: ")}
            {num(m.stock)}
          </Label>
        )}
      </View>
    </Row>
  );
  const medRow = (m: (typeof meds)[number], compact = false, i = 0) =>
    compact ? (
      // The intake checkbox and the detail link are siblings, so the button
      // semantics never nest inside one another.
      <Card key={m.id}>
        <Row>
          <Tap
            accessibilityLabel={t("جزئیات دارو ", "Medicine details ") + m.name}
            onPress={() => go("medicine", m.id)}
            style={{ flex: 1 }}
          >
            {medicineInfo(m, true, i)}
          </Tap>
          <Tap
            accessibilityLabel={t("ثبت مصرف ", "Mark taken ") + m.name}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: m.history.includes(day) }}
            onPress={() => take(m)}
            style={{
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: m.history.includes(day)
                ? "#0BC58E"
                : colors.card,
              padding: 7,
              borderRadius: 8,
            }}
          >
            <Check
              size={14}
              color={m.history.includes(day) ? "#FFF" : colors.muted}
            />
          </Tap>
        </Row>
      </Card>
    ) : (
      <Card key={m.id} onPress={() => go("medicine", m.id)}>
        <Row>
          {medicineInfo(m, false, i)}
          <MoreHorizontal size={18} color={colors.muted} />
        </Row>
      </Card>
    );
  const visitRow = (v: (typeof visits)[number], i = 0) => (
    <Card key={v.id} onPress={() => go("appointment", v.id)}>
      <Row>
        <Avatar index={i} />
        <View style={{ flex: 1 }}>
          <Label weight="600">{v.name}</Label>
          <Label size={11} muted>
            {v.specialty || t("مراجعه پزشکی", "Medical visit")}
          </Label>
          <Label size={11} muted>
            {fmt(v.date)} · {num(v.time || "")}
          </Label>
        </View>
        {v.cancelled ? (
          badge(t("لغو شده", "Cancelled"))
        ) : (
          <ChevronLeft color={colors.muted} size={17} />
        )}
      </Row>
    </Card>
  );
  const recordRow = (r: RecordItem) => (
    <Card
      key={r.id}
      onPress={() => go(r.kind === "lab" ? "lab" : "record", r.id)}
    >
      <Row>
        {iconBox(
          r.kind === "image"
            ? ImageIcon
            : r.kind === "lab"
              ? FlaskConical
              : FileText,
          r.kind === "lab" ? "#10BC94" : colors.blue,
          r.kind === "lab" ? "#E5FAF3" : colors.soft,
        )}
        <View style={{ flex: 1 }}>
          <Label weight="600" size={13}>
            {r.name}
          </Label>
          <Label muted size={11}>
            {fmt(r.date)}
          </Label>
        </View>
        <ChevronLeft size={17} color={colors.muted} />
      </Row>
    </Card>
  );
  async function save() {
    if (!form) return;
    const f = form;
    setMessage("");
    if (!f.name.trim())
      return setMessage(
        t("نام یا مقدار را وارد کنید.", "Enter a name or value."),
      );
    if (
      ["appointment", "record", "lab", "metric"].includes(f.kind) &&
      !validDate(digits(f.date))
    )
      return setMessage(
        t(
          "تاریخ میلادی معتبر وارد کنید: 2026-10-01",
          "Enter a valid Gregorian date: 2026-10-01.",
        ),
      );
    if (["medicine", "appointment"].includes(f.kind) && !validTime(f.time))
      return setMessage(
        t("ساعت معتبر وارد کنید: 08:00", "Enter a valid time: 08:00."),
      );
    if (
      f.kind === "medicine" &&
      (!f.note.trim() ||
        !/^\d+$/.test(digits(f.stock)) ||
        Number(digits(f.stock)) > 100000)
    )
      return setMessage(
        t(
          "دستور مصرف و موجودی صحیح را وارد کنید.",
          "Enter recorded instructions and a valid stock count.",
        ),
      );
    if (f.kind === "member" && !f.id && !f.consent)
      return setMessage(t("تأیید رضایت لازم است.", "Consent is required."));
    if (
      f.kind === "metric" &&
      !(
        f.category === "pressure"
          ? /^\d{2,3}\/\d{2,3}$/
          : f.category === "glucose"
            ? /^\d{2,3}(\.\d{1,2})?$/
            : /^\d{2,3}(\.\d{1,2})?$/
      ).test(digits(f.name).replace(/\s/g, ""))
    )
      return setMessage(
        f.category === "pressure"
          ? t(
              "فشار خون را به شکل 120/80 وارد کنید (سیستول/دیاستول).",
              "Enter blood pressure as 120/80 (systolic/diastolic).",
            )
          : f.category === "glucose"
            ? t(
                "قند خون را با عدد وارد کنید؛ مثال: 95 (mg/dL).",
                "Enter glucose as a number, e.g. 95 (mg/dL).",
              )
            : t(
                "وزن را با عدد وارد کنید؛ مثال: 72.5 (kg).",
                "Enter weight as a number, e.g. 72.5 (kg).",
              ),
      );
    if (
      f.kind === "lab" &&
      f.results.trim() &&
      f.results
        .trim()
        .split("\n")
        .some((line) => {
          const a = line.split("|");
          return a.length < 2 || !a[0].trim() || !a[1].trim();
        })
    )
      return setMessage(
        t(
          "هر ردیف آزمایش: نام | مقدار | واحد | بازه",
          "Each result: name | value | unit | range",
        ),
      );
    setBusy(true);
    try {
      const attachment = await commitAttachment(
        f.attachment,
        auth.session?.user.id,
      );
      if (f.kind === "medicine" && f.id) {
        const old = meds.find((m) => m.id === f.id);
        if (old?.notificationId && old.time !== digits(f.time))
          await cancelReminder(old.notificationId);
      }
      if (f.kind === "appointment" && f.id) {
        const old = visits.find((v) => v.id === f.id);
        await cancelReminder(old?.notificationId);
      }
      update((s) => {
        const key = f.id || id();
        if (f.kind === "medicine") {
          const old = s.medicines.find((m) => m.id === key);
          const entry = {
            id: key,
            memberId: member,
            name: f.name.trim(),
            dose: f.note.trim(),
            time: digits(f.time),
            stock: Number(digits(f.stock)),
            history: old?.history || [],
            notificationId:
              old?.time === digits(f.time) ? old.notificationId : undefined,
          };
          return {
            ...s,
            medicines: f.id
              ? s.medicines.map((m) => (m.id === key ? entry : m))
              : [...s.medicines, entry],
          };
        }
        if (f.kind === "appointment") {
          const entry = {
            id: key,
            memberId: member,
            name: f.name.trim(),
            date: digits(f.date),
            time: digits(f.time),
            note: f.note,
            specialty: f.category,
            location: f.location,
            phone: f.phone,
          };
          return {
            ...s,
            appointments: f.id
              ? s.appointments.map((a) => (a.id === key ? entry : a))
              : [...s.appointments, entry],
          };
        }
        if (f.kind === "member" || f.kind === "profile") {
          const entry = {
            id: f.kind === "profile" ? "self" : key,
            name: f.name.trim(),
            relation: f.note,
          };
          return {
            ...s,
            members:
              f.id || f.kind === "profile"
                ? s.members.map((m) => (m.id === entry.id ? entry : m))
                : [...s.members, entry],
          };
        }
        if (f.kind === "metric")
          return {
            ...s,
            metrics: [
              ...s.metrics,
              {
                id: key,
                memberId: member,
                kind: f.category as Metric["kind"],
                value: digits(f.name),
                date: digits(f.date),
              },
            ],
          };
        const entry: RecordItem = {
          id: key,
          memberId: member,
          name: f.name.trim(),
          date: digits(f.date),
          note: f.note,
          attachment,
          results:
            f.kind === "lab" && f.results.trim()
              ? f.results
                  .trim()
                  .split("\n")
                  .map((line) => {
                    const [label, value, unit = "", range = ""] = line
                      .split("|")
                      .map((x) => x.trim());
                    return { label, value, unit, range };
                  })
              : undefined,
          kind: f.kind === "lab" ? "lab" : (f.category as RecordItem["kind"]),
        };
        return {
          ...s,
          records: f.id
            ? s.records.map((r) => (r.id === f.id ? entry : r))
            : [...s.records, entry],
        };
      });
      setForm(null);
      discardPendingFiles();
    } catch {
      setMessage(
        t(
          "ذخیره کامل نشد؛ دوباره تلاش کنید.",
          "Could not complete the save. Try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const editMedicine = () => {
    if (medicine)
      setForm({
        ...blankForm("medicine"),
        id: medicine.id,
        name: medicine.name,
        note: medicine.dose,
        time: medicine.time,
        stock: String(medicine.stock),
      });
  };
  const editVisit = () => {
    if (visit)
      setForm({
        ...blankForm("appointment"),
        id: visit.id,
        name: visit.name,
        note: visit.note,
        time: visit.time || "08:00",
        date: visit.date,
        category: visit.specialty || "",
        location: visit.location || "",
        phone: visit.phone || "",
      });
  };
  function field(
    key: keyof Form,
    label: string,
    placeholder = "",
    numeric = false,
    multiline = false,
  ) {
    return (
      <View style={{ marginBottom: 13 }}>
        <Label muted size={12} style={{ marginBottom: 5 }}>
          {label}
        </Label>
        <TextInput
          accessibilityLabel={label}
          value={String(form?.[key] || "")}
          onChangeText={(v) => change(key, v)}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={numeric ? "decimal-pad" : "default"}
          multiline={multiline}
          maxLength={multiline ? 2000 : 160}
          style={[
            uiStyles.input,
            {
              textAlign: fa ? "right" : "left",
              color: colors.text,
              backgroundColor: colors.soft,
              borderColor: colors.line,
              minHeight: multiline ? 100 : 49,
              fontWeight: numeric ? "500" : "400",
            },
          ]}
        />
      </View>
    );
  }
  const isIntro =
    auth.recovery ||
    ["splash", "onboarding", "login"].includes(section) ||
    (!state.welcomed && section === "home" && !demo);
  const introPage = auth.recovery
    ? "login"
    : !state.welcomed && section === "home"
      ? "splash"
      : section;
  function renderIntro() {
    if (introPage === "splash")
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 30,
          }}
        >
          <Brand size={120} />
          <Text
            style={{
              fontSize: 40,
              fontWeight: "700",
              color: colors.text,
              marginTop: 18,
            }}
          >
            {t("سلامت‌یار", "SalamatYar")}
          </Text>
          <Label style={{ textAlign: "center", marginTop: 12 }}>
            {t(
              "همراه هوشمند سلامت شما\nو خانواده‌تان",
              "Your everyday health companion\nfor the whole family",
            )}
          </Label>
          <View style={{ width: "100%", marginTop: 65 }}>
            <Button
              title={t("شروع کنید", "Get started")}
              onPress={() => go("onboarding", "0")}
            />
            <Button
              secondary
              title={t("مشاهده قالب با داده نمونه", "Explore the demo")}
              onPress={() => {
                setDemo(true);
                home();
              }}
            />
          </View>
          <Tap
            onPress={() =>
              update((s) => ({ ...s, language: fa ? "en" : "fa" }))
            }
          >
            <Label muted size={12}>
              فارسی / English
            </Label>
          </Tap>
        </View>
      );
    if (introPage === "onboarding") {
      const step = Math.min(2, Math.max(0, Number(item) || 0));
      return (
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <View style={{ alignItems: "center" }}>
            <Illustration
              kind={(["doctor", "checklist", "family"] as const)[step]}
            />
          </View>
          <Label
            size={24}
            weight="700"
            style={{ textAlign: "center", marginTop: 32 }}
          >
            {
              [
                t("مدیریت ساده‌تر سلامت", "Health, simply organized"),
                t("یادآوری هوشمند", "Remember what matters"),
                t("سلامت همه خانواده", "Care for the whole family"),
              ][step]
            }
          </Label>
          <Label muted style={{ textAlign: "center", marginTop: 12 }}>
            {
              [
                t(
                  "داروها، نوبت‌ها، آزمایش‌ها و سوابق پزشکی\nهمیشه همراه شما",
                  "Medicines, visits, tests and records.\nAlways together.",
                ),
                t(
                  "برنامه داروهای ثبت‌شده و نوبت‌ها\nرا در یک جا ببینید",
                  "Keep your recorded medicines\nand appointments in one place.",
                ),
                t(
                  "مدیریت چند عضو خانواده در یک جا\nبا رضایت خودشان",
                  "Separate profiles for your family,\nwith their permission.",
                ),
              ][step]
            }
          </Label>
          <Row style={{ justifyContent: "center", marginVertical: 30 }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  height: 6,
                  width: i === step ? 22 : 6,
                  borderRadius: 4,
                  backgroundColor: i === step ? colors.blue : colors.line,
                }}
              />
            ))}
          </Row>
          <Button
            title={
              step === 2 ? t("شروع کنید", "Let’s begin") : t("بعدی", "Next")
            }
            onPress={() =>
              step === 2 ? go("login") : go("onboarding", String(step + 1))
            }
          />
          <Button
            secondary
            title={t("ورود بدون حساب", "Continue without an account")}
            onPress={() => {
              update((s) => ({ ...s, welcomed: true }));
              home();
            }}
          />
        </View>
      );
    }
    return <Account />;
  }
  function renderHome() {
    return (
      <>
        <LinearGradient
          colors={dark ? ["#172A43", colors.bg] : ["#DFF0FF", colors.bg]}
          style={{ margin: -20, marginBottom: 18, padding: 20, paddingTop: 10 }}
        >
          <Row style={{ justifyContent: "space-between", marginBottom: 18 }}>
            <View>
              <Label weight="700" size={21}>
                {t("سلام " + personName + " 👋", "Hello " + personName + " 👋")}
              </Label>
              <Label muted size={11}>
                {fmt(day)}
              </Label>
            </View>
            <Avatar />
          </Row>
          {search(
            t(
              "جستجو در داروها، نوبت‌ها، آزمایش‌ها ...",
              "Search medicines, visits and records ...",
            ),
          )}
          <Row style={{ gap: 8 }}>
            {[
              [Pill, "medicines", t("داروها", "Medicines"), "#FFF0E7"],
              [CalendarDays, "appointments", t("نوبت‌ها", "Visits"), "#E9FBF5"],
              [FlaskConical, "labs", t("آزمایش‌ها", "Tests"), "#F5EAFF"],
              [FileText, "records", t("سوابق", "Records"), "#E9F4FF"],
            ].map(([I, page, label, bg]) => (
              <Tap
                key={String(page)}
                onPress={() => go(String(page))}
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  paddingVertical: 12,
                  borderRadius: 15,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.line,
                }}
              >
                {iconBox(I as Icon, colors.blue, String(bg))}
                <Label size={10} style={{ marginTop: 6 }}>
                  {String(label)}
                </Label>
              </Tap>
            ))}
          </Row>
        </LinearGradient>
        {query ? (
          <>
            {sectionTitle(t("نتایج جستجو", "Search results"))}
            {meds
              .filter((m) => m.name.includes(query))
              .map((m, i) => medRow(m, false, i))}
            {visits.filter((v) => v.name.includes(query)).map(visitRow)}
            {records.filter((r) => r.name.includes(query)).map(recordRow)}
          </>
        ) : (
          <>
            <Card>
              {sectionTitle(t("داروهای امروز", "Today’s medicines"), () =>
                go("medicines"),
              )}
              <Row style={{ justifyContent: "space-between" }}>
                <Label muted size={11}>
                  {t("انجام‌شده", "Completed")}
                </Label>
                <Label weight="500" size={12}>
                  {num(done)} / {num(meds.length)}
                </Label>
              </Row>
              <View
                style={{
                  height: 5,
                  backgroundColor: colors.line,
                  borderRadius: 4,
                  marginVertical: 12,
                }}
              >
                <View
                  style={{
                    height: 5,
                    width: `${meds.length ? (done / meds.length) * 100 : 0}%`,
                    backgroundColor: "#53D9B3",
                    borderRadius: 4,
                  }}
                />
              </View>
              {meds.length ? (
                meds.map((m, i) => medRow(m, true, i))
              ) : (
                <Button
                  secondary
                  title={t(
                    "اولین داروی خود را ثبت کنید",
                    "Add your first medicine",
                  )}
                  onPress={() => open("medicine")}
                />
              )}
            </Card>
            {sectionTitle(t("نوبت‌های پیش رو", "Upcoming visits"), () =>
              go("appointments"),
            )}
            {visits
              .filter((v) => v.date >= day && !v.cancelled)
              .slice(0, 2)
              .map(visitRow)}
            {!visits.length &&
              empty(
                t("هنوز نوبتی ثبت نشده است.", "No appointments yet."),
                CalendarDays,
              )}
            <Row>
              {[
                [Heart, "metrics", t("شاخص‌های سلامتی", "Health indicators")],
                [Users, "family", t("مراقبت خانواده", "Family care")],
              ].map(([I, page, label]) => (
                <View key={String(page)} style={{ flex: 1 }}>
                  <Card
                    onPress={() => go(String(page))}
                    style={{ alignItems: "center" }}
                  >
                    {iconBox(I as Icon)}
                    <Label size={11} style={{ marginTop: 8 }}>
                      {String(label)}
                    </Label>
                  </Card>
                </View>
              ))}
            </Row>
            <Button
              secondary
              title={t(
                "مشاهده همه صفحه‌های قالب",
                "Explore all template screens",
              )}
              onPress={() => go("gallery")}
            />
          </>
        )}
      </>
    );
  }
  function renderMedicine() {
    if (!medicine) return empty(t("دارو پیدا نشد.", "Medicine not found."));
    return (
      <>
        <Card>
          <Row>
            {iconBox(Pill, "#28A1FF", "#E9F6FF")}
            <View style={{ flex: 1 }}>
              <Label size={19} weight="600">
                {medicine.name}
              </Label>
              <Label muted>{medicine.dose}</Label>
              <Label muted size={11}>
                {t("موجودی: ", "Stock: ")}
                {num(medicine.stock)}
              </Label>
            </View>
          </Row>
        </Card>
        {sectionTitle(t("یادآوری‌ها", "Reminders"))}
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Label weight="500">{num(medicine.time)}</Label>
            <Switch
              disabled={busy || demo}
              value={!!medicine.notificationId}
              onValueChange={() => toggleReminder(medicine)}
              trackColor={{ true: colors.blue }}
            />
          </Row>
          <Label muted size={11}>
            {t(
              "تکرار روزانه · هر نوبت یک واحد موجودی",
              "Daily repeat · one stock unit per intake",
            )}
          </Label>
        </Card>
        <Button
          secondary
          title={
            medicine.history.includes(day)
              ? t("✓ امروز انجام شد · لغو ثبت", "✓ Taken today · Undo")
              : t("ثبت مصرف امروز", "Mark taken today")
          }
          onPress={() => take(medicine)}
        />
        {[
          [
            ClipboardList,
            t("اطلاعات دارو", "Medicine information"),
            medicine.dose,
          ],
          [
            ShieldCheck,
            t("نکات مهم", "Important notes"),
            t(
              "این برنامه فقط دستور ثبت‌شده شما را نگه می‌دارد و دوز یا توصیه درمانی ارائه نمی‌کند.",
              "This app stores your recorded instructions. It does not give dosing or treatment advice.",
            ),
          ],
        ].map(([I, title, body]) => (
          <Card key={String(title)}>
            <Row>
              {iconBox(I as Icon)}
              <Label weight="600">{String(title)}</Label>
            </Row>
            <Label muted size={12} style={{ marginTop: 12 }}>
              {String(body)}
            </Label>
          </Card>
        ))}
        <Button
          title={t("ویرایش دارو و موجودی", "Edit medicine & stock")}
          onPress={editMedicine}
        />
        <Button
          danger
          title={t("حذف دارو", "Delete medicine")}
          onPress={() =>
            setConfirm({
              text: t(
                "دارو و سابقه مصرف آن حذف شود؟",
                "Delete this medicine and its history?",
              ),
              action: async () => {
                await cancelReminder(medicine.notificationId);
                update((s) => ({
                  ...s,
                  medicines: s.medicines.filter((m) => m.id !== medicine.id),
                }));
                go("medicines");
              },
            })
          }
        />
      </>
    );
  }
  function renderAppointment() {
    if (!visit) return empty(t("نوبت پیدا نشد.", "Appointment not found."));
    return (
      <>
        <View style={{ alignItems: "center", marginVertical: 20 }}>
          <Avatar size={70} />
          <Label weight="600" size={20} style={{ marginTop: 12 }}>
            {visit.name}
          </Label>
          <Label muted>{visit.specialty}</Label>
          {visit.cancelled && badge(t("لغو شده", "Cancelled"))}
        </View>
        <Card>
          {[
            [CalendarDays, fmt(visit.date)],
            [Clock, num(visit.time || "—")],
            [
              MapPin,
              visit.location || t("محل ثبت نشده", "No location recorded"),
            ],
          ].map(([I, value]) => (
            <Row key={String(value)} style={{ paddingVertical: 12 }}>
              {iconBox(I as Icon)}
              <Label>{String(value)}</Label>
            </Row>
          ))}
        </Card>
        <Row>
          {[
            [
              MapPin,
              t("نقشه", "Map"),
              () =>
                visit.location
                  ? Linking.openURL(
                      "https://www.google.com/maps/search/?api=1&query=" +
                        encodeURIComponent(visit.location),
                    ).catch(() =>
                      setMessage(t("نقشه باز نشد.", "Could not open maps.")),
                    )
                  : setMessage(t("آدرس ثبت نشده است.", "No address recorded.")),
            ],
            [
              Phone,
              t("تماس", "Call"),
              () =>
                visit.phone
                  ? Linking.openURL("tel:" + visit.phone).catch(() =>
                      setMessage(
                        t(
                          "تماس در این دستگاه ممکن نیست.",
                          "Calling is unavailable on this device.",
                        ),
                      ),
                    )
                  : setMessage(
                      t("شماره‌ای ثبت نشده است.", "No phone number recorded."),
                    ),
            ],
            [Pencil, t("ویرایش", "Edit"), editVisit],
          ].map(([I, label, action]) => (
            <View key={String(label)} style={{ flex: 1 }}>
              <Card
                onPress={action as () => void}
                style={{ alignItems: "center" }}
              >
                {iconBox(I as Icon)}
                <Label size={12}>{String(label)}</Label>
              </Card>
            </View>
          ))}
        </Row>
        <Card>
          <Label muted>
            {visit.note || t("توضیحی ثبت نشده است.", "No notes recorded.")}
          </Label>
        </Card>
        {!visit.cancelled && (
          <Button
            secondary
            disabled={busy || demo}
            title={
              visit.notificationId
                ? t("خاموش کردن یادآوری نوبت", "Disable visit reminder")
                : t("یادآوری در زمان نوبت", "Remind at appointment time")
            }
            onPress={async () => {
              setBusy(true);
              try {
                let notificationId: string | undefined;
                if (visit.notificationId)
                  await cancelReminder(visit.notificationId);
                else
                  notificationId = await scheduleVisit(
                    visit.date,
                    visit.time || "08:00",
                    state.language,
                    `visit:${auth.session?.user.id || "guest"}:${visit.id}`,
                  );
                update((s) => ({
                  ...s,
                  appointments: s.appointments.map((v) =>
                    v.id === visit.id ? { ...v, notificationId } : v,
                  ),
                }));
              } catch {
                setMessage(
                  t(
                    "یادآوری فعال نشد؛ زمان باید در آینده باشد و مجوز اعلان اندروید فعال باشد.",
                    "Reminder failed. Use a future time and allow Android notifications.",
                  ),
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
        <Button
          danger
          title={
            visit.cancelled
              ? t("بازگرداندن نوبت", "Restore appointment")
              : t("لغو نوبت", "Cancel appointment")
          }
          onPress={() =>
            setConfirm({
              text: t(
                "فقط وضعیت ثبت محلی تغییر می‌کند؛ پیامی به مطب ارسال نمی‌شود.",
                "Only the local record changes. No message is sent to the clinic.",
              ),
              action: async () => {
                await cancelReminder(visit.notificationId);
                update((s) => ({
                  ...s,
                  appointments: s.appointments.map((v) =>
                    v.id === visit.id
                      ? {
                          ...v,
                          cancelled: !v.cancelled,
                          notificationId: undefined,
                        }
                      : v,
                  ),
                }));
              },
            })
          }
        />
      </>
    );
  }
  function renderLab() {
    if (!record) return empty(t("مدرک پیدا نشد.", "Record not found."));
    return (
      <>
        <View style={{ alignItems: "center", marginVertical: 14 }}>
          {iconBox(record.kind === "lab" ? FlaskConical : FileText)}
          <Label weight="600" size={18} style={{ marginTop: 12 }}>
            {record.name}
          </Label>
          <Label muted size={12}>
            {fmt(record.date)}
          </Label>
        </View>
        {chips(
          [
            t("خلاصه", "Overview"),
            t("مقادیر", "Values"),
            t("توضیحات", "Notes"),
          ],
          subtab,
          setSubtab,
        )}
        {subtab !== 2 && record.results?.length ? (
          <Card>
            <Row style={{ justifyContent: "space-between", paddingBottom: 12 }}>
              <Label weight="600" size={12}>
                {t("شاخص", "Test")}
              </Label>
              <Label weight="600" size={12}>
                {t("مقدار", "Value")}
              </Label>
              <Label weight="600" size={12}>
                {t("بازه ثبت‌شده", "Recorded range")}
              </Label>
            </Row>
            {record.results.map((r) => (
              <Row
                key={r.label}
                style={{
                  justifyContent: "space-between",
                  borderTopWidth: 1,
                  borderColor: colors.line,
                  paddingVertical: 12,
                }}
              >
                <Label size={12} style={{ flex: 1 }}>
                  {r.label}
                </Label>
                <Label
                  size={13}
                  weight="500"
                  style={{ flex: 1, textAlign: "center" }}
                >
                  {r.value}
                </Label>
                <Label size={10} muted style={{ flex: 1 }}>
                  {r.range} {r.unit}
                </Label>
              </Row>
            ))}
          </Card>
        ) : subtab === 1 ? (
          empty(
            t(
              "هنوز مقدار ساختاریافته‌ای ثبت نشده است.",
              "No structured values recorded.",
            ),
          )
        ) : null}
        {subtab !== 1 && (
          <Card>
            <Label>{record.note || t("بدون یادداشت", "No notes")}</Label>
          </Card>
        )}
        <Card style={{ backgroundColor: dark ? colors.soft : "#EAFBF5" }}>
          <Row>
            <Info color={colors.green} size={20} />
            <Label size={11} style={{ flex: 1 }}>
              {t(
                "مقادیر ثبت‌شده تفسیر یا تشخیص خودکار نمی‌شوند.",
                "Recorded values are not automatically interpreted or diagnosed.",
              )}
            </Label>
          </Row>
        </Card>
        {record.attachment && (
          <Button
            title={t("باز کردن / اشتراک فایل", "Open / share attachment")}
            onPress={() =>
              openAttachment(record.attachment!).catch(() =>
                setMessage(
                  t(
                    "فایل باز نشد؛ اتصال و حساب مالک را بررسی کنید.",
                    "Could not open file. Check connection and owner account.",
                  ),
                ),
              )
            }
          />
        )}
        <Button
          secondary
          title={t("ویرایش مدرک", "Edit record")}
          onPress={() =>
            setForm({
              ...blankForm(record.kind === "lab" ? "lab" : "record"),
              id: record.id,
              name: record.name,
              note: record.note,
              date: record.date,
              category: record.kind || "note",
              attachment: record.attachment,
              results:
                record.results
                  ?.map((r) => [r.label, r.value, r.unit, r.range].join(" | "))
                  .join("\n") || "",
            })
          }
        />
        <Button
          danger
          title={t("حذف مدرک", "Delete record")}
          onPress={() =>
            setConfirm({
              text: t("این یادداشت حذف شود؟", "Delete this record?"),
              action: async () => {
                await deleteAttachment(record.attachment);
                update((s) => ({
                  ...s,
                  records: s.records.filter((r) => r.id !== record.id),
                }));
                go("records");
              },
            })
          }
        />
      </>
    );
  }
  function renderMetrics() {
    const metricDefs = [
      ["pressure", Heart, t("فشار خون", "Blood pressure"), "mmHg", "#FD697A"],
      ["glucose", Droplet, t("قند خون", "Blood glucose"), "mg/dL", "#985BFF"],
      ["weight", Weight, t("وزن", "Weight"), "kg", "#2EBE99"],
    ] as const;
    return (
      <>
        {chips(
          [t("هفته", "Week"), t("ماه", "Month"), t("همه", "All")],
          filter,
          setFilter,
        )}
        {metricDefs.map(([kind, I, title, unit, color]) => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - (filter === 0 ? 6 : 29));
          const values = state.metrics
            .filter(
              (m) =>
                m.memberId === member &&
                m.kind === kind &&
                (filter === 2 || m.date >= localDay(cutoff)),
            )
            .sort((a, b) => a.date.localeCompare(b.date));
          const last = values[values.length - 1];
          const nums = values
            .slice(-12)
            .map((v) => Number(v.value.split("/")[0]));
          const min = Math.min(...nums) - 1,
            max = Math.max(...nums) + 1;
          const path = nums
            .map(
              (n, i) =>
                `${i ? "L" : "M"} ${10 + (i * 160) / Math.max(1, nums.length - 1)} ${65 - ((n - min) / (max - min)) * 45}`,
            )
            .join(" ");
          return (
            <Card key={kind}>
              <Row style={{ justifyContent: "space-between" }}>
                {iconBox(I, color, color + "18")}
                <Label weight="600">{title}</Label>
              </Row>
              <Row style={{ justifyContent: "space-between", marginTop: 15 }}>
                <View>
                  <Label size={27} weight="500">
                    {last ? num(last.value) : "—"}
                  </Label>
                  <Label muted size={11}>
                    {unit}
                  </Label>
                </View>
                <Svg width={180} height={80}>
                  <Path d={path} stroke={color} strokeWidth={2} fill="none" />
                </Svg>
              </Row>
              <Label size={10} muted>
                {last
                  ? fmt(last.date)
                  : t("هنوز اندازه‌گیری ثبت نشده است.", "No measurements yet.")}
              </Label>
            </Card>
          );
        })}
        <Button
          title={t("＋ ثبت اندازه‌گیری", "＋ Add measurement")}
          onPress={() => open("metric")}
        />
        <Label size={11} muted>
          {t(
            "نمودار فقط مقادیر واردشده را نمایش می‌دهد.",
            "Charts show only the values you enter.",
          )}
        </Label>
      </>
    );
  }
  function menu(I: Icon, label: string, action: () => void, detail?: string) {
    return (
      <Tap key={label} onPress={action}>
        <Row
          style={{
            paddingVertical: 15,
            borderBottomWidth: 1,
            borderColor: colors.line,
          }}
        >
          <I color={colors.blue} size={19} />
          <View style={{ flex: 1 }}>
            <Label size={13}>{label}</Label>
            {detail && (
              <Label muted size={10}>
                {detail}
              </Label>
            )}
          </View>
          <ChevronLeft size={16} color={colors.muted} />
        </Row>
      </Tap>
    );
  }
  function renderSettings() {
    return (
      <>
        <Row style={{ marginBottom: 20 }}>
          <Avatar size={60} />
          <View style={{ flex: 1 }}>
            <Label weight="600" size={19}>
              {state.members[0]?.name || t("پروفایل من", "My profile")}
            </Label>
            <Label muted size={11}>
              {auth.session
                ? auth.session.user.email
                : t(
                    "حساب محلی · روی این دستگاه",
                    "Local profile · on this device",
                  )}
            </Label>
          </View>
        </Row>
        <Card>
          {menu(Pencil, t("ویرایش اطلاعات", "Edit profile"), () =>
            setForm({
              ...blankForm("profile"),
              name: state.members[0]?.name || "",
              note: state.members[0]?.relation || "",
            }),
          )}
          {menu(
            User,
            t("زبان", "Language"),
            () => update((s) => ({ ...s, language: fa ? "en" : "fa" })),
            fa ? "فارسی" : "English",
          )}
          {menu(
            CalendarDays,
            t("تقویم", "Calendar"),
            () =>
              update((s) => ({
                ...s,
                calendar: s.calendar === "persian" ? "gregory" : "persian",
              })),
            state.calendar === "persian"
              ? t("شمسی", "Persian")
              : t("میلادی", "Gregorian"),
          )}
          {menu(
            SunMoon,
            t("حالت نمایش", "Appearance"),
            () => update((s) => ({ ...s, theme: dark ? "light" : "dark" })),
            dark ? t("تیره", "Dark") : t("روشن", "Light"),
          )}
          {menu(Bell, t("اعلان‌ها", "Notifications"), () =>
            go("notifications"),
          )}
          {menu(
            ShieldCheck,
            t("امنیت و حریم خصوصی", "Privacy & security"),
            () => go("privacy"),
          )}
          {menu(
            ArrowDownToLine,
            t("پشتیبان‌گیری از اطلاعات", "Data backup"),
            () => go("backup"),
          )}
        </Card>
        <Card>
          {menu(Activity, t("شاخص‌های سلامتی", "Health indicators"), () =>
            go("metrics"),
          )}
          {menu(BookOpen, t("محتوای آموزشی", "Learning library"), () =>
            go("articles"),
          )}
          {menu(MapPin, t("مراکز درمانی", "Care centers"), () => go("centers"))}
          {menu(
            ClipboardList,
            t("نمایش همه صفحه‌های قالب", "All template screens"),
            () => go("gallery"),
          )}
          {menu(Info, t("نمایش معرفی برنامه", "App introduction"), () =>
            go("onboarding", "0"),
          )}
        </Card>
        <Button
          secondary
          title={
            demo
              ? t("خروج از حالت نمونه", "Leave demo")
              : t("مشاهده قالب با داده نمونه", "Explore demo data")
          }
          onPress={() => {
            setDemo(!demo);
            home();
          }}
        />
        {auth.session ? (
          <>
            <Label size={11} muted>
              {t("وضعیت ذخیره: ", "Save status: ")}
              {syncStatus}
            </Label>
            <Button
              disabled={syncStatus === "saving"}
              secondary
              title={t("خروج از حساب", "Sign out")}
              onPress={() => {
                void auth
                  .signOut()
                  .then(home)
                  .catch(() =>
                    setMessage(t("خروج انجام نشد.", "Sign out failed.")),
                  );
              }}
            />
          </>
        ) : (
          <Button
            secondary
            title={t("ورود / ثبت‌نام", "Sign in / Register")}
            onPress={() => go("login")}
          />
        )}
      </>
    );
  }
  function renderCenters() {
    return <Nearby />;
  }
  function renderContent() {
    if (section === "home") return renderHome();
    if (section === "medicines")
      return (
        <>
          {search(t("جستجوی نام دارو ...", "Search medicines ..."))}
          {chips(
            [
              t("همه", "All"),
              t("در حال مصرف", "In stock"),
              t("پایان‌یافته", "Empty"),
            ],
            filter,
            setFilter,
          )}
          {meds
            .filter(
              (m) =>
                (!query || m.name.includes(query)) &&
                (filter === 0 ||
                  (filter === 1 && m.stock > 0) ||
                  (filter === 2 && m.stock === 0)),
            )
            .map((m, i) => medRow(m, false, i))}
          {!meds.length &&
            empty(t("دارویی ثبت نشده است.", "No medicines yet."), Pill)}
          <Button
            title={t("افزودن دارو", "Add medicine")}
            onPress={() => open("medicine")}
          />
        </>
      );
    if (section === "medicine") return renderMedicine();
    if (section === "appointments")
      return (
        <>
          {chips(
            [t("همه", "All"), t("آتی", "Upcoming"), t("گذشته", "Past")],
            filter,
            setFilter,
          )}
          {visits
            .filter(
              (v) =>
                filter === 0 ||
                (filter === 1 && v.date >= day && !v.cancelled) ||
                (filter === 2 && v.date < day),
            )
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(visitRow)}
          {!visits.length &&
            empty(
              t("نوبتی ثبت نشده است.", "No appointments yet."),
              CalendarDays,
            )}
          <Button
            title={t("نوبت جدید", "New appointment")}
            onPress={() => open("appointment")}
          />
        </>
      );
    if (section === "appointment") return renderAppointment();
    if (section === "labs" || section === "records")
      return (
        <>
          {chips(
            section === "labs"
              ? [
                  t("همه", "All"),
                  t("دارای مقادیر", "With values"),
                  t("یادداشت", "Notes"),
                ]
              : [
                  t("همه", "All"),
                  t("نسخه‌ها", "Prescriptions"),
                  t("آزمایش‌ها", "Tests"),
                  t("تصاویر", "Images"),
                ],
            filter,
            setFilter,
          )}
          {records
            .filter((r) =>
              section === "labs"
                ? r.kind === "lab" &&
                  (filter === 0 ||
                    (filter === 1 && r.results?.length) ||
                    (filter === 2 && !r.results?.length))
                : filter === 0 ||
                  r.kind === ["", "prescription", "lab", "image"][filter],
            )
            .map(recordRow)}
          {!records.length &&
            empty(t("مدرکی ثبت نشده است.", "No records yet."), FileText)}
          <Button
            title={
              section === "labs"
                ? t("افزودن آزمایش", "Add lab test")
                : t("افزودن مدرک", "Add record")
            }
            onPress={() => open(section === "labs" ? "lab" : "record")}
          />
        </>
      );
    if (section === "lab" || section === "record") return renderLab();
    if (section === "family")
      return (
        <>
          {state.members.map((m, i) => (
            <Card key={m.id} onPress={() => go("member", m.id, m.id)}>
              <Row>
                <Avatar index={i} />
                <View style={{ flex: 1 }}>
                  <Label weight="600">{m.name || t("من", "Me")}</Label>
                  <Label muted size={11}>
                    {m.relation || t("مدیریت حساب", "Personal profile")}
                  </Label>
                </View>
                <ChevronLeft color={colors.blue} size={18} />
              </Row>
            </Card>
          ))}
          <Button
            title={t("افزودن عضو خانواده", "Add family member")}
            onPress={() => open("member")}
          />
        </>
      );
    if (section === "member")
      return (
        <>
          <Row style={{ marginBottom: 20 }}>
            <Avatar
              index={state.members.findIndex((m) => m.id === member)}
              size={65}
            />
            <View>
              <Label weight="600" size={22}>
                {personName}
              </Label>
              <Label muted>{person.relation}</Label>
            </View>
          </Row>
          {chips(
            [
              t("اطلاعات", "Info"),
              t("داروها", "Medicines"),
              t("نوبت‌ها", "Visits"),
              t("آزمایش‌ها", "Tests"),
            ],
            subtab,
            setSubtab,
          )}
          {subtab === 0 ? (
            <>
              <Card>
                {menu(Heart, t("شاخص‌های سلامتی", "Health indicators"), () =>
                  go("metrics"),
                )}
                {menu(Pencil, t("ویرایش عضو", "Edit profile"), () =>
                  setForm({
                    ...blankForm("member"),
                    id: person.id,
                    name: person.name,
                    note: person.relation,
                    consent: true,
                  }),
                )}
              </Card>
              <Label muted size={12}>
                {t(
                  "این اطلاعات فقط روی همین دستگاه نگهداری می‌شود.",
                  "This profile is stored only on this device.",
                )}
              </Label>
            </>
          ) : subtab === 1 ? (
            <>
              {meds.map((m, i) => medRow(m, false, i))}
              <Button
                title={t("افزودن دارو", "Add medicine")}
                onPress={() => open("medicine")}
              />
            </>
          ) : subtab === 2 ? (
            <>
              {visits.map(visitRow)}
              <Button
                title={t("ثبت نوبت", "Add visit")}
                onPress={() => open("appointment")}
              />
            </>
          ) : (
            <>
              {records.filter((r) => r.kind === "lab").map(recordRow)}
              <Button
                title={t("افزودن آزمایش", "Add test")}
                onPress={() => open("lab")}
              />
            </>
          )}
        </>
      );
    if (section === "metrics") return renderMetrics();
    if (section === "settings") return renderSettings();
    if (section === "centers") return renderCenters();
    if (section === "reminders" || section === "notifications")
      return (
        <>
          {chips(
            [
              t("همه", "All"),
              t("داروها", "Medicines"),
              t("نوبت‌ها", "Visits"),
              t("آزمایش‌ها", "Tests"),
            ],
            filter,
            setFilter,
          )}
          {(filter === 0 || filter === 1) &&
            meds.map((m, i) => (
              <Card key={m.id} onPress={() => go("medicine", m.id)}>
                <Row>
                  {iconBox(section === "notifications" ? Bell : Pill)}
                  <View style={{ flex: 1 }}>
                    <Label weight="600" size={13}>
                      {section === "notifications"
                        ? t("زمان مصرف دارو", "Medicine schedule")
                        : m.name}
                    </Label>
                    <Label muted size={11}>
                      {section === "notifications" ? m.name + " · " : ""}
                      {num(m.time)}
                    </Label>
                  </View>
                  {badge(
                    m.history.includes(day)
                      ? t("انجام شد", "Done")
                      : m.notificationId
                        ? t("فعال", "Enabled")
                        : t("اعلان خاموش", "Reminder off"),
                    m.history.includes(day),
                  )}
                </Row>
              </Card>
            ))}
          {(filter === 0 || filter === 2) &&
            visits.filter((v) => !v.cancelled).map(visitRow)}
          {(filter === 0 || filter === 3) &&
            records.filter((r) => r.kind === "lab").map(recordRow)}
          {!meds.length &&
            !visits.length &&
            !records.length &&
            empty(
              t("هنوز برنامه‌ای ثبت نشده است.", "No care items yet."),
              Bell,
            )}
          <Label muted size={11}>
            {t(
              "این فهرست از برنامه‌های ثبت‌شده ساخته می‌شود؛ اعلان ارسال‌شده محسوب نمی‌شود.",
              "This list reflects saved care plans; it is not a log of delivered notifications.",
            )}
          </Label>
        </>
      );
    if (section === "articles")
      return (
        <>
          {search(t("جستجو در مقاله‌ها ...", "Search articles ..."))}
          {chips(
            [t("همه", "All"), t("تغذیه", "Food"), t("سبک زندگی", "Lifestyle")],
            filter,
            setFilter,
          )}
          {articles
            .filter(
              (a) =>
                (!query || (fa ? a.fa : a.en).includes(query)) &&
                (filter === 0 ||
                  (filter === 1 && a.id === "food") ||
                  (filter === 2 && a.id !== "food")),
            )
            .map((a) => (
              <Card key={a.id} onPress={() => go("article", a.id)}>
                <Row>
                  <View
                    style={{
                      width: 65,
                      height: 70,
                      backgroundColor: colors.soft,
                      borderRadius: 13,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 35 }}>{a.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label weight="600" size={13}>
                      {fa ? a.fa : a.en}
                    </Label>
                    <Label muted size={10}>
                      {t("راهنمای استفاده · ۲ دقیقه", "App guide · 2 min read")}
                    </Label>
                  </View>
                </Row>
              </Card>
            ))}
        </>
      );
    if (section === "article") {
      const a = articles.find((a) => a.id === item);
      return a ? (
        <>
          <View
            style={{
              alignItems: "center",
              padding: 30,
              backgroundColor: colors.soft,
              borderRadius: 22,
            }}
          >
            <Text style={{ fontSize: 80 }}>{a.icon}</Text>
          </View>
          <Label size={24} weight="700" style={{ marginVertical: 20 }}>
            {fa ? a.fa : a.en}
          </Label>
          <Label>{fa ? a.body : a.english}</Label>
          <Label muted size={11} style={{ marginTop: 30 }}>
            {t(
              "راهنمای سازمان‌دهی اطلاعات؛ توصیه پزشکی نیست.",
              "Information organization guide; not medical advice.",
            )}
          </Label>
        </>
      ) : (
        empty(t("مقاله پیدا نشد.", "Article not found."))
      );
    }
    if (section === "privacy")
      return (
        <>
          <Card>
            {iconBox(ShieldCheck)}
            <Label weight="600" size={18} style={{ marginTop: 15 }}>
              {t("حریم خصوصی در نسخه اولیه", "Privacy in this prototype")}
            </Label>
            <Label muted style={{ marginTop: 12 }}>
              {t(
                "در حالت مهمان داده‌ها روی دستگاه ذخیره می‌شوند. پس از ورود، اطلاعات در فضای خصوصی حساب روی Supabase ذخیره می‌شوند. توکن ورود اندروید در فضای امن دستگاه است؛ قفل زیستی فعال نیست.",
                "Guest data stays on-device. Signed-in data is saved to your private Supabase account. Android session tokens use secure storage. Biometric locking is not enabled.",
              )}
            </Label>
          </Card>
          <Card>
            <Label>
              {t(
                "اعلان دارو نام و اطلاعات پزشکی را روی صفحه قفل نمایش نمی‌دهد. پروفایل خانواده به معنی اشتراک‌گذاری آنلاین نیست.",
                "Medication notifications use generic text. Family profiles do not provide online sharing.",
              )}
            </Label>
          </Card>
        </>
      );
    if (section === "backup") return <Backup />;
    if (section === "gallery")
      return (
        <>
          <Label muted size={12} style={{ marginBottom: 16 }}>
            {t(
              "تمام صفحه‌های تصویر مرجع، با مسیرهای متصل",
              "The reference screens, with connected navigation",
            )}
          </Label>
          {!demo && (
            <Button
              title={t("نمایش با داده نمونه", "Preview with sample data")}
              onPress={() => setDemo(true)}
            />
          )}
          <Card>
            {[
              ["splash", Heart, t("اسپلش", "Splash")],
              [
                "onboarding",
                Users,
                t("سه صفحه معرفی", "Three onboarding screens"),
              ],
              ["login", User, t("ورود و ثبت‌نام", "Sign in & sign up")],
              ["home", Home, t("خانه", "Home")],
              [
                "medicines",
                Pill,
                t("لیست و جزئیات دارو", "Medicine list & details"),
              ],
              ["reminders", Bell, t("یادآوری‌ها", "Reminders")],
              [
                "appointments",
                CalendarDays,
                t("لیست و جزئیات نوبت", "Appointments & details"),
              ],
              [
                "labs",
                FlaskConical,
                t("آزمایش و نتایج", "Lab tests & results"),
              ],
              ["records", FileText, t("سوابق پزشکی", "Medical records")],
              ["family", Users, t("خانواده و پرونده اعضا", "Family profiles")],
              ["metrics", Activity, t("نمودار شاخص‌ها", "Health charts")],
              ["settings", Settings, t("تنظیمات", "Settings")],
              ["notifications", Bell, t("اعلان‌ها", "Notifications")],
              ["articles", BookOpen, t("محتوای آموزشی", "Learning library")],
              ["centers", MapPin, t("نقشه مراکز", "Care center map")],
            ].map(([page, I, title]) =>
              menu(I as Icon, String(title), () => go(String(page))),
            )}
          </Card>
          <Button
            secondary
            title={t("مشاهده خانه در حالت تیره", "View dark home")}
            onPress={() => {
              update((s) => ({ ...s, theme: "dark" }));
              home();
            }}
          />
        </>
      );
    return empty(t("صفحه پیدا نشد.", "Page not found."));
  }
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 25,
        }}
      >
        {error ? (
          <>
            <Text>{error}</Text>
            <Tap onPress={retry}>
              <Text>تلاش مجدد / Retry</Text>
            </Tap>
            {auth.session && (
              <Tap
                onPress={() => {
                  void auth.signOut();
                }}
              >
                <Text>خروج / Sign out</Text>
              </Tap>
            )}
          </>
        ) : (
          <ActivityIndicator color="#327BFF" />
        )}
      </View>
    );
  return (
    <UIContext.Provider value={{ colors, fa }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style={dark ? "light" : "dark"} />
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 480,
            alignSelf: "center",
            backgroundColor: colors.bg,
          }}
        >
          {demo && (
            <Tap
              onPress={() => {
                setDemo(false);
                home();
              }}
              style={{
                backgroundColor: dark ? "#334226" : "#EFF8DF",
                padding: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  textAlign: "center",
                  color: dark ? "#D7EABD" : "#70853E",
                }}
              >
                {t(
                  "حالت نمونه · داده‌ها واقعی نیستند · خروج",
                  "Demo · Sample data only · Exit",
                )}
              </Text>
            </Tap>
          )}
          {!isIntro && (
            <Row
              style={{
                paddingHorizontal: 20,
                paddingVertical: 16,
                justifyContent: "space-between",
              }}
            >
              {section === "home" ? (
                <Tap
                  accessibilityLabel={t("اعلان‌ها", "Notifications")}
                  onPress={() => go("notifications")}
                >
                  {iconBox(Bell)}
                </Tap>
              ) : (
                <Label size={19} weight={fa ? "700" : "600"}>
                  {titles[section] || t("سلامت‌یار", "SalamatYar")}
                </Label>
              )}
              {section === "home" ? (
                <Tap
                  accessibilityLabel={t("یادآوری‌ها", "Reminders")}
                  onPress={() => go("reminders")}
                >
                  <CalendarDays size={22} color={colors.blue} />
                </Tap>
              ) : (
                <Tap
                  accessibilityLabel={t("بازگشت", "Back")}
                  onPress={() => (router.canGoBack() ? router.back() : home())}
                >
                  <BackIcon />
                </Tap>
              )}
            </Row>
          )}
          {!!(message || error) && !form && (
            <View
              style={{
                marginHorizontal: 20,
                padding: 12,
                borderRadius: 12,
                backgroundColor: "#FFF2DC",
              }}
            >
              <Text
                accessibilityRole="alert"
                style={{
                  fontSize: 12,
                  color: "#A57524",
                  textAlign: fa ? "right" : "left",
                }}
              >
                {message || error}
              </Text>
              {error && (
                <Button
                  secondary
                  title={t("تلاش مجدد ذخیره", "Retry save")}
                  onPress={retry}
                />
              )}
              <Tap
                accessibilityLabel={t("بستن پیام", "Dismiss")}
                onPress={() => setMessage("")}
              >
                <X size={15} color="#A57524" />
              </Tap>
            </View>
          )}
          <ScrollView
            key={`${section}-${item || ""}-${member}`}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              padding: isIntro ? 0 : 20,
              paddingTop: section === "home" ? 20 : 4,
              paddingBottom: 30,
              flexGrow: 1,
            }}
          >
            {isIntro ? renderIntro() : renderContent()}
          </ScrollView>
          {!isIntro && (
            <Row
              style={{
                backgroundColor: colors.card,
                borderTopWidth: 1,
                borderColor: colors.line,
                paddingTop: 12,
                paddingBottom: 9,
                justifyContent: "space-around",
                gap: 0,
              }}
            >
              {navItems.map(([page, I, label]) => (
                <Tap
                  key={page}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: section === page }}
                  onPress={() => go(page, undefined, "self")}
                  style={{ flex: 1, alignItems: "center", gap: 4 }}
                >
                  <I
                    size={21}
                    color={section === page ? colors.blue : colors.muted}
                    strokeWidth={section === page ? 2.5 : 1.5}
                  />
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: section === page ? "500" : "400",
                      color: section === page ? colors.blue : colors.muted,
                    }}
                  >
                    {label}
                  </Text>
                </Tap>
              ))}
            </Row>
          )}
        </View>
        <Modal
          visible={!!form}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (!busy) {
              setForm(null);
              discardPendingFiles();
            }
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "#10234D77",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                maxHeight: "94%",
                width: "100%",
                maxWidth: 480,
                alignSelf: "center",
                backgroundColor: colors.card,
                borderTopLeftRadius: 25,
                borderTopRightRadius: 25,
                padding: 22,
              }}
            >
              <ScrollView keyboardShouldPersistTaps="handled">
                <Row
                  style={{ justifyContent: "space-between", marginBottom: 20 }}
                >
                  <Label size={20} weight="700">
                    {form?.id
                      ? t("ویرایش اطلاعات", "Edit details")
                      : t("ثبت اطلاعات جدید", "Add new item")}
                  </Label>
                  <Tap
                    disabled={busy}
                    accessibilityLabel={t("بستن", "Close")}
                    onPress={() => {
                      setForm(null);
                      discardPendingFiles();
                    }}
                  >
                    <X color={colors.muted} />
                  </Tap>
                </Row>
                {form && (
                  <>
                    {form.kind === "medicine" && (
                      <Button
                        secondary
                        title={t("اسکن بارکد دارو", "Scan medicine barcode")}
                        onPress={() => setScanner(true)}
                      />
                    )}
                    <Label muted size={11} style={{ marginBottom: 12 }}>
                      {personName}
                    </Label>
                    {form.kind === "metric" ? (
                      <>
                        {chips(
                          [
                            t("فشار خون", "Pressure"),
                            t("قند خون", "Glucose"),
                            t("وزن", "Weight"),
                          ],
                          ["pressure", "glucose", "weight"].indexOf(
                            form.category,
                          ),
                          (n) => {
                            change(
                              "category",
                              ["pressure", "glucose", "weight"][n],
                            );
                            change("name", "");
                            setMessage("");
                          },
                        )}
                        <View style={{ marginBottom: 13 }}>
                          <Label muted size={12} style={{ marginBottom: 5 }}>
                            {form.category === "pressure"
                              ? t(
                                  "فشار خون · سیستول/دیاستول (mmHg)",
                                  "Blood pressure · systolic/diastolic (mmHg)",
                                )
                              : form.category === "glucose"
                                ? t(
                                    "قند خون ناشتا (mg/dL)",
                                    "Fasting glucose (mg/dL)",
                                  )
                                : t("وزن (kg)", "Weight (kg)")}
                          </Label>
                          <TextInput
                            accessibilityLabel={t("مقدار", "Value")}
                            value={String(form?.name || "")}
                            onChangeText={(v) => change("name", v)}
                            placeholder={
                              form.category === "pressure"
                                ? "120/80"
                                : form.category === "glucose"
                                  ? "95"
                                  : "72.5"
                            }
                            placeholderTextColor={colors.muted}
                            keyboardType={
                              form.category === "pressure"
                                ? "numbers-and-punctuation"
                                : "decimal-pad"
                            }
                            maxLength={form.category === "pressure" ? 7 : 6}
                            style={[
                              uiStyles.input,
                              {
                                textAlign:
                                  form.category === "pressure"
                                    ? "center"
                                    : fa
                                      ? "right"
                                      : "left",
                                color: colors.text,
                                backgroundColor: colors.soft,
                                borderColor: colors.line,
                                minHeight: 49,
                                fontWeight: "500",
                              },
                            ]}
                          />
                        </View>
                        <Label muted size={11} style={{ marginBottom: 14 }}>
                          {form.category === "pressure"
                            ? t(
                                "مثال: 120/80 — اسلش لازم است.",
                                "Example: 120/80 — slash required.",
                              )
                            : form.category === "glucose"
                              ? t(
                                  "مثال: 95 — فقط عدد، ممیز اختیاری.",
                                  "Example: 95 — number only.",
                                )
                              : t(
                                  "مثال: 72.5 — فقط عدد، ممیز اختیاری.",
                                  "Example: 72.5 — number only.",
                                )}
                        </Label>
                      </>
                    ) : (
                      <>
                        {field("name", t("نام / عنوان", "Name / title"), "")}
                        {field(
                          "note",
                          form.kind === "medicine"
                            ? t("دستور مصرف ثبت‌شده", "Recorded instructions")
                            : form.kind === "member" || form.kind === "profile"
                              ? t("نسبت / توضیح", "Relationship / note")
                              : t("توضیحات", "Notes"),
                          "",
                          false,
                          form.kind !== "member" && form.kind !== "profile",
                        )}
                      </>
                    )}
                    {form.kind === "medicine" && (
                      <>
                        {field(
                          "stock",
                          t("موجودی برحسب نوبت مصرف", "Stock in intakes"),
                          "",
                          true,
                        )}
                        {field(
                          "time",
                          t("زمان روزانه · 24 ساعته", "Daily time · 24-hour"),
                          "08:00",
                        )}
                        <Row
                          style={{
                            justifyContent: "space-between",
                            marginBottom: 14,
                          }}
                        >
                          {["08:00", "12:00", "16:00", "20:00"].map((v, i) => (
                            <Tap
                              key={v}
                              onPress={() => change("time", v)}
                              style={[
                                uiStyles.chip,
                                {
                                  backgroundColor:
                                    form.time === v ? colors.blue : colors.soft,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  color:
                                    form.time === v ? "white" : colors.blue,
                                }}
                              >
                                {
                                  [
                                    t("صبح", "AM"),
                                    t("ظهر", "Noon"),
                                    t("عصر", "PM"),
                                    t("شب", "Night"),
                                  ][i]
                                }
                              </Text>
                            </Tap>
                          ))}
                        </Row>
                        <Label muted size={11}>
                          {t(
                            "هر ثبت یک ساعت روزانه دارد. یادآوری را بعد از ذخیره از جزئیات دارو فعال کنید.",
                            "Each entry has one daily time. Enable its reminder from medicine details after saving.",
                          )}
                        </Label>
                      </>
                    )}
                    {["appointment", "lab", "record", "metric"].includes(
                      form.kind,
                    ) && (
                      <>
                        {field(
                          "date",
                          t(
                            "ورود تاریخ میلادی · سال-ماه-روز",
                            "Gregorian date · YYYY-MM-DD",
                          ),
                          "2026-10-01",
                        )}
                        {validDate(digits(form.date)) && (
                          <Label muted size={11} style={{ marginBottom: 14 }}>
                            {fmt(digits(form.date))}
                          </Label>
                        )}
                      </>
                    )}
                    {form.kind === "appointment" && (
                      <>
                        {field("category", t("تخصص", "Specialty"))}
                        {field("time", t("ساعت", "Time"), "16:30")}
                        {field("location", t("محل مطب", "Clinic address"))}
                        {field(
                          "phone",
                          t("شماره تماس (اختیاری)", "Phone (optional)"),
                        )}
                        <Label muted size={11}>
                          {t(
                            "این مورد در برنامه ثبت می‌شود. برای رزرو با مطب هماهنگ کنید؛ یادآوری دستگاه را از جزئیات فعال کنید.",
                            "Saved in your care plan. Contact the clinic to book; enable device reminders from details.",
                          )}
                        </Label>
                      </>
                    )}
                    {form.kind === "record" &&
                      chips(
                        [
                          t("یادداشت", "Note"),
                          t("نسخه", "Prescription"),
                          t("تصویر", "Image"),
                        ],
                        ["note", "prescription", "image"].indexOf(
                          form.category,
                        ),
                        (n) =>
                          change(
                            "category",
                            ["note", "prescription", "image"][n],
                          ),
                      )}
                    {(form.kind === "record" || form.kind === "lab") && (
                      <>
                        <Button
                          disabled={busy}
                          secondary
                          title={
                            form.attachment
                              ? form.attachment.name
                              : t("پیوست تصویر یا PDF", "Attach image or PDF")
                          }
                          onPress={async () => {
                            if (demo) {
                              setMessage(
                                t(
                                  "برای پیوست واقعی از حالت نمونه خارج شوید.",
                                  "Leave demo mode to attach a real file.",
                                ),
                              );
                              return;
                            }
                            setBusy(true);
                            try {
                              const attachment = await pickAttachment(
                                auth.session?.user.id,
                              );
                              if (attachment)
                                setForm((f) => (f ? { ...f, attachment } : f));
                            } catch {
                              setMessage(
                                t(
                                  "پیوست نشد؛ ورود حساب، نوع فایل و سقف ۱۰ مگابایت را بررسی کنید.",
                                  "Attachment failed. Check sign-in, file type and 10 MB limit.",
                                ),
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                        />
                        <Label muted size={11}>
                          {t(
                            "JPG، PNG یا PDF؛ حداکثر ۱۰ مگابایت",
                            "JPG, PNG or PDF; max 10 MB",
                          )}
                        </Label>
                      </>
                    )}
                    {form.kind === "lab" &&
                      field(
                        "results",
                        t(
                          "مقادیر آزمایش؛ هر خط: نام | مقدار | واحد | بازه",
                          "Results; each line: name | value | unit | range",
                        ),
                        "WBC | 6.5 | 10³/µL | 4–10",
                        false,
                        true,
                      )}
                    {form.kind === "member" && !form.id && (
                      <Row style={{ marginVertical: 14 }}>
                        <Switch
                          value={form.consent}
                          onValueChange={(v) => change("consent", v)}
                          trackColor={{ true: colors.blue }}
                        />
                        <Label size={12} style={{ flex: 1 }}>
                          {t(
                            "برای ثبت و مدیریت این اطلاعات رضایت دارم.",
                            "I have consent to manage this profile.",
                          )}
                        </Label>
                      </Row>
                    )}
                    {!!message && (
                      <Text
                        accessibilityRole="alert"
                        style={{
                          color: colors.danger,
                          fontSize: 12,
                          marginVertical: 15,
                        }}
                      >
                        {message}
                      </Text>
                    )}
                    <Button
                      disabled={busy}
                      title={
                        busy
                          ? t("در حال ذخیره…", "Saving…")
                          : t("ذخیره", "Save")
                      }
                      onPress={save}
                    />
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal
          visible={!!confirm}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirm(null)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              backgroundColor: "#10234D77",
              padding: 25,
            }}
          >
            <View
              style={{
                backgroundColor: colors.card,
                padding: 25,
                borderRadius: 22,
                width: "100%",
                maxWidth: 420,
                alignSelf: "center",
              }}
            >
              <Label>{confirm?.text}</Label>
              <Button
                disabled={busy}
                danger
                title={t("تأیید", "Confirm")}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await confirm?.action();
                    setConfirm(null);
                  } catch {
                    setMessage(
                      t(
                        "عملیات کامل نشد؛ دوباره تلاش کنید.",
                        "Could not finish. Try again.",
                      ),
                    );
                    setConfirm(null);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <Button
                secondary
                title={t("بازگشت", "Go back")}
                onPress={() => setConfirm(null)}
              />
            </View>
          </View>
        </Modal>
        <BarcodeScanner
          visible={scanner}
          onClose={() => setScanner(false)}
          onScan={(code) => {
            setScanner(false);
            setForm((f) =>
              f
                ? {
                    ...f,
                    note: (f.note ? f.note + "\n" : "") + "Barcode: " + code,
                  }
                : f,
            );
          }}
        />
      </SafeAreaView>
    </UIContext.Provider>
  );
}
