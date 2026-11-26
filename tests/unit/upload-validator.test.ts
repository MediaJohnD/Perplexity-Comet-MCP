/**
 * Unit tests for validateUploadPath() in src/upload-validator.ts.
 *
 * Uses vi.mock to stub out `fs` and `os` so tests run portably on macOS,
 * Windows, and Linux CI — independent of whether /proc or /home exist.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Module-level mocks — must be hoisted before any imports of the module
// ---------------------------------------------------------------------------

const mockRealpathSync = vi.fn<[string], string>();
const mockStatSync = vi.fn();
const mockHomedir = vi.fn(() => "/home/testuser");

vi.mock("fs", () => ({
  realpathSync: mockRealpathSync,
  statSync: mockStatSync,
}));

vi.mock("os", () => ({
  homedir: mockHomedir,
}));

// Import after mocks are registered
const { validateUploadPath } = await import("../../src/upload-validator.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Configure mocks for a "normal file" at the given real path. */
function mockFile(realPath: string): void {
  mockRealpathSync.mockReturnValue(realPath);
  mockStatSync.mockReturnValue({ isFile: () => true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateUploadPath — /proc subtree blocking", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockHomedir.mockReturnValue("/home/testuser");
    delete process.env.COMET_UPLOAD_ROOT;
  });

  it("blocks /proc/self/environ", () => {
    mockFile(resolve("/proc/self/environ"));
    expect(() => validateUploadPath(resolve("/proc/self/environ"))).toThrow(
      /sensitive path/,
    );
  });

  it("blocks /proc/self/maps", () => {
    mockFile(resolve("/proc/self/maps"));
    expect(() => validateUploadPath(resolve("/proc/self/maps"))).toThrow(
      /sensitive path/,
    );
  });

  it("blocks /proc/self/fd/0", () => {
    mockFile(resolve("/proc/self/fd/0"));
    expect(() => validateUploadPath(resolve("/proc/self/fd/0"))).toThrow(
      /sensitive path/,
    );
  });

  it("blocks /proc/1/environ (root process)", () => {
    mockFile(resolve("/proc/1/environ"));
    expect(() => validateUploadPath(resolve("/proc/1/environ"))).toThrow(
      /sensitive path/,
    );
  });

  it("blocks /proc/12345/mem (arbitrary PID memory)", () => {
    mockFile(resolve("/proc/12345/mem"));
    expect(() => validateUploadPath(resolve("/proc/12345/mem"))).toThrow(
      /sensitive path/,
    );
  });

  it("blocks the /proc mount point itself if it ever resolves as a file", () => {
    // /proc as an exact match (real === prefix)
    mockFile(resolve("/proc"));
    expect(() => validateUploadPath(resolve("/proc"))).toThrow(/sensitive path/);
  });
});

describe("validateUploadPath — home-dir sensitive path blocking", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockHomedir.mockReturnValue("/home/testuser");
    delete process.env.COMET_UPLOAD_ROOT;
  });

  it("blocks ~/.ssh/id_rsa", () => {
    mockFile(resolve("/home/testuser/.ssh/id_rsa"));
    expect(() => validateUploadPath("~/.ssh/id_rsa")).toThrow(/sensitive path/);
  });

  it("blocks ~/.aws/credentials", () => {
    mockFile(resolve("/home/testuser/.aws/credentials"));
    expect(() => validateUploadPath("~/.aws/credentials")).toThrow(
      /sensitive path/,
    );
  });

  it("blocks /etc/shadow", () => {
    mockFile(resolve("/etc/shadow"));
    expect(() => validateUploadPath(resolve("/etc/shadow"))).toThrow(/sensitive path/);
  });

  it("blocks /root/secret.txt (under /root)", () => {
    mockFile(resolve("/root/secret.txt"));
    expect(() => validateUploadPath(resolve("/root/secret.txt"))).toThrow(
      /sensitive path/,
    );
  });
});

