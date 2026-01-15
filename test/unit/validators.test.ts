import { describe, expect, it } from "vitest";
import {
  convertToUpdateOperations,
  validateMicropubAction,
  validateMicropubCreate,
} from "../../src/validators/micropub.js";
import {
  hasAllScopes,
  hasAnyScope,
  hasScope,
  parseScopes,
  requireCreateScope,
  requireDeleteScope,
  requireMediaScope,
  requireUpdateScope,
} from "../../src/validators/scopes.js";

describe("validateMicropubCreate", () => {
  it("should validate a valid MF2 entry", () => {
    const entry = {
      type: ["h-entry"],
      properties: {
        content: ["Hello World"],
      },
    };

    const result = validateMicropubCreate(entry);
    expect(result).toEqual(entry);
  });

  it("should throw on missing type", () => {
    const entry = {
      properties: {
        content: ["Hello"],
      },
    };

    expect(() => validateMicropubCreate(entry)).toThrow();
  });

  it("should throw on empty type array", () => {
    const entry = {
      type: [],
      properties: {
        content: ["Hello"],
      },
    };

    expect(() => validateMicropubCreate(entry)).toThrow();
  });

  it("should validate complex entries", () => {
    const entry = {
      type: ["h-entry"],
      properties: {
        name: ["My Post"],
        content: ["This is content"],
        category: ["web", "indieweb"],
        published: ["2024-01-01T00:00:00Z"],
      },
    };

    const result = validateMicropubCreate(entry);
    expect(result).toEqual(entry);
  });
});

describe("validateMicropubAction", () => {
  it("should validate update action", () => {
    const action = {
      action: "update",
      url: "https://example.com/post",
      replace: {
        content: ["Updated content"],
      },
    };

    const result = validateMicropubAction(action);
    expect(result).toEqual(action);
  });

  it("should validate delete action", () => {
    const action = {
      action: "delete",
      url: "https://example.com/post",
    };

    const result = validateMicropubAction(action);
    expect(result).toEqual(action);
  });

  it("should validate undelete action", () => {
    const action = {
      action: "undelete",
      url: "https://example.com/post",
    };

    const result = validateMicropubAction(action);
    expect(result).toEqual(action);
  });

  it("should throw on invalid URL", () => {
    const action = {
      action: "delete",
      url: "not-a-url",
    };

    expect(() => validateMicropubAction(action)).toThrow();
  });

  it("should throw on unknown action", () => {
    const action = {
      action: "invalid",
      url: "https://example.com/post",
    };

    expect(() => validateMicropubAction(action)).toThrow();
  });
});

describe("convertToUpdateOperations", () => {
  it("should convert replace operations", () => {
    const update = {
      action: "update" as const,
      url: "https://example.com/post",
      replace: {
        content: ["New content"],
      },
    };

    const ops = convertToUpdateOperations(update);
    expect(ops).toEqual([
      {
        action: "replace",
        property: "content",
        value: ["New content"],
      },
    ]);
  });

  it("should convert add operations", () => {
    const update = {
      action: "update" as const,
      url: "https://example.com/post",
      add: {
        category: ["new-tag"],
      },
    };

    const ops = convertToUpdateOperations(update);
    expect(ops).toEqual([
      {
        action: "add",
        property: "category",
        value: ["new-tag"],
      },
    ]);
  });

  it("should convert delete operations (array form)", () => {
    const update = {
      action: "update" as const,
      url: "https://example.com/post",
      delete: ["syndication"],
    };

    const ops = convertToUpdateOperations(update);
    expect(ops).toEqual([
      {
        action: "delete",
        property: "syndication",
      },
    ]);
  });

  it("should convert delete operations (object form)", () => {
    const update = {
      action: "update" as const,
      url: "https://example.com/post",
      delete: {
        category: ["old-tag"],
      },
    };

    const ops = convertToUpdateOperations(update);
    expect(ops).toEqual([
      {
        action: "delete",
        property: "category",
        value: ["old-tag"],
      },
    ]);
  });

  it("should handle combined operations", () => {
    const update = {
      action: "update" as const,
      url: "https://example.com/post",
      replace: {
        content: ["Updated"],
      },
      add: {
        category: ["new"],
      },
      delete: ["syndication"],
    };

    const ops = convertToUpdateOperations(update);
    expect(ops).toHaveLength(3);
    expect(ops[0].action).toBe("replace");
    expect(ops[1].action).toBe("add");
    expect(ops[2].action).toBe("delete");
  });
});

describe("scope validation", () => {
  describe("hasScope", () => {
    it("should return true when scope is present", () => {
      expect(hasScope("create update", "create")).toBe(true);
      expect(hasScope("create update", "update")).toBe(true);
    });

    it("should return false when scope is not present", () => {
      expect(hasScope("create", "update")).toBe(false);
      expect(hasScope("media", "delete")).toBe(false);
    });

    it("should handle single scope", () => {
      expect(hasScope("create", "create")).toBe(true);
    });

    it("should handle empty scope string", () => {
      expect(hasScope("", "create")).toBe(false);
    });
  });

  describe("hasAnyScope", () => {
    it("should return true if any scope matches", () => {
      expect(hasAnyScope("create media", ["create", "delete"])).toBe(true);
      expect(hasAnyScope("update", ["create", "update"])).toBe(true);
    });

    it("should return false if no scopes match", () => {
      expect(hasAnyScope("create", ["update", "delete"])).toBe(false);
    });
  });

  describe("hasAllScopes", () => {
    it("should return true if all scopes are present", () => {
      expect(hasAllScopes("create update delete", ["create", "update"])).toBe(
        true
      );
    });

    it("should return false if any scope is missing", () => {
      expect(hasAllScopes("create", ["create", "update"])).toBe(false);
    });
  });

  describe("parseScopes", () => {
    it("should parse space-separated scopes", () => {
      expect(parseScopes("create update delete")).toEqual([
        "create",
        "update",
        "delete",
      ]);
    });

    it("should handle single scope", () => {
      expect(parseScopes("create")).toEqual(["create"]);
    });

    it("should handle empty string", () => {
      expect(parseScopes("")).toEqual([]);
    });

    it("should filter out empty values", () => {
      expect(parseScopes("create  update")).toEqual(["create", "update"]);
    });
  });

  describe("requireCreateScope", () => {
    it("should return true for create scope", () => {
      expect(requireCreateScope("create")).toBe(true);
      expect(requireCreateScope("create update")).toBe(true);
    });

    it("should return false without create scope", () => {
      expect(requireCreateScope("update delete")).toBe(false);
    });
  });

  describe("requireUpdateScope", () => {
    it("should return true for update scope", () => {
      expect(requireUpdateScope("update")).toBe(true);
      expect(requireUpdateScope("create update")).toBe(true);
    });

    it("should return false without update scope", () => {
      expect(requireUpdateScope("create delete")).toBe(false);
    });
  });

  describe("requireDeleteScope", () => {
    it("should return true for delete scope", () => {
      expect(requireDeleteScope("delete")).toBe(true);
      expect(requireDeleteScope("create delete")).toBe(true);
    });

    it("should return false without delete scope", () => {
      expect(requireDeleteScope("create update")).toBe(false);
    });
  });

  describe("requireMediaScope", () => {
    it("should return true for media scope", () => {
      expect(requireMediaScope("media")).toBe(true);
      expect(requireMediaScope("create media")).toBe(true);
    });

    it("should return false without media scope", () => {
      expect(requireMediaScope("create update")).toBe(false);
    });
  });
});
