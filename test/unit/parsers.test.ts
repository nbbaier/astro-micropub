import { describe, expect, it } from "vitest";
import { formToMicroformats, parseFormEncoded } from "../../src/lib/parsers.js";

describe("parseFormEncoded", () => {
  it("should parse simple form data", () => {
    const result = parseFormEncoded("h=entry&content=Hello+World");
    expect(result).toEqual({
      content: "Hello World",
      h: "entry",
    });
  });

  it("should handle array notation with brackets", () => {
    const result = parseFormEncoded(
      "category[]=foo&category[]=bar&category[]=baz"
    );
    expect(result).toEqual({
      category: ["foo", "bar", "baz"],
    });
  });

  it("should handle mixed arrays and scalars", () => {
    const result = parseFormEncoded(
      "h=entry&content=Test&category[]=web&category[]=indieweb"
    );
    expect(result).toEqual({
      category: ["web", "indieweb"],
      content: "Test",
      h: "entry",
    });
  });

  it("should convert duplicate keys to arrays", () => {
    const result = parseFormEncoded("tag=foo&tag=bar");
    expect(result).toEqual({
      tag: ["foo", "bar"],
    });
  });

  it("should handle URL encoded values", () => {
    const result = parseFormEncoded(
      "content=Hello%20World%21&url=https%3A%2F%2Fexample.com"
    );
    expect(result).toEqual({
      content: "Hello World!",
      url: "https://example.com",
    });
  });

  it("should handle empty values", () => {
    const result = parseFormEncoded("h=entry&content=");
    expect(result).toEqual({
      content: "",
      h: "entry",
    });
  });
});

describe("formToMicroformats", () => {
  it("should convert simple form data to MF2", () => {
    const result = formToMicroformats({
      content: "Hello World",
      h: "entry",
    });

    expect(result).toEqual({
      properties: {
        content: ["Hello World"],
      },
      type: ["h-entry"],
    });
  });

  it("should handle arrays in properties", () => {
    const result = formToMicroformats({
      category: ["foo", "bar"],
      content: "Test post",
      h: "entry",
    });

    expect(result).toEqual({
      properties: {
        category: ["foo", "bar"],
        content: ["Test post"],
      },
      type: ["h-entry"],
    });
  });

  it("should skip h and action fields", () => {
    const result = formToMicroformats({
      action: "create",
      content: "Test",
      h: "entry",
    });

    expect(result).toEqual({
      properties: {
        content: ["Test"],
      },
      type: ["h-entry"],
    });
  });

  it("should convert scalar values to arrays", () => {
    const result = formToMicroformats({
      content: "Post content",
      h: "entry",
      name: "Post Title",
    });

    expect(result).toEqual({
      properties: {
        content: ["Post content"],
        name: ["Post Title"],
      },
      type: ["h-entry"],
    });
  });

  it("should default to h-entry if h is not specified", () => {
    const result = formToMicroformats({
      content: "Hello",
    });

    expect(result.type).toEqual(["h-entry"]);
  });

  it("should handle custom post types", () => {
    const result = formToMicroformats({
      h: "event",
      name: "My Event",
    });

    expect(result).toEqual({
      properties: {
        name: ["My Event"],
      },
      type: ["h-event"],
    });
  });
});
