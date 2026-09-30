import React, { createContext, useContext } from "react";
import {
  Image,
  Platform,
  Pressable as NativePressable,
  PressableProps,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronRight, Plus, Heart } from "lucide-react-native";
import { Text } from "./Typography";

export const palettes = {
  light: {
    bg: "#F8FBFF",
    card: "#FFFFFF",
    text: "#101A46",
    muted: "#8998B7",
    line: "#EAF0FA",
    soft: "#F1F6FF",
    blue: "#327BFF",
    green: "#08BA8A",
    danger: "#F75D76",
  },
  dark: {
    bg: "#101B2C",
    card: "#1B293D",
    text: "#F4F7FF",
    muted: "#94A6C5",
    line: "#293B55",
    soft: "#23344E",
    blue: "#699FFF",
    green: "#48D6AD",
    danger: "#FF8295",
  },
};
export const UIContext = createContext({ colors: palettes.light, fa: true });
export const useUI = () => useContext(UIContext);

// Native buttons retain native press handling; web uses the browser click event.
export function Tap({ onPress, ...props }: PressableProps) {
  if (Platform.OS === "web") {
    const { children, style, disabled, ...rest } = props;
    const webEvents = {
      tabIndex: (disabled ? -1 : 0) as -1 | 0,
      onClick: (event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        if (!disabled) onPress?.(event as never);
      },
      onKeyDown: (event: {
        key: string;
        preventDefault: () => void;
        stopPropagation: () => void;
      }) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          event.stopPropagation();
          onPress?.(event as never);
        }
      },
    };
    return (
      <View
        accessibilityRole="button"
        {...rest}
        {...webEvents}
        accessibilityState={{
          ...props.accessibilityState,
          disabled: !!disabled,
        }}
        style={typeof style === "function" ? style({ pressed: false }) : style}
      >
        {typeof children === "function"
          ? children({ pressed: false })
          : children}
      </View>
    );
  }
  return (
    <NativePressable accessibilityRole="button" {...props} onPress={onPress} />
  );
}
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { fa } = useUI();
  return (
    <View
      style={[
        {
          flexDirection: fa ? "row-reverse" : "row",
          alignItems: "center",
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Label({
  children,
  muted = false,
  size = 14,
  weight = "400",
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  size?: number;
  weight?: "300" | "400" | "500" | "600" | "700";
  style?: object;
}) {
  const { colors, fa } = useUI();
  return (
    <Text
      style={[
        {
          color: muted ? colors.muted : colors.text,
          textAlign: fa ? "right" : "left",
          fontSize: size,
          fontWeight: weight,
          lineHeight: size * 1.8,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const { colors } = useUI();
  const body = (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 19,
          padding: 16,
          marginBottom: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  return onPress ? <Tap onPress={onPress}>{body}</Tap> : body;
}
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useUI();
  return (
    <Tap
      disabled={disabled}
      onPress={onPress}
      style={{ opacity: disabled ? 0.5 : 1, marginVertical: 6 }}
    >
      <LinearGradient
        colors={
          secondary
            ? [colors.soft, colors.soft]
            : danger
              ? ["#FFF0F2", "#FFF0F2"]
              : ["#2D9BFF", "#3863FF"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          padding: 13,
          borderRadius: 15,
          alignItems: "center",
          borderWidth: 1,
          borderColor: danger ? "#FFD4DB" : secondary ? colors.line : "#4989FF",
        }}
      >
        <Text
          style={{
            fontWeight: "500",
            fontSize: 15,
            color: danger ? colors.danger : secondary ? colors.blue : "#FFF",
          }}
        >
          {title}
        </Text>
      </LinearGradient>
    </Tap>
  );
}
export function BackIcon() {
  const { fa, colors } = useUI();
  return fa ? (
    <ChevronLeft size={23} color={colors.text} />
  ) : (
    <ChevronRight size={23} color={colors.text} />
  );
}
export function Brand({ size = 68 }: { size?: number }) {
  return (
    <View
      style={{
        width: size * 1.25,
        height: size * 1.2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 2,
          transform: [{ rotate: "20deg" }],
        }}
      >
        <Heart
          size={size * 0.88}
          fill="#5ED9AE"
          color="#69E3BF"
          strokeWidth={1}
        />
      </View>
      <LinearGradient
        colors={["#04D9EF", "#3C56FD"]}
        style={{
          width: size * 0.83,
          height: size * 0.83,
          borderRadius: size * 0.28,
          transform: [{ rotate: "-45deg" }],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Plus
          size={size * 0.58}
          color="white"
          strokeWidth={5}
          style={{ transform: [{ rotate: "45deg" }] }}
        />
      </LinearGradient>
    </View>
  );
}
export function Illustration({
  kind,
  width = 250,
}: {
  kind: "doctor" | "checklist" | "family";
  width?: number;
}) {
  const crops = {
    doctor: { x: 215, y: 58, w: 153, h: 161 },
    checklist: { x: 397, y: 51, w: 162, h: 160 },
    family: { x: 585, y: 43, w: 165, h: 168 },
  };
  const c = crops[kind];
  const scale = width / c.w;
  return (
    <View
      style={{
        width,
        height: c.h * scale,
        overflow: "hidden",
        borderRadius: 30,
      }}
    >
      <Image
        source={require("../../assets/reference.png")}
        style={{
          position: "absolute",
          width: 1536 * scale,
          height: 1024 * scale,
          left: -c.x * scale,
          top: -c.y * scale,
        }}
        resizeMode="stretch"
      />
    </View>
  );
}
export function Avatar({
  index = 0,
  size = 46,
}: {
  index?: number;
  size?: number;
}) {
  const colors = ["#E5F2FF", "#FFF1DF", "#E7F7F0", "#F2E9FF"];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors[index % 4],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.58 }}>
        {["👨🏻", "👩🏻", "👨🏻‍🦳", "👩🏻‍🦰"][index % 4]}
      </Text>
    </View>
  );
}
export const uiStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 49,
  },
  center: { alignItems: "center", justifyContent: "center" },
  section: { marginTop: 12, marginBottom: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16 },
  icon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
