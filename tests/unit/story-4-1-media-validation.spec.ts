import { expect, test } from "@playwright/test";
import {
  calculateChecksum,
  detectMagicBytes,
  extractDimensions,
  MediaValidationError,
  sanitizeFilename,
  validateMediaUrl,
  validateSvgSecurity,
  validateUploadBuffer,
} from "../../lib/media/validation";

// Minimal valid sample buffers for testing
const SAMPLE_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
  0x00, 0x00, 0x00, 0x0d, // IHDR length
  0x49, 0x48, 0x44, 0x52, // IHDR
  0x00, 0x00, 0x01, 0x00, // Width = 256
  0x00, 0x00, 0x00, 0x80, // Height = 128
  0x08, 0x06, 0x00, 0x00, 0x00,
  0x14, 0xe1, 0x8d, 0x72, // CRC
]);

const SAMPLE_GIF = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
  0x64, 0x00, // Width = 100
  0x32, 0x00, // Height = 50
  0xf0, 0x00, 0x00,
]);

const SAMPLE_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, // SOI + APP0
  0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
  0xff, 0xc0, // SOF0
  0x00, 0x11, 0x08,
  0x00, 0xc8, // Height = 200
  0x01, 0x2c, // Width = 300
  0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  0xff, 0xd9, // EOI
]);

const SAMPLE_WEBP = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x20, 0x00, 0x00, 0x00]), // size
  Buffer.from("WEBPVP8 ", "ascii"),
  Buffer.from([0x14, 0x00, 0x00, 0x00]), // chunk size
  Buffer.from([
    0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a,
    0x80, 0x00, // Width = 128
    0x40, 0x00, // Height = 64
  ]),
]);

const SAMPLE_PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");

const SAMPLE_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 250" width="500" height="250"><rect width="100%" height="100%" fill="blue"/></svg>`
);

