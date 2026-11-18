import { IMAGE_EXTENSIONS, extForMime, imageMime } from "../utils/attachments";

describe("extForMime", () => {
  it("maps supported image MIME types to an extension", () => {
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/gif")).toBe("gif");
    expect(extForMime("image/webp")).toBe("webp");
    expect(extForMime("IMAGE/PNG")).toBe("png");
  });

  it("returns null for unsupported types", () => {
    expect(extForMime("text/plain")).toBeNull();
    expect(extForMime("image/bmp")).toBeNull();
  });
});

describe("imageMime", () => {
  it("maps extensions case-insensitively", () => {
    expect(imageMime("PNG")).toBe("image/png");
    expect(imageMime("txt")).toBeNull();
  });

  it("lists every supported extension", () => {
    expect(IMAGE_EXTENSIONS).toEqual(["png", "jpg", "jpeg", "gif", "webp"]);
  });
});
