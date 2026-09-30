import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initialState, State } from "./model";
import { demoState } from "./demo";
import { useAuth } from "../services/auth";
import { readCloud, writeCloud } from "../services/cloud";
import {
  cancelReminder,
  restoreReminders,
  restoreVisitReminders,
} from "./notifications";
import { validateBackup } from "../services/backupValidation";

type Status = "local" | "saved" | "saving" | "error";
type StoreValue = {
  state: State;
  update: (fn: (state: State) => State) => void;
  ready: boolean;
  error: string;
  demo: boolean;
  setDemo: (enabled: boolean) => void;
  syncStatus: Status;
  retry: () => Promise<void>;
  reload: () => Promise<void>;
};
const Context = createContext<StoreValue>({
  state: initialState,
  update: () => {},
  ready: false,
  error: "",
  demo: false,
  setDemo: () => {},
  syncStatus: "local",
  retry: async () => {},
  reload: async () => {},
});
export function Store({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAuth();
  if (!ready)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  return (
    <AccountStore key={session?.user.id || "guest"} owner={session?.user.id}>
      {children}
    </AccountStore>
  );
}
function AccountStore({
  children,
  owner,
}: {
  children: React.ReactNode;
  owner?: string;
}) {
  const [state, setState] = useState(initialState),
    [sample, setSample] = useState<State | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [syncStatus, setSyncStatus] = useState<Status>(owner ? "saved" : "local");
  const current = useRef(initialState),
    version = useRef(0),
    alive = useRef(true),
    dirty = useRef(false),
    failed = useRef(false),
    running = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef(Promise.resolve());
  async function reload() {
    try {
      const result = owner ? await readCloud(owner) : null;
      const raw = owner ? null : await AsyncStorage.getItem("salamatyar-v1");
      const next =
        result?.state || (raw ? validateBackup(JSON.parse(raw)) : initialState);
      if (owner) next.medicines = await restoreReminders(next.medicines, owner);
      if (owner)
        next.appointments = await restoreVisitReminders(
          next.appointments,
          owner,
        );
      if (!alive.current) return;
      current.current = next;
      version.current = result?.version || 0;
      dirty.current = false;
      failed.current = false;
      setState(next);
      setError("");
      setReady(true);
      setSyncStatus(owner ? "saved" : "local");
    } catch {
      if (alive.current) {
        setError(
          "اطلاعات خوانده نشد؛ اتصال یا تنظیمات سرویس را بررسی و دوباره تلاش کنید. / Could not load data. Check connection and backend setup.",
        );
        setSyncStatus("error");
      }
    }
  }
  useEffect(() => {
    alive.current = true;
    // This asynchronous read synchronizes the keyed provider with external storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (owner)
        [...current.current.medicines, ...current.current.appointments].forEach(
          (m) => {
            void cancelReminder(m.notificationId).catch(() => {});
          },
        );
    };
    // The keyed provider is recreated for each account; loading synchronizes external storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);
  async function flush() {
    if (!owner || running.current || !alive.current || !dirty.current) return;
    running.current = true;
    setSyncStatus("saving");
    try {
      while (dirty.current && alive.current) {
        const snapshot = current.current;
        dirty.current = false;
        version.current = await writeCloud(snapshot, version.current, owner);
      }
      if (alive.current) {
        failed.current = false;
        setSyncStatus("saved");
        setError("");
      }
    } catch {
      dirty.current = true;
      failed.current = true;
      if (alive.current) {
        setSyncStatus("error");
        setError(
          "ذخیره ابری انجام نشد. اتصال یا تغییر همزمان در دستگاه دیگر را بررسی کنید؛ ویرایش‌ها هنوز روی این صفحه هستند. / Cloud save failed. Check connection or concurrent edits. Your edits remain in this session.",
        );
      }
    } finally {
      running.current = false;
    }
  }
  const update = (fn: (state: State) => State) => {
    if (!ready) return;
    if (sample) {
      setSample((s) => (s ? fn(s) : s));
      return;
    }
    const next = fn(current.current);
    current.current = next;
    setState(next);
    if (owner) {
      dirty.current = true;
      setSyncStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (!failed.current) void flush();
      }, 700);
    } else {
      queue.current = queue.current
        .then(() => AsyncStorage.setItem("salamatyar-v1", JSON.stringify(next)))
        .then(() => {
          if (alive.current) setError("");
        })
        .catch(() => {
          if (alive.current) {
            setError("ذخیره محلی انجام نشد / Local save failed");
            setSyncStatus("error");
          }
        });
    }
  };
  async function retry() {
    if (!ready) {
      await reload();
      return;
    }
    if (owner) {
      failed.current = false;
      await flush();
    } else {
      try {
        await AsyncStorage.setItem(
          "salamatyar-v1",
          JSON.stringify(current.current),
        );
        setSyncStatus("local");
        setError("");
      } catch {
        setError("ذخیره انجام نشد / Save failed");
      }
    }
  }
  return (
    <Context.Provider
      value={{
        state: sample || state,
        update,
        ready,
        error,
        demo: !!sample,
        setDemo: (enabled) =>
          setSample(
            enabled
              ? {
                  ...demoState(),
                  language: state.language,
                  calendar: state.calendar,
                }
              : null,
          ),
        syncStatus,
        retry,
        reload,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
