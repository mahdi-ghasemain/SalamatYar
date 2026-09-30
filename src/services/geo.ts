export type Point = { latitude: number; longitude: number };
export type BBox = { south: number; west: number; north: number; east: number };

// Web Mercator cannot represent the poles; clamp before projecting.
const MERCATOR_MAX_LAT = 85.05112878;
const clampLat = (value: number) =>
  Math.min(MERCATOR_MAX_LAT, Math.max(-MERCATOR_MAX_LAT, value));
const clampLon = (value: number) => Math.min(180, Math.max(-180, value));

export function distanceKm(a: Point, b: Point) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dlat = rad(b.latitude - a.latitude),
    dlon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
/**
 * Bounding box that contains every point with a small margin, so a single
 * location still shows its real neighbourhood instead of an empty frame.
 */
export function bboxFor(points: Point[], padding = 0.02, minSpan = 0.01): BBox {
  const lats = points.map((p) => clampLat(p.latitude));
  const lons = points.map((p) => clampLon(p.longitude));
  const south = Math.min(...lats) - padding;
  const north = Math.max(...lats) + padding;
  const west = Math.min(...lons) - padding;
  const east = Math.max(...lons) + padding;
  const latMid = (north + south) / 2,
    lonMid = (west + east) / 2;
  const latSpan = Math.max(north - south, minSpan),
    lonSpan = Math.max(east - west, minSpan);
  return {
    south: clampLat(latMid - latSpan / 2),
    north: clampLat(latMid + latSpan / 2),
    west: clampLon(lonMid - lonSpan / 2),
    east: clampLon(lonMid + lonSpan / 2),
  };
}
/** Static OpenStreetMap frame that fits exactly the supplied bounding box. */
export function mapEmbedUrl(box: BBox) {
  return (
    "https://www.openstreetmap.org/export/embed.html?" +
    new URLSearchParams({
      bbox: `${box.west},${box.south},${box.east},${box.north}`,
      layer: "mapnik",
    }).toString()
  );
}
export function mapUrl(point: Point) {
  return mapEmbedUrl(bboxFor([point], 0.025));
}
const mercatorY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (clampLat(lat) * Math.PI) / 360));
/** Fractional position (0..1) of a point inside a map frame using mercator Y. */
export function projectToBox(point: Point, box: BBox) {
  const north = mercatorY(box.north),
    south = mercatorY(box.south);
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  return {
    x: clamp01((clampLon(point.longitude) - box.west) / (box.east - box.west)),
    y: clamp01((north - mercatorY(point.latitude)) / (north - south)),
  };
}
export type Place = {
  id: string;
  name: string;
  kind: string;
  point: Point;
  phone?: string;
  distance: number;
};
export function placesFromOSM(elements: unknown[], origin: Point): Place[] {
  return elements
    .flatMap((raw) => {
      const e = raw as {
        id: number;
        type: string;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      };
      const latitude = e.lat ?? e.center?.lat,
        longitude = e.lon ?? e.center?.lon;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      const point = { latitude: latitude!, longitude: longitude! };
      return [
        {
          id: `${e.type}-${e.id}`,
          name: e.tags?.["name:fa"] || e.tags?.name || "",
          kind:
            e.tags?.healthcare === "laboratory"
              ? "laboratory"
              : e.tags?.amenity || "clinic",
          point,
          phone: e.tags?.phone || e.tags?.["contact:phone"],
          distance: distanceKm(origin, point),
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance);
}
