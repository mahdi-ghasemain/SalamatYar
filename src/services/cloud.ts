import { initialState, State } from "../core/model";
import { requireBackend } from "./supabase";
import { validateBackup } from "./backupValidation";

export function cloudState(state: State): State {
  return {
    ...state,
    appointments: state.appointments.map(
      ({ notificationId, ...visit }) => visit,
    ),
    medicines: state.medicines.map(
      ({ notificationId, ...medicine }) => medicine,
    ),
    records: state.records.map((r) => ({
      ...r,
      attachment: r.attachment?.cloud ? r.attachment : undefined,
    })),
  };
}
export async function readCloud(
  owner: string,
): Promise<{ state: State; version: number }> {
  const { data, error } = await requireBackend().rpc("load_health_state", {
    expected_owner: owner,
  });
  if (error) throw error;
  return {
    state: validateBackup({ ...initialState, ...data.state, welcomed: true }),
    version: data.version,
  };
}
export async function writeCloud(
  state: State,
  version: number,
  owner: string,
): Promise<number> {
  const { data, error } = await requireBackend().rpc("save_health_state", {
    payload: cloudState(state),
    expected_version: version,
    expected_owner: owner,
  });
  if (error) throw error;
  return data;
}
