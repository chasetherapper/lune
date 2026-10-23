import { updaterState } from "@ardia/shell";
import { afterFirstWindow } from "./afterFirstWindow";
import { refreshSwitches } from "./killSwitches";

const REMOTE_SWITCHES = false;

export function startKillSwitches() {
  if (!REMOTE_SWITCHES) return;
  afterFirstWindow(() => {
    void updaterState().then(
      (state) => {
        if (state.available && state.configured && state.automaticChecks) void refreshSwitches();
      },
      () => {},
    );
  });
}
