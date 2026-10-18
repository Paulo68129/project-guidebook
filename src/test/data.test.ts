import { describe, it, expect } from "vitest";
import { brl, num, custoProduto, diasParaVencer, serieDiaria, dayKey } from "@/lib/data";
import type { Ingrediente, Produto, Receita, Venda } from "@/lib/data";

describe("formatação", () => {
  it("brl formata como moeda brasileira", () => {
    expect(brl(1000)).toBe("R$\u00A01.000,00");
    expect(brl(0)).toBe("R$\u00A00,00");
    expect(brl(1234.5)).toBe("R$\u00A01.234,50");
  });

  it("num formata número com casas decimais", () => {
    expect(num(1234.567)).toBe("1.234,57");
    expect(num(100, 0)).toBe("100");
    expect(num(0.123, 3)).toBe("0,123");
  });
});

describe("custoProduto", () => {
  const ingredientes: Ingrediente[] = [
    { id: "ing-1", nome: "Farinha", custo_unitario: 2.5, quantidade: 100, unidade: "kg", estoque_minimo: 10, created_at: null, validade: null },
    { id: "ing-2", nome: "Açúcar", custo_unitario: 3.0, quantidade: 50, unidade: "kg", estoque_minimo: 5, created_at: null, validade: null },
  ];

  const receitas: Receita[] = [
    { id: "rec-1", produto_id: "prod-1", ingrediente_id: "ing-1", quantidade: 10 },
    { id: "rec-2", produto_id: "prod-1", ingrediente_id: "ing-2", quantidade: 5 },
    { id: "rec-3", produto_id: "prod-2", ingrediente_id: "ing-1", quantidade: 2 },
  ];

  it("calcula custo correto para produto com múltiplos ingredientes", () => {
    // Farinha: 2.5 * 10 = 25, Açúcar: 3.0 * 5 = 15, Total = 40
    expect(custoProduto("prod-1", receitas, ingredientes)).toBe(40);
  });

  it("calcula custo para produto com um ingrediente", () => {
    // Farinha: 2.5 * 2 = 5
    expect(custoProduto("prod-2", receitas, ingredientes)).toBe(5);
  });

  it("retorna zero para produto sem receita", () => {
    expect(custoProduto("prod-nao-existe", receitas, ingredientes)).toBe(0);
  });

  it("ignora ingrediente não encontrado na receita", () => {
    const receitasComIngredienteFaltando: Receita[] = [
      { id: "rec-4", produto_id: "prod-3", ingrediente_id: "ing-nao-existe", quantidade: 10 },
    ];
    expect(custoProduto("prod-3", receitasComIngredienteFaltando, ingredientes)).toBe(0);
  });
});

describe("diasParaVencer", () => {
  it("retorna Infinity quando validade é nula", () => {
    expect(diasParaVencer(null)).toBe(Infinity);
  });

  it("calcula dias corretamente para data futura", () => {
    const futuro = new Date(Date.now() + 5 * 86400000);
    const validade = futuro.toISOString().split("T")[0];
    const dias = diasParaVencer(validade);
    expect(dias).toBeGreaterThanOrEqual(4);
    expect(dias).toBeLessThanOrEqual(6);
  });

  it("retorna valor negativo para data passada", () => {
    const passado = new Date(Date.now() - 3 * 86400000);
    const validade = passado.toISOString().split("T")[0];
    expect(diasParaVencer(validade)).toBeLessThan(0);
  });
});

describe("dayKey", () => {
  it("formata data no formato sueco YYYY-MM-DD", () => {
    const date = new Date(2024, 0, 15); // 15 de janeiro de 2024
    expect(dayKey(date)).toBe("2024-01-15");
  });
});

describe("serieDiaria", () => {
  it("retorna série com zeros para dias sem vendas", () => {
    const series = serieDiaria([], 7);
    expect(series).toHaveLength(7);
    series.forEach((entry) => {
      expect(entry.faturamento).toBe(0);
      expect(entry.pedidos).toBe(0);
      expect(entry.lucro).toBe(0);
    });
  });

  it("agrega vendas por dia", () => {
    const hoje = new Date();
    const venda1: Venda = {
      id: "v1",
      cliente: "Cliente 1",
      criado_por: null,
      cupom: null,
      custo: 70,
      desconto: 0,
      endereco: null,
      lucro: 30,
      motoboy_id: null,
      numero: 1,
      status: "concluido",
      subtotal: 100,
      taxa_entrega: 0,
      telefone: null,
      tipo: "balcao",
      total: 100,
      created_at: new Date(hoje.getTime() - 1 * 86400000).toISOString(),
      venda_itens: [],
    };
    const venda2: Venda = {
      id: "v2",
      cliente: "Cliente 2",
      criado_por: null,
      cupom: null,
      custo: 140,
      desconto: 0,
      endereco: null,
      lucro: 60,
      motoboy_id: null,
      numero: 2,
      status: "concluido",
      subtotal: 200,
      taxa_entrega: 0,
      telefone: null,
      tipo: "balcao",
      total: 200,
      created_at: new Date(hoje.getTime() - 1 * 86400000).toISOString(),
      venda_itens: [],
    };

    const series = serieDiaria([venda1, venda2], 7);
    const diaOntem = series.find((s) => s.faturamento > 0);
    expect(diaOntem).toBeDefined();
    expect(diaOntem!.faturamento).toBe(300);
    expect(diaOntem!.pedidos).toBe(2);
    expect(diaOntem!.lucro).toBe(90);
  });

  it("ignora vendas canceladas", () => {
    const hoje = new Date();
    const vendaCancelada: Venda = {
      id: "v-cancelado",
      cliente: "Cliente Cancelado",
      criado_por: null,
      cupom: null,
      custo: 350,
      desconto: 0,
      endereco: null,
      lucro: 150,
      motoboy_id: null,
      numero: 3,
      status: "cancelado",
      subtotal: 500,
      taxa_entrega: 0,
      telefone: null,
      tipo: "balcao",
      total: 500,
      created_at: new Date(hoje.getTime() - 1 * 86400000).toISOString(),
      venda_itens: [],
    };

    const series = serieDiaria([vendaCancelada], 7);
    const totalFaturamento = series.reduce((sum, s) => sum + s.faturamento, 0);
    expect(totalFaturamento).toBe(0);
  });
});
