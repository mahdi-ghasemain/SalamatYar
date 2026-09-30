import React from "react";
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  TextProps,
  TextInputProps,
  TextStyle,
} from "react-native";

export const fontFamilies = {
  300: "Vazirmatn_300Light",
  400: "Vazirmatn_400Regular",
  500: "Vazirmatn_500Medium",
  600: "Vazirmatn_600SemiBold",
  700: "Vazirmatn_700Bold",
} as const;

function fontStyle(style: TextProps["style"]): TextStyle {
  const weight = StyleSheet.flatten(style)?.fontWeight ?? "400";
  const numeric =
    weight === "bold" ? 700 : weight === "normal" ? 400 : Number(weight);
  const key =
    numeric >= 700
      ? 700
      : numeric >= 600
        ? 600
        : numeric >= 500
          ? 500
          : numeric <= 300
            ? 300
            : 400;
  // Each weight is a bundled font face. Avoid synthetic bold on Android.
  return { fontFamily: fontFamilies[key], fontWeight: "normal" };
}

export function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[style, fontStyle(style)]} />;
}

export function TextInput({ style, ...props }: TextInputProps) {
  return <NativeTextInput {...props} style={[style, fontStyle(style)]} />;
}
