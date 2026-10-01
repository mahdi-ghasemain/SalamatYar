import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Brand, Button, Label, Card, useUI } from "../components/TemplateUI";
import { TextInput } from "../components/Typography";
import { useAuth, oauth, redirectUrl } from "../services/auth";
import { requireBackend } from "../services/supabase";
import { useStore } from "../core/store";
export default function Account() {
  const { fa, colors } = useUI();
  const t = (a: string, b: string) => (fa ? a : b);
  const auth = useAuth();
  const { update } = useStore();
  const [showAccount, setShowAccount] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [mode, setMode] = useState<"signin" | "signup" | "reset">("signin"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : t("عملیات انجام نشد.", "Request failed."),
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    const api = requireBackend();
    if (auth.recovery) {
      if (password.length < 12)
        throw new Error(
          t("رمز باید حداقل ۱۲ نویسه باشد.", "Use at least 12 characters."),
        );
      const { error } = await api.auth.updateUser({ password });
      if (error) throw error;
      auth.setRecovery(false);
      setPassword("");
      setMessage(t("رمز تغییر کرد.", "Password updated."));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      throw new Error(t("ایمیل معتبر وارد کنید.", "Enter a valid email."));
    if (mode === "reset") {
      const { error } = await api.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl(),
      });
      if (error) throw error;
      setMessage(
        t(
          "اگر این ایمیل ثبت شده باشد، لینک بازیابی ارسال می‌شود.",
          "If the account exists, a reset link will be sent.",
        ),
      );
      return;
    }
    if (password.length < (mode === "signup" ? 12 : 1))
      throw new Error(
        t(
          "رمز عبور را وارد کنید؛ برای ثبت‌نام حداقل ۱۲ نویسه.",
          "Enter a password; sign-up requires at least 12 characters.",
        ),
      );
    const { data, error } =
      mode === "signup"
        ? await api.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: redirectUrl() },
          })
        : await api.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    setPassword("");
    if (data.session) router.replace("/");
    else
      setMessage(
        t(
          "ایمیل تأیید را باز کنید و سپس وارد شوید.",
          "Check your confirmation email, then sign in.",
        ),
      );
  }
  function startWithoutAccount() {
    update((s) => ({ ...s, welcomed: true }));
    router.replace("/");
  }
  if (!auth.session && !auth.recovery && !showAccount) {
    return (
      <View style={{ padding: 24, flex: 1, justifyContent: "center", gap: 18 }}>
        <View style={{ alignItems: "center", gap: 12 }}>
          <Brand />
          <Label size={28} weight="700">
            {t("به سلامت‌یار خوش آمدید", "Welcome to SalamatYar")}
          </Label>
          <Label muted>
            {t(
              "بدون ایمیل، رمز یا فرم طولانی شروع کنید.",
              "Get started without an email, password or long form.",
            )}
          </Label>
        </View>
        <Button
          title={t("شروع استفاده", "Get started")}
          onPress={startWithoutAccount}
        />
        <Card>
          <Label>
            {t(
              "اطلاعات شما روی همین دستگاه ذخیره می‌شود. با حذف برنامه یا پاک‌کردن داده‌ها ممکن است از دست برود؛ از بخش پشتیبان‌گیری یک نسخه نگه دارید.",
              "Your information stays on this device. Uninstalling the app or clearing its data may remove it. Keep a copy using Backup.",
            )}
          </Label>
        </Card>
        <Button
          secondary
          title={t(
            "حساب قبلی دارم / ذخیره آنلاین",
            "Existing account / online storage",
          )}
          onPress={() => setShowAccount(true)}
        />
      </View>
    );
  }
  return (
    <View style={{ padding: 24, flex: 1, justifyContent: "center" }}>
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <Brand />
        <Label size={25} weight="700">
          {t("سلامت‌یار", "SalamatYar")}
        </Label>
        <Label muted>
          {auth.recovery
            ? t("تعیین رمز جدید", "Set a new password")
            : mode === "signup"
              ? t("ساخت حساب کاربری", "Create your account")
              : mode === "reset"
                ? t("بازیابی رمز", "Reset password")
                : t("ورود به حساب", "Welcome back")}
        </Label>
      </View>
      {!auth.configured && (
        <Card>
          <Label>
            {t(
              "برای فعال شدن ثبت‌نام و ورود گوگل، آدرس و کلید عمومی پروژه Supabase باید تنظیم شود.",
              "Configure the Supabase URL and publishable key to enable sign-up and Google sign-in.",
            )}
          </Label>
        </Card>
      )}
      {auth.session && !auth.recovery ? (
        <>
          <Label>{auth.session.user.email}</Label>
          <Button
            title={t("رفتن به برنامه", "Open app")}
            onPress={() => router.replace("/")}
          />
          <Button
            secondary
            disabled={busy}
            title={t("خروج از حساب", "Sign out")}
            onPress={() => run(auth.signOut)}
          />
        </>
      ) : (
        <>
          {!auth.recovery && (
            <TextInput
              accessibilityLabel="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder={t("ایمیل", "Email")}
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.soft,
                borderRadius: 13,
                padding: 15,
                color: colors.text,
                marginBottom: 12,
              }}
            />
          )}
          {(mode !== "reset" || auth.recovery) && (
            <TextInput
              accessibilityLabel="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              placeholder={t("رمز عبور", "Password")}
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.soft,
                borderRadius: 13,
                padding: 15,
                color: colors.text,
                marginBottom: 12,
              }}
            />
          )}
          <Button
            disabled={!auth.configured || busy}
            title={
              busy
                ? t("در حال انجام…", "Working…")
                : auth.recovery
                  ? t("ذخیره رمز جدید", "Save password")
                  : mode === "signup"
                    ? t("ثبت‌نام", "Sign up")
                    : mode === "reset"
                      ? t("ارسال لینک بازیابی", "Send reset link")
                      : t("ورود", "Sign in")
            }
            onPress={() => run(submit)}
          />
          {!auth.recovery && (
            <>
              <Button
                secondary
                disabled={!auth.configured || busy}
                title={t("ورود با گوگل", "Continue with Google")}
                onPress={() => run(() => oauth("google"))}
              />
              <Button
                secondary
                title={
                  mode === "signup"
                    ? t("حساب دارم؛ ورود", "Already registered? Sign in")
                    : t("ساخت حساب جدید", "Create an account")
                }
                onPress={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setMessage("");
                }}
              />
              <Button
                secondary
                title={
                  mode === "reset"
                    ? t("بازگشت به ورود", "Back to sign in")
                    : t("رمز را فراموش کرده‌ام", "Forgot password")
                }
                onPress={() => {
                  setMode(mode === "reset" ? "signin" : "reset");
                  setMessage("");
                }}
              />
            </>
          )}
        </>
      )}
      {!!message && <Label style={{ marginVertical: 14 }}>{message}</Label>}
      <Button
        secondary
        title={t("شروع بدون ثبت‌نام", "Start without signing up")}
        onPress={startWithoutAccount}
      />
    </View>
  );
}
