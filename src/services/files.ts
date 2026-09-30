import { Linking, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { Directory, File, Paths } from "expo-file-system";
import { Attachment, id, State } from "../core/model";
import { requireBackend } from "./supabase";
import { cloudState } from "./cloud";
import { validateBackup } from "./backupValidation";

const pendingFiles = new Map<string, { bytes: Uint8Array; owner?: string }>();
export function discardPendingFiles() {
  pendingFiles.clear();
}
export async function pickAttachment(
  owner?: string,
): Promise<Attachment | null> {
  if (!owner && Platform.OS === "web") throw new Error("SIGN_IN_FOR_FILES");
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/jpeg", "image/png", "application/pdf"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size || 0) > 10 * 1024 * 1024) throw new Error("MAX_10_MB");
  const bytes =
    Platform.OS === "web" && asset.file
      ? new Uint8Array(await asset.file.arrayBuffer())
      : await new File(asset.uri).bytes();
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("MAX_10_MB");
  const mime = asset.mimeType || "";
  if (!["application/pdf", "image/jpeg", "image/png"].includes(mime))
    throw new Error("UNSUPPORTED_FILE");
  const path = "pending:" + id();
  pendingFiles.clear();
  pendingFiles.set(path, { bytes, owner });
  return { name: asset.name, mime, size: bytes.length, path, cloud: false };
}
export async function commitAttachment(
  attachment: Attachment | undefined,
  owner?: string,
): Promise<Attachment | undefined> {
  if (!attachment || !attachment.path.startsWith("pending:")) return attachment;
  const staged = pendingFiles.get(attachment.path);
  if (!staged || staged.owner !== owner)
    throw new Error("FILE_SESSION_CHANGED");
  const extension =
    attachment.mime === "application/pdf"
      ? "pdf"
      : attachment.mime === "image/png"
        ? "png"
        : "jpg";
  if (owner) {
    const path = owner + "/" + id() + "." + extension;
    const { error } = await requireBackend()
      .storage.from("health-records")
      .upload(path, staged.bytes, {
        contentType: attachment.mime,
        upsert: false,
      });
    if (error) throw error;
    pendingFiles.delete(attachment.path);
    return { ...attachment, path, cloud: true };
  }
  const folder = new Directory(Paths.document, "records");
  folder.create({ idempotent: true, intermediates: true });
  const target = new File(folder, id() + "." + extension);
  target.write(staged.bytes);
  pendingFiles.delete(attachment.path);
  return { ...attachment, path: target.uri, cloud: false };
}
export async function openAttachment(attachment: Attachment) {
  if (attachment.cloud) {
    const { data, error } = await requireBackend()
      .storage.from("health-records")
      .createSignedUrl(attachment.path, 60);
    if (error) throw error;
    await Linking.openURL(data.signedUrl);
  } else if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(attachment.path, { mimeType: attachment.mime });
  else throw new Error("FILE_VIEW_UNAVAILABLE");
}
export async function deleteAttachment(attachment?: Attachment) {
  if (!attachment) return;
  if (attachment.cloud) {
    const { error } = await requireBackend()
      .storage.from("health-records")
      .remove([attachment.path]);
    if (error) throw error;
  } else {
    const file = new File(attachment.path);
    if (file.exists) file.delete();
  }
}
export async function exportBackup(state: State) {
  const data = JSON.stringify(
    { format: "salamatyar", version: 1, state: cloudState(state) },
    null,
    2,
  );
  const filename = `salamatyar-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } else {
    const file = new File(Paths.cache, filename);
    file.write(data);
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("SHARING_UNAVAILABLE");
    await Sharing.shareAsync(file.uri, { mimeType: "application/json" });
  }
}
export async function readBackup(): Promise<State | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size || 0) > 2000000) throw new Error("BACKUP_TOO_LARGE");
  const text =
    Platform.OS === "web" && asset.file
      ? await asset.file.text()
      : await new File(asset.uri).text();
  if (text.length > 2000000) throw new Error("BACKUP_TOO_LARGE");
  const parsed = JSON.parse(text);
  if (parsed.format !== "salamatyar" || parsed.version !== 1)
    throw new Error("INVALID_BACKUP");
  const state = validateBackup(parsed.state);
  return {
    ...state,
    medicines: state.medicines.map(({ notificationId, ...m }) => m),
    appointments: state.appointments.map(({ notificationId, ...a }) => a),
  };
}
