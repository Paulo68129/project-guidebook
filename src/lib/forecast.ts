// Regressão linear simples (mínimos quadrados) para previsão de demanda.
export function linearRegression(ys: number[]) {
  const n = ys.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: ys[0] };
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

/** Prevê os próximos `days` valores a partir da série diária. Nunca negativo. */
export function forecast(ys: number[], days: number) {
  const { slope, intercept } = linearRegression(ys);
  return Array.from({ length: days }, (_, i) => Math.max(0, intercept + slope * (ys.length + i)));
}

/** Sugestão de compra: consumo previsto - estoque atual + estoque mínimo. */
export function sugestaoCompra(consumoPrevisto: number, estoque: number, minimo: number) {
  return Math.max(0, consumoPrevisto + minimo - estoque);
}
