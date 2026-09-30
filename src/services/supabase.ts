import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
export const backendConfigured =
  /^https:\/\//.test(url) &&
  !url.includes("YOUR_PROJECT") &&
  key.length > 30 &&
  !key.includes("REPLACE_ME") &&
  !key.startsWith("sb_secret_");
// SecureStore entries are kept small; publishing the manifest is the commit point.
// Any SecureStore failure falls back to AsyncStorage so sign-in never bricks.
const secureStorage = {
  async getItem(name: string) {
    try {
      const manifest = await SecureStore.getItemAsync(name);
      if (!manifest) return await AsyncStorage.getItem(name);
      const { version, count } = JSON.parse(manifest);
      const chunks = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          SecureStore.getItemAsync(`${name}.${version}.${i}`),
        ),
      );
      if (chunks.some((c) => c === null))
        return await AsyncStorage.getItem(name);
      return chunks.join("");
    } catch {
      return await AsyncStorage.getItem(name);
    }
  },
  async setItem(name: string, value: string) {
    try {
      const previous = await SecureStore.getItemAsync(name);
      const version = `${Date.now()}${Math.random().toString(36).slice(2)}`;
      const chunks = value.match(/.{1,1500}/gs) || [""];
      for (let i = 0; i < chunks.length; i++)
        await SecureStore.setItemAsync(`${name}.${version}.${i}`, chunks[i]);
      await SecureStore.setItemAsync(
        name,
        JSON.stringify({ version, count: chunks.length }),
      );
      if (previous) {
        const old = JSON.parse(previous);
        await Promise.all(
          Array.from({ length: old.count }, (_, i) =>
            SecureStore.deleteItemAsync(`${name}.${old.version}.${i}`),
          ),
        );
      }
      await AsyncStorage.removeItem(name).catch(() => {});
    } catch {
      await AsyncStorage.setItem(name, value);
    }
  },
  async removeItem(name: string) {
    try {
      const previous = await SecureStore.getItemAsync(name);
      await SecureStore.deleteItemAsync(name);
      if (previous) {
        const old = JSON.parse(previous);
        await Promise.all(
          Array.from({ length: old.count }, (_, i) =>
            SecureStore.deleteItemAsync(`${name}.${old.version}.${i}`),
          ),
        );
      }
    } catch {
      // Fall through to AsyncStorage cleanup below.
    }
    await AsyncStorage.removeItem(name).catch(() => {});
  },
};
export const supabase = backendConfigured
  ? createClient(url, key, {
      auth: {
        storage: Platform.OS === "web" ? AsyncStorage : secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    })
  : null;
export function requireBackend() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}
