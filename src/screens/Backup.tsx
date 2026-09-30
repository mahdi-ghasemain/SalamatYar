import React, { useState } from "react";
import { Modal, View } from "react-native";
import { Button, Card, Label, useUI } from "../components/TemplateUI";
import { useStore } from "../core/store";
import { useAuth } from "../services/auth";
import { exportBackup, readBackup } from "../services/files";
import { State } from "../core/model";
import { cancelReminder } from "../core/notifications";
export default function Backup() {
  const { fa } = useUI();
  const t = (a: string, b: string) => (fa ? a : b);
  const { state, update, syncStatus, retry, reload, demo } = useStore();
  const { session } = useAuth();
  const [pending, setPending] = useState<State | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [refresh, setRefresh] = useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch {
      setMessage(
        t(
          "عملیات کامل نشد. نوع فایل، اتصال و دسترسی‌ها را بررسی کنید.",
          "Could not complete the operation. Check file type, connection and permissions.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Card>
        <Label weight="600" size={18}>
          {t("نسخه پشتیبان شما", "Your backup")}
        </Label>
        <Label muted>
          {t(
            "فایل خروجی شامل اطلاعات سلامت و بدون رمزگذاری است؛ آن را در جای امن نگه دارید. فایل‌های پیوست داخل خروجی JSON قرار نمی‌گیرند.",
            "The export contains unencrypted health information. Keep it private. Attachment files are not embedded in the JSON backup.",
          )}
        </Label>
      </Card>
      <Button
        disabled={busy}
        title={t("دریافت نسخه پشتیبان", "Export backup")}
        onPress={() => run(() => exportBackup(state))}
      />
      <Button
        disabled={busy}
        secondary
        title={t("بازیابی از فایل", "Restore from file")}
        onPress={() => run(async () => setPending(await readBackup()))}
      />
      {session && (
        <Card>
          <Label>
            {t("وضعیت ذخیره ابری: ", "Cloud status: ")}
            {syncStatus}
          </Label>
          <Button
            disabled={busy || syncStatus === "saving"}
            title={t("تلاش مجدد ذخیره", "Retry save")}
            onPress={() => run(retry)}
          />
          <Button
            secondary
            disabled={busy || syncStatus === "saving"}
            title={t("بارگیری آخرین نسخه از سرور", "Reload from server")}
            onPress={() => setRefresh(true)}
          />
        </Card>
      )}
      {demo && (
        <Label muted>
          {t(
            "در حالت نمونه فقط داده نمونه تغییر می‌کند.",
            "Only sample data changes in demo mode.",
          )}
        </Label>
      )}
      {!!message && <Label>{message}</Label>}
      <Modal
        visible={!!pending || refresh}
        transparent
        onRequestClose={() => {
          setPending(null);
          setRefresh(false);
        }}
      >
        <View
          style={{
            flex: 1,
            padding: 25,
            justifyContent: "center",
            backgroundColor: "#12244299",
          }}
        >
          <Card>
            <Label>
              {t(
                "اطلاعات فعلی جایگزین می‌شود و یادآوری‌های فعلی خاموش می‌شوند. ابتدا نسخه پشتیبان بگیرید. ادامه می‌دهید؟",
                "This replaces current data and disables current reminders. Export a backup first. Continue?",
              )}
            </Label>
            <Button
              disabled={busy}
              title={t("جایگزینی اطلاعات", "Replace data")}
              onPress={() =>
                run(async () => {
                  await Promise.all(
                    [...state.medicines, ...state.appointments].map((m) =>
                      cancelReminder(m.notificationId),
                    ),
                  );
                  if (refresh) await reload();
                  else if (pending) {
                    const owner = session?.user.id;
                    const restored = {
                      ...pending,
                      records: pending.records.map((r) => ({
                        ...r,
                        attachment:
                          r.attachment?.cloud &&
                          owner &&
                          r.attachment.path.startsWith(owner + "/")
                            ? r.attachment
                            : undefined,
                      })),
                      welcomed: true,
                    };
                    update(() => restored);
                  }
                  setPending(null);
                  setRefresh(false);
                })
              }
            />
            <Button
              secondary
              title={t("انصراف", "Cancel")}
              onPress={() => {
                setPending(null);
                setRefresh(false);
              }}
            />
          </Card>
        </View>
      </Modal>
    </>
  );
}
