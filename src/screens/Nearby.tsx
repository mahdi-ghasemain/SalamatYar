import React, { useRef, useState } from "react";
import { Linking, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { MapPin, Phone } from "lucide-react-native";
import { Button, Card, Label, Row, Tap, useUI } from "../components/TemplateUI";
import LiveMap, { MapMarker } from "../components/LiveMap";
import { placesFromOSM, Place, Point } from "../services/geo";
import { supabase } from "../services/supabase";
import { useAuth } from "../services/auth";

const RADIUS_KM = 5;
// Free mirrors: all public Overpass instances, no API key needed.
// The app tries them in order, so one busy mirror does not break search.
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const CACHE_MS = 10 * 60 * 1000;
const cellKey = (lat: number, lon: number) =>
  `nearby:${lat.toFixed(3)},${lon.toFixed(3)}`;

export default function Nearby() {
  const { fa, colors } = useUI(),
    { session } = useAuth();
  const t = (a: string, b: string) => (fa ? a : b);
  const [origin, setOrigin] = useState<Point | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [places, setPlaces] = useState<Place[]>([]),
    [filter, setFilter] = useState("all"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [searched, setSearched] = useState(false);
  const last = useRef(0);
  async function locate() {
    if (busy) return;
    if (Date.now() - last.current < 15000) {
      setMessage(
        t(
          "چند ثانیه تا جستجوی بعدی صبر کنید.",
          "Please wait a few seconds before searching again.",
        ),
      );
      return;
    }
    setBusy(true);
    setMessage("");
    setPlaces([]);
    setSelected(null);
    setSearched(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          t(
            "مجوز مکان داده نشد. از تنظیمات دستگاه فعال کنید.",
            "Location permission denied. Enable it in device settings.",
          ),
        );
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const point = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setOrigin(point);
      last.current = Date.now();
      // Free stable quota: 10-min local cache + 3 free mirrors.
      // Authenticated path (scalable) uses the Edge Function cache first.
      const key = cellKey(point.latitude, point.longitude);
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached) as {
            at: number;
            elements: unknown[];
          };
          if (
            Date.now() - parsed.at < CACHE_MS &&
            Array.isArray(parsed.elements)
          ) {
            setPlaces(placesFromOSM(parsed.elements, point));
            setSearched(true);
            setMessage(
              t(
                "سهمیه پایدار رایگان: نتیجه کش ۱۰دقیقه‌ای، بدون مصرف اینترنت اضافه.",
                "Free stable quota: 10-min cached result, no extra usage.",
              ),
            );
            return;
          }
        }
      } catch {
        // Cache is best-effort; continue to network.
      }
      if (session && supabase) {
        try {
          const { data, error } = await supabase.functions.invoke(
            process.env.EXPO_PUBLIC_NEARBY_FUNCTION || "nearby",
            { body: { lat: point.latitude, lon: point.longitude } },
          );
          if (error || !Array.isArray(data?.elements))
            throw new Error(
              t(
                "جستجوی ابری مراکز در دسترس نیست؛ تلاش مستقیم رایگان…",
                "Cloud search unavailable; trying free direct lookup…",
              ),
            );
          setPlaces(placesFromOSM(data.elements, point));
          setSearched(true);
          try {
            await AsyncStorage.setItem(
              key,
              JSON.stringify({ at: Date.now(), elements: data.elements }),
            );
          } catch {}
          return;
        } catch (e) {
          // Fall through to free direct Overpass so the button still works.
          setMessage(e instanceof Error ? e.message : "");
        }
      }
      const query =
        `[out:json][timeout:15];(nwr[amenity~"^(hospital|clinic|pharmacy|doctors)$"]` +
        `(around:5000,${point.latitude.toFixed(3)},${point.longitude.toFixed(3)});` +
        `nwr[healthcare="laboratory"](around:5000,${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}););` +
        `out center tags 100;`;
      let lastError = "";
      for (const mirror of OVERPASS_MIRRORS) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch(mirror, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ data: query }).toString(),
            signal: controller.signal,
          });
          if (!response.ok) {
            lastError = `HTTP ${response.status}`;
            continue;
          }
          const result = await response.json();
          const elements = result.elements || [];
          setPlaces(placesFromOSM(elements, point));
          setSearched(true);
          try {
            await AsyncStorage.setItem(
              key,
              JSON.stringify({ at: Date.now(), elements }),
            );
          } catch {}
          setMessage(
            t(
              "سهمیه پایدار رایگان فعال است: کش ۱۰دقیقه‌ای + ۳ سرور آزاد. برای کش سمت سرور وارد شوید.",
              "Free stable quota active: 10-min cache + 3 free mirrors. Sign in for server-side cache.",
            ),
          );
          return;
        } catch (e) {
          lastError = e instanceof Error ? e.message : "fetch failed";
        } finally {
          clearTimeout(timeout);
        }
      }
      throw new Error(
        t(
          `هر ۳ سرور آزاد پاسخ ندادند (${lastError}). چند دقیقه بعد دوباره تلاش کنید — نتیجه کش‌شده قبلی حفظ می‌شود.`,
          `All 3 free mirrors failed (${lastError}). Try again later — cached results are kept.`,
        ),
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : t("دریافت مکان انجام نشد.", "Could not get location."),
      );
    } finally {
      setBusy(false);
    }
  }
  const visible = places.filter((p) => filter === "all" || p.kind === filter);
  const markers: MapMarker[] = [
    ...(origin
      ? [
          {
            ...origin,
            id: "self",
            self: true,
            label: t("موقعیت شما", "Your location"),
            selected: !selected,
          },
        ]
      : []),
    ...visible.map((p) => ({
      ...p.point,
      id: p.id,
      label: p.name || t("مرکز درمانی", "Care center"),
      kind: p.kind,
      selected: selected === p.id,
    })),
  ];
  const openDirections = (place: Place) =>
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${place.point.latitude},${place.point.longitude}`,
    ).catch(() =>
      setMessage(t("مسیریابی باز نشد.", "Could not open directions.")),
    );
  return (
    <>
      <Label muted size={12}>
        {t(
          "سهمیه پایدار رایگان فعال است: بدون کلید و بدون ورود، با کش ۱۰دقیقه‌ای روی گوشی و ۳ سرور آزاد Overpass. ورود اختیاری است و کش سمت سرور را اضافه می‌کند. مکان در پرونده سلامت ذخیره نمی‌شود.",
          "Free stable quota active: no key, no sign-in required, with 10-min on-device cache and 3 free Overpass mirrors. Sign-in is optional and adds server-side cache. Location is not stored.",
        )}
      </Label>
      <Button
        disabled={busy}
        title={
          busy
            ? t("در حال یافتن موقعیت…", "Finding your location…")
            : t(
                "نمایش موقعیت و مراکز اطراف من",
                "Show my location & nearby care",
              )
        }
        onPress={locate}
      />
      {!!message && (
        <Card>
          <Label>{message}</Label>
        </Card>
      )}
      {origin && (
        <>
          <LiveMap
            markers={markers}
            onError={() =>
              setMessage(
                t(
                  "بارگذاری نقشه انجام نشد. اتصال اینترنت را بررسی کنید.",
                  "Map failed to load. Check your connection.",
                ),
              )
            }
          />
          <Row style={{ flexWrap: "wrap", marginBottom: 12, gap: 14 }}>
            {[
              ["#327BFF", t("موقعیت شما", "Your location")],
              ["#08BA8A", t("مرکز درمانی", "Care center")],
              ["#F75D76", t("انتخاب‌شده", "Selected")],
            ].map(([color, text]) => (
              <Row key={text} style={{ gap: 6 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: color,
                  }}
                />
                <Label muted size={11}>
                  {text}
                </Label>
              </Row>
            ))}
          </Row>
        </>
      )}
      <Row style={{ flexWrap: "wrap", marginBottom: 15 }}>
        {[
          ["all", t("همه", "All")],
          ["hospital", t("بیمارستان", "Hospital")],
          ["pharmacy", t("داروخانه", "Pharmacy")],
          ["laboratory", t("آزمایشگاه", "Laboratory")],
        ].map(([key, label]) => (
          <Tap
            key={key}
            onPress={() => setFilter(key)}
            style={{
              padding: 9,
              borderRadius: 12,
              backgroundColor: filter === key ? colors.blue : colors.soft,
            }}
          >
            <Label
              size={11}
              style={{ color: filter === key ? "white" : colors.muted }}
            >
              {label}
            </Label>
          </Tap>
        ))}
      </Row>
      {visible.map((p) => (
        <Card
          key={p.id}
          style={
            selected === p.id
              ? { borderColor: colors.danger, borderWidth: 2 }
              : undefined
          }
        >
          <Row>
            <MapPin color={selected === p.id ? colors.danger : colors.blue} />
            <View style={{ flex: 1 }}>
              <Label weight="600">
                {p.name || t("مرکز درمانی بدون نام", "Unnamed care center")}
              </Label>
              <Label muted size={11}>
                {p.distance.toFixed(1)} km ·{" "}
                {t("فاصله مستقیم", "straight-line distance")}
              </Label>
            </View>
          </Row>
          {/* Controls stay siblings of the card, never nested buttons. */}
          <Row style={{ flexWrap: "wrap" }}>
            <Button
              secondary
              title={
                selected === p.id
                  ? t("حذف از نقشه", "Clear on map")
                  : t("نمایش روی نقشه", "Show on map")
              }
              onPress={() => setSelected(selected === p.id ? null : p.id)}
            />
            <Button
              secondary
              title={t("مسیریابی", "Directions")}
              onPress={() => openDirections(p)}
            />
            {p.phone && (
              <Tap
                accessibilityLabel={t("تماس", "Call")}
                onPress={() =>
                  Linking.openURL(
                    "tel:" + p.phone!.replace(/[^+\d]/g, ""),
                  ).catch(() =>
                    setMessage(
                      t(
                        "تماس در این دستگاه ممکن نیست.",
                        "Calls are unavailable here.",
                      ),
                    ),
                  )
                }
              >
                <Phone color={colors.blue} />
              </Tap>
            )}
          </Row>
        </Card>
      ))}
      {searched && !visible.length && (
        <Label muted>
          {t(
            `در این دسته، نتیجه‌ای در شعاع ${RADIUS_KM} کیلومتر پیدا نشد.`,
            `No results in this category within ${RADIUS_KM} km.`,
          )}
        </Label>
      )}
      {origin && (
        <Label muted size={10}>
          {t(
            "داده‌های OpenStreetMap ممکن است کامل نباشند. نشانگرها با مختصات واقعی روی نقشه قرار می‌گیرند.",
            "OpenStreetMap listings may be incomplete. Markers are placed at real coordinates.",
          )}
        </Label>
      )}
    </>
  );
}
