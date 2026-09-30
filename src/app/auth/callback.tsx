import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Text } from "../../components/Typography";
import { completeAuth, useAuth } from "../../services/auth";
export default function Callback() {
  const params = useLocalSearchParams<{
    code?: string;
    error_description?: string;
  }>();
  const [error, setError] = useState("");
  const { recovery } = useAuth();
  useEffect(() => {
    let alive = true;
    const url =
      "salamatyar://auth/callback?" +
      new URLSearchParams({
        ...(params.code ? { code: params.code } : {}),
        ...(params.error_description
          ? { error_description: params.error_description }
          : {}),
      }).toString();
    completeAuth(url)
      .then(() => {
        if (alive) router.replace(recovery ? "/login" : "/");
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [params.code, params.error_description, recovery]);
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 25,
      }}
    >
      {error ? <Text>{error}</Text> : <ActivityIndicator color="#327BFF" />}
    </View>
  );
}
