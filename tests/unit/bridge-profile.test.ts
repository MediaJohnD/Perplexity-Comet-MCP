import { describe, it, expect } from "vitest";
import { bridgeProfileDir, cometLaunchArgs } from "../../src/cdp-client.js";

describe("bridge profile", () => {
  it("defaults to its own profile under LOCALAPPDATA on Windows", () => {
    expect(bridgeProfileDir({ LOCALAPPDATA: "C:\\L" }, true)).toMatch(/CometBridgeProfile$/);
  });
  it("can be turned off", () => {
    expect(bridgeProfileDir({ LOCALAPPDATA: "C:\\L", COMET_USER_DATA_DIR: "none" }, true)).toBeNull();
    expect(bridgeProfileDir({ LOCALAPPDATA: "C:\\L", COMET_USER_DATA_DIR: "" }, true)).toBeNull();
  });
  it("honours an explicit directory", () => {
    expect(bridgeProfileDir({ COMET_USER_DATA_DIR: "D:\\p" }, true)).toBe("D:\\p");
  });
  it("is off outside Windows unless set", () => {
    expect(bridgeProfileDir({}, false)).toBeNull();
  });
  it("adds the profile to the launch args", () => {
    const a = cometLaunchArgs(9231, "D:\\p");
    expect(a).toContain("--remote-debugging-port=9231");
    expect(a).toContain("--user-data-dir=D:\\p");
    expect(a).toContain("--no-first-run");
  });
  it("keeps the old args without a profile", () => {
    expect(cometLaunchArgs(9223, null)).toEqual([
      "--remote-debugging-port=9223",
      "--remote-allow-origins=http://127.0.0.1",
    ]);
  });
});
