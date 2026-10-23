import { describe, it, expect } from "vitest";

/**
 * Testes para as funções de integração Loja Online → Delivery.
 * Valida: badge "NOVO PEDIDO", timer de expiração, e detecção de pedidos expirados.
 */

// Tempo em ms para considerar um pedido "novo" (exibe badge NOVO PEDIDO)
const NOVO_PEDIDO_MS = 3 * 60 * 1000; // 3 minutos

// Verifica se um pedido é "novo" (recebido nos últimos minutos)
function isNovoPedido(created_at: string): boolean {
  const diff = Date.now() - new Date(created_at).getTime();
  return diff < NOVO_PEDIDO_MS;
}

// Calcula o tempo restante até expiração (5 minutos desde criação)
function getTempoRestanteExpiracao(created_at: string): { minutos: number; segundos: number; expirado: boolean } {
  const criado = new Date(created_at).getTime();
  const expiracao = criado + 5 * 60 * 1000; // 5 minutos
  const restante = expiracao - Date.now();

  if (restante <= 0) return { minutos: 0, segundos: 0, expirado: true };

  return {
    minutos: Math.floor(restante / 60000),
    segundos: Math.floor((restante % 60000) / 1000),
    expirado: false,
  };
}

describe("isNovoPedido", () => {
  it("retorna true para pedido criado há 1 minuto", () => {
    const agora = new Date();
    const haUmMinuto = new Date(agora.getTime() - 60_000);
    expect(isNovoPedido(haUmMinuto.toISOString())).toBe(true);
  });

  it("retorna true para pedido criado há 2 minutos e 59 segundos", () => {
    const agora = new Date();
    const haQuase3Min = new Date(agora.getTime() - 179_000);
    expect(isNovoPedido(haQuase3Min.toISOString())).toBe(true);
  });

  it("retorna false para pedido criado há 4 minutos", () => {
    const agora = new Date();
    const ha4Min = new Date(agora.getTime() - 4 * 60_000);
    expect(isNovoPedido(ha4Min.toISOString())).toBe(false);
  });

  it("retorna false para pedido criado há 1 hora", () => {
    const agora = new Date();
    const ha1Hora = new Date(agora.getTime() - 60 * 60_000);
    expect(isNovoPedido(ha1Hora.toISOString())).toBe(false);
  });

  it("retorna true para pedido criado agora", () => {
    expect(isNovoPedido(new Date().toISOString())).toBe(true);
  });
});

describe("getTempoRestanteExpiracao", () => {
  it("retorna tempo próximo de 5 minutos para pedido recém-criado", () => {
    const agora = new Date().toISOString();
    const resultado = getTempoRestanteExpiracao(agora);
    expect(resultado.expirado).toBe(false);
    expect(resultado.minutos).toBeGreaterThanOrEqual(4);
    expect(resultado.minutos).toBeLessThanOrEqual(5);
    expect(resultado.segundos).toBeGreaterThanOrEqual(0);
    expect(resultado.segundos).toBeLessThanOrEqual(59);
  });

  it("retorna expirado=true para pedido criado há 6 minutos", () => {
    const ha6Min = new Date(Date.now() - 6 * 60_000).toISOString();
    const resultado = getTempoRestanteExpiracao(ha6Min);
    expect(resultado.expirado).toBe(true);
    expect(resultado.minutos).toBe(0);
    expect(resultado.segundos).toBe(0);
  });

  it("retorna expirado=true para pedido criado há 10 minutos", () => {
    const ha10Min = new Date(Date.now() - 10 * 60_000).toISOString();
    const resultado = getTempoRestanteExpiracao(ha10Min);
    expect(resultado.expirado).toBe(true);
  });

  it("retorna ~4 minutos restantes para pedido criado há 1 minuto", () => {
    const ha1Min = new Date(Date.now() - 60_000).toISOString();
    const resultado = getTempoRestanteExpiracao(ha1Min);
    expect(resultado.expirado).toBe(false);
    expect(resultado.minutos).toBeGreaterThanOrEqual(3);
    expect(resultado.minutos).toBeLessThanOrEqual(4);
  });

  it("retorna ~1 minuto restante para pedido criado há 4 minutos", () => {
    const ha4Min = new Date(Date.now() - 4 * 60_000).toISOString();
    const resultado = getTempoRestanteExpiracao(ha4Min);
    expect(resultado.expirado).toBe(false);
    expect(resultado.minutos).toBeGreaterThanOrEqual(0);
    expect(resultado.minutos).toBeLessThanOrEqual(1);
  });

  it("calcula segundos corretamente", () => {
    const ha4Min30Seg = new Date(Date.now() - 4 * 60_000 - 30_000).toISOString();
    const resultado = getTempoRestanteExpiracao(ha4Min30Seg);
    expect(resultado.expirado).toBe(false);
    expect(resultado.minutos).toBe(0);
    expect(resultado.segundos).toBeGreaterThanOrEqual(25);
    expect(resultado.segundos).toBeLessThanOrEqual(35);
  });
});

describe("Integração: isNovoPedido + getTempoRestanteExpiracao", () => {
  it("pedido novo mostra badge E timer ativo", () => {
    const agora = new Date().toISOString();
    expect(isNovoPedido(agora)).toBe(true);
    const exp = getTempoRestanteExpiracao(agora);
    expect(exp.expirado).toBe(false);
    expect(exp.minutos).toBeGreaterThanOrEqual(4);
  });

  it("pedido de 4 minutos NÃO mostra badge mas timer ainda ativo", () => {
    const ha4Min = new Date(Date.now() - 4 * 60_000).toISOString();
    expect(isNovoPedido(ha4Min)).toBe(false);
    const exp = getTempoRestanteExpiracao(ha4Min);
    expect(exp.expirado).toBe(false);
  });

  it("pedido de 6 minutos NÃO mostra badge e está expirado", () => {
    const ha6Min = new Date(Date.now() - 6 * 60_000).toISOString();
    expect(isNovoPedido(ha6Min)).toBe(false);
    const exp = getTempoRestanteExpiracao(ha6Min);
    expect(exp.expirado).toBe(true);
  });
});
