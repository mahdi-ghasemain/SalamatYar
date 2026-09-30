import React from "react";
import { Modal, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Button, Label } from "./TemplateUI";
export default function BarcodeScanner({
  visible,
  onClose,
  onScan,
}: {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, padding: 25, backgroundColor: "#F8FBFF" }}>
        <Label weight="700">اسکن بارکد / Scan barcode</Label>
        {permission?.granted ? (
          <CameraView
            style={{ flex: 1, marginVertical: 20 }}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "code128", "qr", "datamatrix"],
            }}
            onBarcodeScanned={
              visible ? (result) => onScan(result.data) : undefined
            }
          />
        ) : (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Label>
              برای اسکن، دسترسی دوربین لازم است. / Camera permission is needed.
            </Label>
            <Button
              title="اجازه دوربین / Allow camera"
              onPress={() => {
                void requestPermission();
              }}
            />
          </View>
        )}
        <Label muted size={12}>
          بارکد ثبت می‌شود؛ نام و دستور مصرف باید از نسخه وارد شود. / Enter the
          prescribed name and instructions manually.
        </Label>
        <Button secondary title="بستن / Close" onPress={onClose} />
      </View>
    </Modal>
  );
}
