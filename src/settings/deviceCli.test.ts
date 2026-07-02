import { describe, expect, test } from "vitest";
import { getCliDeviceKey, getResolvedCliPathForCurrentDevice, withResolvedCliPathForCurrentDevice } from "./deviceCli";
import { DEFAULT_SETTINGS } from "./defaults";

describe("device CLI cache", () => {
  test("keys resolved CLI paths by platform and host", () => {
    expect(getCliDeviceKey("win32", "desk-1")).toBe("win32:desk-1");
  });

  test("stores and reads the resolved path for the current device only", () => {
    const settings = withResolvedCliPathForCurrentDevice(DEFAULT_SETTINGS, "C:\\Users\\me\\AppData\\Roaming\\npm\\dida.cmd", "win32:desk-1");

    expect(getResolvedCliPathForCurrentDevice(settings, "win32:desk-1")).toBe("C:\\Users\\me\\AppData\\Roaming\\npm\\dida.cmd");
    expect(getResolvedCliPathForCurrentDevice(settings, "darwin:mac-1")).toBe("");
  });
});
