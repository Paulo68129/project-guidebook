import { describe, it, expect } from "vitest";
import {
  ORDER_STATUSES,
  STATUS_LABEL,
  NEXT_STATUS,
  isFinalStatus,
  isReadyForProduction,
  normalizeStatus,
  isUuid,
  extractOrderToken,
  orderCode,
  normalizeItems,
  normalizeOrder,
  parseNovoPedido,
  errorMessage,
  type OrderStatus,
} from "@/lib/online-order";

describe("ORDER_STATUSES", () => {
  it("contém todos os status esperados", () => {
    expect(ORDER_STATUSES).toContain("aguardando_pagamento");
    expect(ORDER_STATUSES).toContain("pago");
    expect(ORDER_STATUSES).toContain("pendente");
    expect(ORDER_STATUSES).toContain("recebido");
    expect(ORDER_STATUSES).toContain("preparando");
    expect(ORDER_STATUSES).toContain("pronto");
    expect(ORDER_STATUSES).toContain("em_entrega");
    expect(ORDER_STATUSES).toContain("finalizado");
    expect(ORDER_STATUSES).toContain("cancelado");
    expect(ORDER_STATUSES).toContain("expirado");
  });
});

describe("STATUS_LABEL", () => {
  it("possui label para todos os status", () => {
    ORDER_STATUSES.forEach((status) => {
      expect(STATUS_LABEL[status]).toBeDefined();
      expect(STATUS_LABEL[status]).toBeTruthy();
    });
  });

  it("retorna labels corretos para status finais", () => {
    expect(STATUS_LABEL["finalizado"]).toBe("Entregue");
    expect(STATUS_LABEL["cancelado"]).toBe("Cancelado");
    expect(STATUS_LABEL["expirado"]).toBe("Tempo de pagamento expirado");
  });
});

describe("NEXT_STATUS", () => {
  it("retorna null para status finais", () => {
    expect(NEXT_STATUS["finalizado"]).toBeNull();
    expect(NEXT_STATUS["cancelado"]).toBeNull();
    expect(NEXT_STATUS["expirado"]).toBeNull();
  });

  it("retorna próximo status para status ativos", () => {
    expect(NEXT_STATUS["pendente"]?.status).toBe("recebido");
    expect(NEXT_STATUS["recebido"]?.status).toBe("preparando");
    expect(NEXT_STATUS["preparando"]?.status).toBe("pronto");
    expect(NEXT_STATUS["pronto"]?.status).toBe("em_entrega");
    expect(NEXT_STATUS["em_entrega"]?.status).toBe("finalizado");
  });

  it("fluxo completo leva ao finalizado", () => {
    let status: OrderStatus = "pendente";
    const steps: OrderStatus[] = [];
    while (NEXT_STATUS[status] !== null) {
      steps.push(status);
      status = NEXT_STATUS[status]!.status;
    }
    steps.push(status);
    expect(status).toBe("finalizado");
    expect(steps).toEqual(["pendente", "recebido", "preparando", "pronto", "em_entrega", "finalizado"]);
  });
});

describe("isFinalStatus", () => {
  it("retorna true para status finais", () => {
    expect(isFinalStatus("finalizado")).toBe(true);
    expect(isFinalStatus("cancelado")).toBe(true);
    expect(isFinalStatus("expirado")).toBe(true);
  });

  it("retorna false para status ativos", () => {
    expect(isFinalStatus("pendente")).toBe(false);
    expect(isFinalStatus("pago")).toBe(false);
    expect(isFinalStatus("preparando")).toBe(false);
    expect(isFinalStatus("em_entrega")).toBe(false);
  });
});

describe("isReadyForProduction", () => {
  it("retorna true para status prontos para produção", () => {
    expect(isReadyForProduction("pago")).toBe(true);
    expect(isReadyForProduction("recebido")).toBe(true);
    expect(isReadyForProduction("preparando")).toBe(true);
    expect(isReadyForProduction("pronto")).toBe(true);
    expect(isReadyForProduction("em_entrega")).toBe(true);
  });

  it("retorna false para status não prontos", () => {
    expect(isReadyForProduction("aguardando_pagamento")).toBe(false);
    expect(isReadyForProduction("pendente")).toBe(false);
    expect(isReadyForProduction("finalizado")).toBe(false);
    expect(isReadyForProduction("cancelado")).toBe(false);
  });
});