test.describe("Story 4.1 Media Validation & Security Contracts", () => {
  test("AC-4.1-01 sanitizes filenames and strips path traversal vectors", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("..\\..\\windows\\system32\\cmd.exe")).toBe("cmd.exe");
    expect(sanitizeFilename("/var/uploads/test.png")).toBe("test.png");
    expect(sanitizeFilename("image\x00null.png")).toBe("imagenull.png");
    expect(sanitizeFilename("my photo with spaces & symbols (#1).jpg")).toBe(
      "my-photo-with-spaces---symbols---1-.jpg"
    );
    expect(sanitizeFilename("")).toBe("unnamed-asset");
    expect(sanitizeFilename("....")).toBe("unnamed-asset");
  });

  test("AC-4.1-02 detects magic bytes for all supported media types", () => {
    expect(detectMagicBytes(SAMPLE_PNG)).toBe("image/png");
    expect(detectMagicBytes(SAMPLE_GIF)).toBe("image/gif");
    expect(detectMagicBytes(SAMPLE_JPEG)).toBe("image/jpeg");
    expect(detectMagicBytes(SAMPLE_WEBP)).toBe("image/webp");
    expect(detectMagicBytes(SAMPLE_PDF)).toBe("application/pdf");
    expect(detectMagicBytes(SAMPLE_SVG)).toBe("image/svg+xml");
    expect(detectMagicBytes(Buffer.from("MZ\x90\x00\x03\x00\x00\x00"))).toBeNull();
  });

  test("AC-4.1-03 extracts accurate dimensions from headers", () => {
    expect(extractDimensions(SAMPLE_PNG, "image/png")).toEqual({ width: 256, height: 128 });
    expect(extractDimensions(SAMPLE_GIF, "image/gif")).toEqual({ width: 100, height: 50 });
    expect(extractDimensions(SAMPLE_JPEG, "image/jpeg")).toEqual({ width: 300, height: 200 });
    expect(extractDimensions(SAMPLE_WEBP, "image/webp")).toEqual({ width: 128, height: 64 });
    expect(extractDimensions(SAMPLE_SVG, "image/svg+xml")).toEqual({ width: 500, height: 250 });
    expect(extractDimensions(SAMPLE_PDF, "application/pdf")).toEqual({ width: null, height: null });
  });

  test("AC-4.1-04 calculates SHA-256 checksum deterministically", () => {
    const checksum = calculateChecksum(SAMPLE_PNG);
    expect(checksum).toHaveLength(64);
    expect(calculateChecksum(SAMPLE_PNG)).toBe(checksum);
    expect(calculateChecksum(SAMPLE_GIF)).not.toBe(checksum);
  });

  test("AC-4.1-05 rejects empty upload buffer", () => {
    expect(() => validateUploadBuffer(Buffer.alloc(0), "empty.jpg")).toThrow(
      MediaValidationError
    );
  });

  test("AC-4.1-06 rejects unsupported extensions", () => {
    expect(() => validateUploadBuffer(Buffer.from("echo hello"), "script.sh")).toThrow(
      MediaValidationError
    );
    expect(() => validateUploadBuffer(Buffer.from("exe binary"), "app.exe")).toThrow(
      MediaValidationError
    );
  });

  test("AC-4.1-07 rejects fake content type (extension disguised)", () => {
    // An executable/text file renamed to .png
    const fakeBuffer = Buffer.from("<html><script>alert('xss')</script></html>");
    expect(() => validateUploadBuffer(fakeBuffer, "innocent.png")).toThrow(
      MediaValidationError
    );
  });

  test("AC-4.1-08 rejects extension / MIME type mismatch", () => {
    // Valid PNG content with a .jpg filename
    expect(() => validateUploadBuffer(SAMPLE_PNG, "actually-png.jpg")).toThrow(
      MediaValidationError
    );
  });

  test("AC-4.1-09 rejects malicious SVG with executable script tags or event handlers", () => {
    const dangerousSvgs = [
      `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="10"/></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>Click</text></a></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="/></svg>`,
    ];

    for (const svg of dangerousSvgs) {
      expect(() => validateSvgSecurity(svg)).toThrow(MediaValidationError);
      expect(() => validateUploadBuffer(Buffer.from(svg), "evil.svg")).toThrow(
        MediaValidationError
      );
    }
  });

  test("AC-4.1-10 validates clean upload buffer successfully", () => {
    const validated = validateUploadBuffer(SAMPLE_PNG, "banner.png", "image/png");
    expect(validated.filename).toBe("banner.png");
    expect(validated.sanitizedFilename).toBe("banner.png");
    expect(validated.extension).toBe(".png");
    expect(validated.mimeType).toBe("image/png");
    expect(validated.kind).toBe("image");
    expect(validated.width).toBe(256);
    expect(validated.height).toBe(128);
    expect(validated.byteSize).toBe(SAMPLE_PNG.length);
    expect(validated.checksum).toHaveLength(64);
  });

  test("AC-4.1-11 validates safe media URLs against origin whitelist", () => {
    expect(validateMediaUrl("/uploads/2026/09/image.webp")).toBe(true);
    expect(validateMediaUrl("//evil.com/image.png")).toBe(false);
    expect(validateMediaUrl("javascript:alert(1)")).toBe(false);

    const allowedOrigins = ["https://media.metroyazilim.com", "https://pub-abc123.r2.dev"];
    expect(validateMediaUrl("https://media.metroyazilim.com/uploads/photo.jpg", allowedOrigins)).toBe(true);
    expect(validateMediaUrl("https://sub.media.metroyazilim.com/photo.jpg", allowedOrigins)).toBe(true);
    expect(validateMediaUrl("https://pub-abc123.r2.dev/doc.pdf", allowedOrigins)).toBe(true);
    expect(validateMediaUrl("https://attacker.com/malicious.jpg", allowedOrigins)).toBe(false);
  });
});
