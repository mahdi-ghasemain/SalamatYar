import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { bboxFor, mapEmbedUrl, Point, projectToBox } from "../services/geo";

export type MapMarker = Point & {
  id?: string;
  label?: string;
  kind?: string;
  /** The device location; always drawn with the accent colour. */
  self?: boolean;
  selected?: boolean;
};

/**
 * Real OpenStreetMap surroundings with every marker positioned by its true
 * coordinates. The tile frame fits the whole set, so nearby care centers are
 * visible around the device location rather than a single point.
 */
export default function LiveMap({
  markers,
  onError,
}: {
  markers: MapMarker[];
  onError: () => void;
}) {
  if (!markers.length) return null;
  const box = bboxFor(markers, 0.02);
  const uri = mapEmbedUrl(box);
  return (
    <View
      style={{
        height: 320,
        borderRadius: 20,
        overflow: "hidden",
        marginVertical: 16,
        backgroundColor: "#EAF0FA",
      }}
    >
      {Platform.OS === "web" ? (
        React.createElement("iframe", {
          src: uri,
          title: "OpenStreetMap",
          style: { border: 0, width: "100%", height: "100%" },
          loading: "lazy",
          referrerPolicy: "no-referrer",
          onError,
        })
      ) : (
        <WebView
          source={{ uri }}
          originWhitelist={["https://www.openstreetmap.org"]}
          onShouldStartLoadWithRequest={(r) =>
            r.url.startsWith("https://www.openstreetmap.org/")
          }
          onError={onError}
          onHttpError={onError}
          setSupportMultipleWindows={false}
          sharedCookiesEnabled={false}
        />
      )}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {markers.map((marker, index) => {
          const { x, y } = projectToBox(marker, box);
          const color = marker.self
            ? "#327BFF"
            : marker.selected
              ? "#F75D76"
              : "#08BA8A";
          const size = marker.selected ? 20 : 14;
          return (
            <View
              key={marker.id || `marker-${index}`}
              accessibilityLabel={marker.label}
              style={{
                position: "absolute",
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderRadius: size / 2,
                backgroundColor: color,
                borderWidth: 2,
                borderColor: "#FFFFFF",
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