describe("normalizeStatus", () => {
  it("normaliza status válidos diretamente", () => {
    expect(normalizeStatus("pendente")).toBe("pendente");
    expect(normalizeStatus("PAGO")).toBe("pago");
    expect(normalizeStatus("PREPARANDO")).toBe("preparando");
  });

  it("mapeia aliases antigos para status padrão", () => {
    expect(normalizeStatus("pagamento_confirmado")).toBe("pago");
    expect(normalizeStatus("novo")).toBe("pendente");
    expect(normalizeStatus("confirmado")).toBe("pendente");
    expect(normalizeStatus("preparo")).toBe("preparando");
    expect(normalizeStatus("em_preparo")).toBe("preparando");
    expect(normalizeStatus("saiu")).toBe("em_entrega");
    expect(normalizeStatus("saiu_para_entrega")).toBe("em_entrega");
    expect(normalizeStatus("em_rota")).toBe("em_entrega");
    expect(normalizeStatus("entregue")).toBe("finalizado");
    expect(normalizeStatus("concluido")).toBe("finalizado");
  });

  it("retorna pendente para valor desconhecido", () => {
    expect(normalizeStatus("valor_inexistente")).toBe("pendente");
  });

  it("lida com null e undefined", () => {
    expect(normalizeStatus(null)).toBe("pendente");
    expect(normalizeStatus(undefined)).toBe("pendente");
    expect(normalizeStatus("")).toBe("pendente");
  });
});

describe("isUuid", () => {
  it("identifica UUIDs válidos", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUuid("  550e8400-e29b-41d4-a716-446655440000  ")).toBe(true);
  });

  it("rejeita strings inválidas", () => {
    expect(isUuid("nao-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("550e8400-e29b-41d4-a716")).toBe(false);
  });
});

