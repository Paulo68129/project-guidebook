import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("utils cn", () => {
  it("combina classes simples", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("condiciona classes", () => {
    expect(cn("base", true && "active", false && "inactive")).toBe("base active");
  });

  it("remove classes conflitantes", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("lida com array de classes", () => {
    expect(cn(["a", "b", "c"])).toBe("a b c");
  });

  it("retorna string vazia sem entrada", () => {
    expect(cn()).toBe("");
  });

  it("ignora valores falsos", () => {
    expect(cn(null, undefined, false, "valid")).toBe("valid");
  });
});
