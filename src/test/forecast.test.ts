import { describe, it, expect } from "vitest";
import { forecast, linearRegression, sugestaoCompra } from "@/lib/forecast";

describe("previsão", () => {
  it("regressão em série linear perfeita", () => {
    const r = linearRegression([2, 4, 6, 8]);
    expect(r.slope).toBeCloseTo(2);
    expect(r.intercept).toBeCloseTo(2);
  });
  it("prevê os próximos dias", () => {
    expect(forecast([1, 2, 3], 2)).toEqual([4, 5]);
  });
  it("nunca prevê negativo", () => {
    expect(forecast([10, 5, 0], 3).every((v) => v >= 0)).toBe(true);
  });
  it("sugestão de compra cobre consumo + mínimo", () => {
    expect(sugestaoCompra(10, 4, 3)).toBe(9);
    expect(sugestaoCompra(2, 20, 3)).toBe(0);
  });
});