describe("extractOrderToken", () => {
  it("extrai UUID de uma string", () => {
    expect(extractOrderToken("550e8400-e29b-41d4-a716-446655440000")).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("extrai UUID de uma URL", () => {
    const url = "https://example.com/pagamento/550e8400-e29b-41d4-a716-446655440000";
    expect(extractOrderToken(url)).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("retorna null se não encontrar UUID", () => {
    expect(extractOrderToken("sem uuid aqui")).toBeNull();
  });
});

describe("orderCode", () => {
  it("gera código curto do ID", () => {
    const code = orderCode("550e8400-e29b-41d4-a716-446655440000");
    expect(code).toHaveLength(8);
    expect(code).toBe(code.toUpperCase());
  });

  it("remove hifens do ID", () => {
    const code = orderCode("550e8400-e29b-41d4-a716-446655440000");
    expect(code).toBe("550E8400");
  });
});

describe("normalizeItems", () => {
  it("normaliza array de itens", () => {
    const raw = [
      { produto_id: "p1", nome: "Pizza", descricao: "Grande", quantidade: 2, preco_unitario: 30 },
    ];
    const items = normalizeItems(raw);
    expect(items).toHaveLength(1);
    expect(items[0]!.nome).toBe("Pizza");
    expect(items[0]!.quantidade).toBe(2);
  });

  it("normaliza string JSON", () => {
    const raw = JSON.stringify([
      { produto_id: "p1", nome: "Pizza", quantidade: 1, preco_unitario: 25 },
    ]);
    const items = normalizeItems(raw);
    expect(items).toHaveLength(1);
    expect(items[0]!.nome).toBe("Pizza");
  });

  it("retorna array vazio para entrada inválida", () => {
    expect(normalizeItems("nao-json")).toEqual([]);
    expect(normalizeItems(null)).toEqual([]);
    expect(normalizeItems(123)).toEqual([]);
  });

  it("garante quantidade mínima de 1", () => {
    const raw = [{ produto_id: "p1", nome: "Pizza", quantidade: 0, preco_unitario: 25 }];
    const items = normalizeItems(raw);
    expect(items[0]!.quantidade).toBe(1);
  });
});

describe("normalizeOrder", () => {
  it("normaliza um pedido completo", () => {
    const raw = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      cliente: "João",
      telefone: "(21) 99999-1234",
      endereco: "Rua A, 123",
      itens: [{ produto_id: "p1", nome: "Pizza", quantidade: 1, preco_unitario: 30 }],
      subtotal: 30,
      desconto: 0,
      taxa_entrega: 5,
      total: 35,
      status: "pendente",
      created_at: "2024-01-01T12:00:00Z",
    };
    const order = normalizeOrder(raw);
    expect(order).not.toBeNull();
    expect(order!.cliente).toBe("João");
    expect(order!.status).toBe("pendente");
    expect(order!.itens).toHaveLength(1);
  });

  it("normaliza string JSON", () => {
    const raw = JSON.stringify({
      id: "550e8400-e29b-41d4-a716-446655440000",
      cliente: "Maria",
      telefone: "",
      endereco: "Rua B, 456",
      itens: [],
      subtotal: 0,
      desconto: 0,
      taxa_entrega: 0,
      total: 0,
      status: "pago",
      created_at: "2024-01-01T12:00:00Z",
    });
    const order = normalizeOrder(raw);
    expect(order).not.toBeNull();
    expect(order!.cliente).toBe("Maria");
  });

  it("retorna null para entrada inválida", () => {
    expect(normalizeOrder(null)).toBeNull();
    expect(normalizeOrder({})).toBeNull();
    expect(normalizeOrder({ id: null })).toBeNull();
  });

  it("inclui campos opcionais quando presentes", () => {
    const raw = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      cliente: "Teste",
      telefone: "",
      endereco: "Rua C",
      itens: [],
      subtotal: 0,
      desconto: 0,
      taxa_entrega: 0,
      total: 0,
      status: "pendente",
      created_at: "2024-01-01T12:00:00Z",
      observacoes: "Sem cebola",
      origem: "loja_online",
      token: "abc123",
    };
    const order = normalizeOrder(raw);
    expect(order).not.toBeNull();
    expect(order!.observacoes).toBe("Sem cebola");
    expect(order!.origem).toBe("loja_online");
    expect(order!.token).toBe("abc123");
  });
});

describe("parseNovoPedido", () => {
  it("valida um pedido válido", () => {
    const input = {
      token: "550e8400-e29b-41d4-a716-446655440000",
      cliente: "João Silva",
      telefone: "(21) 99999-1234",
      endereco: "Rua das Flores, 123, Centro",
      cupom: "",
      itens: [{ produto_id: "550e8400-e29b-41d4-a716-446655440000", quantidade: 2 }],
    };
    const result = parseNovoPedido(input);
    expect(result.cliente).toBe("João Silva");
    expect(result.itens).toHaveLength(1);
  });

  it("rejeita nome muito curto", () => {
    expect(() => parseNovoPedido({
      token: "550e8400-e29b-41d4-a716-446655440000",
      cliente: "A",
      telefone: "(21) 99999-1234",
      endereco: "Rua das Flores, 123, Centro",
      itens: [{ produto_id: "550e8400-e29b-41d4-a716-446655440000", quantidade: 1 }],
    })).toThrow();
  });

  it("rejeita telefone inválido", () => {
    expect(() => parseNovoPedido({
      token: "550e8400-e29b-41d4-a716-446655440000",
      cliente: "João Silva",
      telefone: "123",
      endereco: "Rua das Flores, 123, Centro",
      itens: [{ produto_id: "550e8400-e29b-41d4-a716-446655440000", quantidade: 1 }],
    })).toThrow();
  });

  it("rejeita pedido sem itens", () => {
    expect(() => parseNovoPedido({
      token: "550e8400-e29b-41d4-a716-446655440000",
      cliente: "João Silva",
      telefone: "(21) 99999-1234",
      endereco: "Rua das Flores, 123, Centro",
      itens: [],
    })).toThrow();
  });
});

describe("errorMessage", () => {
  it("extrai mensagem de Error", () => {
    expect(errorMessage(new Error("algo deu errado"))).toBe("algo deu errado");
  });

  it("extrai mensagem de objeto com message", () => {
    expect(errorMessage({ message: "erro customizado" })).toBe("erro customizado");
  });

  it("retorna string diretamente", () => {
    expect(errorMessage("mensagem de erro")).toBe("mensagem de erro");
  });

  it("retorna fallback para entrada inválida", () => {
    expect(errorMessage(null, "fallback")).toBe("fallback");
    expect(errorMessage(undefined, "fallback")).toBe("fallback");
    expect(errorMessage({}, "fallback")).toBe("fallback");
  });
});
