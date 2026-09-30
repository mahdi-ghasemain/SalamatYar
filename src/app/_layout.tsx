import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Store } from "../core/store";
import { AuthProvider } from "../services/auth";
import { ActivityIndicator, Text, View } from "react-native";
import {
  useFonts,
  Vazirmatn_300Light,
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_600SemiBold,
  Vazirmatn_700Bold,
} from "@expo-google-fonts/vazirmatn";

export default function Layout() {
  const [loaded, error] = useFonts({
    Vazirmatn_300Light,
    Vazirmatn_400Regular,
    Vazirmatn_500Medium,
    Vazirmatn_600SemiBold,
    Vazirmatn_700Bold,
  });
  if (!loaded)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F7F8FC",
        }}
      >
        {error ? (
          <Text>
            بارگذاری فونت ناموفق بود. برنامه را دوباره باز کنید. / Could not
            load fonts. Please reopen.
          </Text>
        ) : (
          <ActivityIndicator color="#5263ED" />
        )}
      </View>
    );
  return (
    <AuthProvider>
      <Store>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </Store>
    </AuthProvider>
  );
}
