import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bboxFor,
  distanceKm,
  mapEmbedUrl,
  mapUrl,
  placesFromOSM,
  projectToBox,
} from "../src/services/geo.ts";
import { validateBackup } from "../src/services/backupValidation.ts";
import { initialState } from "../src/core/model.ts";
test("distance and map use real coordinates", () => {
  const a = { latitude: 35.7, longitude: 51.4 };
  assert.equal(distanceKm(a, a), 0);
  assert.ok(distanceKm(a, { latitude: 35.71, longitude: 51.4 }) > 1);
  const box = bboxFor([a]);
  assert.ok(box.south < a.latitude && a.latitude < box.north);
  assert.ok(box.west < a.longitude && a.longitude < box.east);
  const url = new URL(mapEmbedUrl(box));
  assert.equal(url.origin, "https://www.openstreetmap.org");
  assert.equal(
    url.searchParams.get("bbox"),
    `${box.west},${box.south},${box.east},${box.north}`,
  );
  assert.equal(new URL(mapUrl(a)).searchParams.get("layer"), "mapnik");
  // The device location sits in the middle of the frame and real coordinates
  // on the frame edges map to the frame edges.
  const middle = projectToBox(a, box);
  assert.ok(Math.abs(middle.x - 0.5) < 0.01 && Math.abs(middle.y - 0.5) < 0.01);
  const corner = projectToBox(
    { latitude: box.north, longitude: box.west },
    box,
  );
  assert.ok(corner.x < 0.01 && corner.y < 0.01);
  const wide = bboxFor([a, { latitude: 35.6, longitude: 51.5 }]);
  assert.ok(
    wide.south < 35.6 &&
      wide.north > 35.7 &&
      wide.west < 51.4 &&
      wide.east > 51.5,
  );
  const results = placesFromOSM(
    [
      {
        id: 1,
        type: "node",
        lat: 35.701,
        lon: 51.4,
        tags: { name: "test", amenity: "pharmacy" },
      },
      { id: 2, type: "node" },
    ],
    a,
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].kind, "pharmacy");
});
test("restore validates membership, dates and inventory before replacing data", () => {
  assert.equal(validateBackup(initialState).members[0].id, "self");
  assert.throws(() => validateBackup({ members: [] }));
  assert.throws(() =>
    validateBackup({
      ...initialState,
      medicines: [
        {
          id: "x",
          memberId: "other",
          name: "test",
          dose: "test",
          stock: 1,
          time: "08:00",
          history: [],
        },
      ],
    }),
  );
  assert.throws(() =>
    validateBackup({
      ...initialState,
      medicines: [
        {
          id: "x",
          memberId: "self",
          name: "test",
          dose: "test",
          stock: -1,
          time: "08:00",
          history: [],
        },
      ],
    }),
  );
  assert.throws(() =>
    validateBackup({
      ...initialState,
      records: [
        {
          id: "x",
          memberId: "self",
          name: "test",
          note: "",
          date: "2026-02-31",
        },
      ],
    }),
  );
});
