import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
const state = {
  language: "fa",
  theme: "light",
  calendar: "persian",
  members: [{ id: "self", name: "Test", relation: "" }],
  medicines: [],
  appointments: [],
  records: [],
  metrics: [],
};
test("database isolates accounts, enforces revisions and rejects unauthorized writes", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role; create schema auth; create schema storage; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid,name text,bucket_id text); alter table storage.objects enable row level security; create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; insert into auth.users values('${A}'),('${B}');`,
    );
    // Apply every migration in order, matching a real Supabase deploy.
    const migrations = new URL("../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(migrations))
      .filter((name) => name.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL(file, migrations), "utf8"));
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${A}',false);`,
    );
    const load = await db.query(
      "select public.load_health_state($1::uuid) as data",
      [A],
    );
    assert.equal(load.rows[0].data.version, 0);
    await db.query("select public.save_health_state($1::jsonb,0,$2::uuid)", [
      JSON.stringify({
        ...state,
        medicines: [
          {
            id: "m",
            memberId: "self",
            name: "A private item",
            dose: "sample",
            time: "08:00",
            stock: 2,
            history: [],
            notificationId: "device-only",
          },
        ],
      }),
      A,
    ]);
    await assert.rejects(
      db.query("select public.save_health_state($1::jsonb,0,$2::uuid)", [
        JSON.stringify(state),
        A,
      ]),
      /VERSION_CONFLICT/,
    );
    await assert.rejects(
      db.query("select public.load_health_state($1::uuid)", [B]),
      /UNAUTHORIZED/,
    );
    await assert.rejects(
      db.query(
        "insert into public.health_entries values($1,'members','x','{}')",
        [A],
      ),
      /permission denied/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${B}',false)`);
    assert.equal(
      (await db.query("select * from public.health_entries")).rows.length,
      0,
    );
    const other = await db.query(
      "select public.load_health_state($1::uuid) as data",
      [B],
    );
    assert.equal(other.rows[0].data.state.medicines.length, 0);
    await assert.rejects(
      db.query("select public.save_health_state($1::jsonb,0,$2::uuid)", [
        JSON.stringify(state),
        A,
      ]),
      /UNAUTHORIZED/,
    );
    await assert.rejects(
      db.query("select public.save_health_state($1::jsonb,0,$2::uuid)", [
        JSON.stringify({
          ...state,
          medicines: [{ id: "bad", memberId: "stranger" }],
        }),
        B,
      ]),
      /INVALID_MEMBER/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${A}',false)`);
    const own = await db.query(
      "select public.load_health_state($1::uuid) as data",
      [A],
    );
    assert.equal(own.rows[0].data.state.medicines[0].name, "A private item");
    assert.equal(own.rows[0].data.state.medicines[0].notificationId, undefined);
    await db.exec("reset role; set role anon;");
    await assert.rejects(
      db.query("select public.load_health_state($1::uuid)", [A]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