describe("validateUploadPath — .env file blocking", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockHomedir.mockReturnValue("/home/testuser");
    delete process.env.COMET_UPLOAD_ROOT;
  });

  it("blocks .env at home root", () => {
    mockFile(resolve("/home/testuser/.env"));
    expect(() => validateUploadPath("~/.env")).toThrow(/sensitive path/);
  });

  it("blocks .env.production anywhere on the filesystem", () => {
    mockFile(resolve("/var/app/.env.production"));
    expect(() => validateUploadPath(resolve("/var/app/.env.production"))).toThrow(
      /environment file/,
    );
  });
});

describe("validateUploadPath — valid paths (no COMET_UPLOAD_ROOT)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockHomedir.mockReturnValue("/home/testuser");
    delete process.env.COMET_UPLOAD_ROOT;
  });

  it("allows a regular file under /tmp", () => {
    mockFile(resolve("/tmp/document.pdf"));
    const result = validateUploadPath(resolve("/tmp/document.pdf"));
    expect(result).toBe(resolve("/tmp/document.pdf"));
  });

  it("allows a regular file under /home/testuser/uploads", () => {
    mockFile(resolve("/home/testuser/uploads/photo.jpg"));
    const result = validateUploadPath(resolve("/home/testuser/uploads/photo.jpg"));
    expect(result).toBe(resolve("/home/testuser/uploads/photo.jpg"));
  });
});

describe("validateUploadPath — COMET_UPLOAD_ROOT allowlist", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockHomedir.mockReturnValue("/home/testuser");
  });

  afterEach(() => {
    delete process.env.COMET_UPLOAD_ROOT;
  });

  it("allows a path inside COMET_UPLOAD_ROOT", () => {
    process.env.COMET_UPLOAD_ROOT = resolve("/home/testuser/uploads");
    mockRealpathSync
      .mockReturnValueOnce(resolve("/home/testuser/uploads/file.txt")) // resolves filePath
      .mockReturnValueOnce(resolve("/home/testuser/uploads")); // resolves root
    mockStatSync.mockReturnValue({ isFile: () => true });

    const result = validateUploadPath(resolve("/home/testuser/uploads/file.txt"));
    expect(result).toBe(resolve("/home/testuser/uploads/file.txt"));
  });

  it("rejects a path outside COMET_UPLOAD_ROOT", () => {
    process.env.COMET_UPLOAD_ROOT = resolve("/home/testuser/uploads");
    mockRealpathSync
      .mockReturnValueOnce(resolve("/etc/passwd")) // resolves filePath
      .mockReturnValueOnce(resolve("/home/testuser/uploads")); // resolves root
    mockStatSync.mockReturnValue({ isFile: () => true });

    expect(() => validateUploadPath(resolve("/etc/passwd"))).toThrow(
      /outside COMET_UPLOAD_ROOT/,
    );
  });

  it("rejects COMET_UPLOAD_ROOT set to /", () => {
    process.env.COMET_UPLOAD_ROOT = resolve("/");
    mockFile(resolve("/tmp/file.txt"));

    expect(() => validateUploadPath(resolve("/tmp/file.txt"))).toThrow(/overly broad/);
  });
});

describe("validateUploadPath — error cases", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockHomedir.mockReturnValue("/home/testuser");
    delete process.env.COMET_UPLOAD_ROOT;
  });

  it("throws File not found for ENOENT", () => {
    mockRealpathSync.mockImplementation(() => {
      const err: NodeJS.ErrnoException = new Error("ENOENT");
      err.code = "ENOENT";
      throw err;
    });

    expect(() => validateUploadPath(resolve("/nonexistent/file.txt"))).toThrow(
      /File not found/,
    );
  });

  it("throws Not a regular file for directories", () => {
    mockRealpathSync.mockReturnValue("/tmp/somedir");
    mockStatSync.mockReturnValue({ isFile: () => false });

    expect(() => validateUploadPath(resolve("/tmp/somedir"))).toThrow(
      /Not a regular file/,
    );
  });
});
