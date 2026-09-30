import { Platform } from "react-native";
import { Appointment, Medicine } from "./model";
export async function scheduleDaily(
  time: string,
  language: "fa" | "en",
  identifier?: string,
) {
  if (Platform.OS === "web") throw new Error("native-only");
  const N = await import("expo-notifications");
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android")
    await N.setNotificationChannelAsync("care", {
      name: "SalamatYar",
      importance: N.AndroidImportance.HIGH,
      lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
    });
  const permission = await N.requestPermissionsAsync();
  if (!permission.granted) throw new Error("permission");
  const [hour, minute] = time.split(":").map(Number);
  return N.scheduleNotificationAsync({
    identifier,
    content: {
      title: language === "fa" ? "یادآوری سلامت‌یار" : "SalamatYar reminder",
      body:
        language === "fa"
          ? "برنامه مراقبت خود را بررسی کنید."
          : "Check your care plan.",
      sound: true,
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: "care",
    },
  });
}
export async function cancelReminder(identifier?: string) {
  if (identifier && Platform.OS !== "web") {
    const N = await import("expo-notifications");
    await N.cancelScheduledNotificationAsync(identifier);
  }
}
export async function restoreReminders(
  medicines: Medicine[],
  owner: string,
): Promise<Medicine[]> {
  if (Platform.OS === "web") return medicines;
  const N = await import("expo-notifications");
  const scheduled = await N.getAllScheduledNotificationsAsync();
  const active = new Set(scheduled.map((r) => r.identifier));
  const valid = new Set(medicines.map((m) => `care:${owner}:${m.id}`));
  await Promise.all(
    scheduled
      .filter(
        (r) =>
          r.identifier.startsWith(`care:${owner}:`) && !valid.has(r.identifier),
      )
      .map((r) => N.cancelScheduledNotificationAsync(r.identifier)),
  );
  return medicines.map((m) => ({
    ...m,
    notificationId: active.has(`care:${owner}:${m.id}`)
      ? `care:${owner}:${m.id}`
      : undefined,
  }));
}
export async function scheduleVisit(
  date: string,
  time: string,
  language: "fa" | "en",
  identifier: string,
) {
  if (Platform.OS === "web") throw new Error("native-only");
  const when = new Date(`${date}T${time}:00`);
  if (!Number.isFinite(when.getTime()) || when.getTime() <= Date.now())
    throw new Error("PAST_APPOINTMENT");
  const N = await import("expo-notifications");
  if (Platform.OS === "android")
    await N.setNotificationChannelAsync("care", {
      name: "SalamatYar",
      importance: N.AndroidImportance.HIGH,
      lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
    });
  if (!(await N.requestPermissionsAsync()).granted)
    throw new Error("PERMISSION");
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  return N.scheduleNotificationAsync({
    identifier,
    content: {
      title: language === "fa" ? "یادآوری نوبت" : "Appointment reminder",
      body:
        language === "fa"
          ? "برنامه مراجعه ثبت‌شده خود را بررسی کنید."
          : "Check your recorded appointment.",
      sound: true,
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: "care",
    },
  });
}
export async function restoreVisitReminders(
  visits: Appointment[],
  owner: string,
): Promise<Appointment[]> {
  if (Platform.OS === "web") return visits;
  const N = await import("expo-notifications");
  const pending = await N.getAllScheduledNotificationsAsync();
  const active = new Set(pending.map((r) => r.identifier));
  return visits.map((v) => ({
    ...v,
    notificationId: active.has(`visit:${owner}:${v.id}`)
      ? `visit:${owner}:${v.id}`
      : undefined,
  }));
}
