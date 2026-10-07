import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button, Card, Label, useUI } from "./TemplateUI";
import { TextInput } from "./Typography";
import { requireBackend } from "../services/supabase";
import { digits } from "../core/model";

const inputStyle = (colors: { soft: string; text: string }) => ({
  backgroundColor: colors.soft,
  borderRadius: 13,
  padding: 15,
  color: colors.text,
  marginBottom: 12,
});

export function normalizePhone(raw: string) {
  const latin = digits(raw).replace(/[\s-]/g, "");
  const rest = latin.startsWith("+98")
    ? "0" + latin.slice(3)
    : latin.startsWith("98")
      ? "0" + latin.slice(2)
      : latin;
  return /^09\d{9}$/.test(rest) ? rest : null;
}

export default function SmsLogin({ onBack }: { onBack: () => void }) {
  const { fa, colors } = useUI();
  const t = (a: string, b: string) => (fa ? a : b);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && timer.current) clearInterval(timer.current);
        return Math.max(0, c - 1);
      });
    }, 1000);
  }

  function fail(e: unknown, fallback: string) {
    const msg = e instanceof Error ? e.message : fallback;
    setMessage(
      msg === "RATE_LIMIT"
        ? t(
            "تعداد تلاش زیاد بود. یک ساعت بعد دوباره تلاش کنید.",
            "Too many attempts. Try again in an hour.",
          )
        : msg === "INVALID_CODE"
          ? t("کد اشتباه است. دوباره تلاش کنید.", "Wrong code. Try again.")
          : msg === "SMS_NOT_CONFIGURED"
            ? t(
                "سرویس پیامک هنوز وصل نشده است.",
                "SMS service is not connected yet.",
              )
            : msg === "PROVIDER_UNAVAILABLE" || msg === "LIMIT_ERROR"
              ? t(
                  "ارسال پیامک ناموفق بود. چند دقیقه بعد تلاش کنید.",
                  "Could not send the SMS. Try again in a few minutes.",
                )
              : msg === "ACCOUNT_ERROR"
                ? t(
                    "ساخت نشست ناموفق بود. دوباره تلاش کنید.",
                    "Could not create the session. Try again.",
                  )
                : msg,
    );
  }

  async function send() {
    const to = normalizePhone(phone);
    if (!to) {
      setMessage(
        t(
          "شماره موبایل معتبر وارد کنید؛ مثال: 09123456789",
          "Enter a valid mobile number, e.g. 09123456789.",
        ),
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await requireBackend().functions.invoke(
        "sms-otp",
        { body: { action: "send", phone: to } },
      );
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "PROVIDER_UNAVAILABLE");
      setStep("code");
      setCode("");
      startCooldown(60);
      setMessage(
        t(
          "کد تأیید پیامک شد. آن را وارد کنید.",
          "The verification code was sent. Enter it below.",
        ),
      );
    } catch (e) {
      fail(e, t("ارسال نشد.", "Send failed."));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    const to = normalizePhone(phone);
    if (!to || !code.trim()) {
      setMessage(t("کد را وارد کنید.", "Enter the code."));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await requireBackend().functions.invoke(
        "sms-otp",
        { body: { action: "verify", phone: to, code: code.trim() } },
      );
      if (error) throw new Error(error.message);
      const link = data?.link as string | undefined;
      if (!link) throw new Error(data?.error || "INVALID_CODE");
      const url = new URL(link);
      const tokenHash = url.searchParams.get("token_hash");
      const token = url.searchParams.get("token");
      const api = requireBackend();
      if (tokenHash) {
        const { error: sessionError } = await api.auth.verifyOtp({
          type: "magiclink",
          token_hash: tokenHash,
        });
        if (sessionError) throw sessionError;
      } else if (token && data?.email) {
        const { error: sessionError } = await api.auth.verifyOtp({
          type: "magiclink",
          email: data.email as string,
          token,
        });
        if (sessionError) throw sessionError;
      } else {
        throw new Error("ACCOUNT_ERROR");
      }
      router.replace("/");
    } catch (e) {
      fail(e, t("تأیید نشد.", "Verification failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Label size={18} weight="600" style={{ marginBottom: 6 }}>
        {t("ورود با پیامک", "Sign in with SMS")}
      </Label>
      <Label muted size={12} style={{ marginBottom: 14 }}>
        {t(
          "شماره موبایل ایران (09...) را وارد کنید؛ کد تأیید پیامک می‌شود. هزینه هر پیامک از اعتبار پنل کم می‌شود.",
          "Enter your Iranian mobile (09...); a verification code will be texted to you.",
        )}
      </Label>
      {step === "phone" || !phone ? (
        <TextInput
          accessibilityLabel={t("شماره موبایل", "Mobile number")}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="09123456789"
          placeholderTextColor={colors.muted}
          maxLength={11}
          style={inputStyle(colors)}
        />
      ) : null}
      {step === "code" && (
        <TextInput
          accessibilityLabel={t("کد تأیید", "Verification code")}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          placeholder={t("کد ۴ تا ۶ رقمی", "4–6 digit code")}
          placeholderTextColor={colors.muted}
          maxLength={8}
          style={inputStyle(colors)}
        />
      )}
      {step === "phone" ? (
        <Button
          disabled={busy}
          title={
            busy ? t("در حال ارسال…", "Sending…") : t("ارسال کد تأیید", "Send code")
          }
          onPress={send}
        />
      ) : (
        <>
          <Button
            disabled={busy}
            title={busy ? t("در حال بررسی…", "Checking…") : t("تأیید و ورود", "Verify & sign in")}
            onPress={verify}
          />
          <Button
            secondary
            disabled={busy || cooldown > 0}
            title={
              cooldown > 0
                ? t(`ارسال مجدد تا ${cooldown} ثانیه`, `Resend in ${cooldown}s`)
                : t("ارسال مجدد کد", "Resend code")
            }
            onPress={send}
          />
        </>
      )}
      {!!message && (
        <Card>
          <Label>{message}</Label>
        </Card>
      )}
      <Button secondary title={t("بازگشت", "Back")} onPress={onBack} />
    </View>
  );
}
