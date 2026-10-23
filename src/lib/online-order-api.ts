import { supabase } from "@/integrations/supabase/client";
import { consultarPedidoOnline, criarPedidoOnline } from "./loja-online.functions";
import { isBusinessError } from "./db-errors";
import {
  errorMessage,
  isUuid,
  newOrderToken,
  normalizeOrder,
  parseNovoPedido,
  type NovoPedidoInput,
  type OnlineOrder,
} from "./online-order";

class PedidoRecusadoError extends Error {}

/**
 * Envia o pedido tentando dois caminhos independentes com o MESMO token
 * (a função SQL é idempotente por token, então repetir nunca duplica o pedido):
 * 1. RPC direto do navegador (não depende das variáveis de ambiente do servidor);
 * 2. Server function, caso o navegador não consiga falar com o banco.
 */
export async function enviarPedidoOnline(
  input: Omit<NovoPedidoInput, "token">,
): Promise<{ token: string; pedido: OnlineOrder }> {
  const pedido = parseNovoPedido({ ...input, token: newOrderToken() });
  let primeiraFalha: string | null = null;

  try {
    const { data, error } = await supabase.rpc("criar_pedido_online", {
      _token: pedido.token,
      _cliente: pedido.cliente,
      _telefone: pedido.telefone,
      _endereco: pedido.endereco,
      _itens: pedido.itens,
      _cupom: pedido.cupom,
    });
    if (error) {
      if (isBusinessError(error)) throw new PedidoRecusadoError(error.message);
      primeiraFalha = error.message;
    } else {
      const criado = normalizeOrder(data);
      if (criado) return { token: pedido.token, pedido: criado };
      primeiraFalha = "O banco não confirmou o pedido";
    }
  } catch (e) {
    if (e instanceof PedidoRecusadoError) throw e;
    primeiraFalha = errorMessage(e);
  }

  console.warn("[loja] Envio direto falhou, tentando pelo servidor:", primeiraFalha);
  try {
    return await criarPedidoOnline({ data: pedido });
  } catch (e) {
    throw new Error(errorMessage(e, primeiraFalha ?? "Não foi possível enviar o pedido"));
  }
}

/** Busca o pedido pelo token do link de acompanhamento. `null` = pedido não existe. */
export async function buscarPedidoOnline(token: string): Promise<OnlineOrder | null> {
  if (!isUuid(token)) return null;
  let primeiraFalha: string | null = null;

  try {
    const { data, error } = await supabase.rpc("consultar_pedido_online", { _token: token });
    if (!error) return normalizeOrder(data);
    primeiraFalha = error.message;
  } catch (e) {
    primeiraFalha = errorMessage(e);
  }

  console.warn("[loja] Consulta direta falhou, tentando pelo servidor:", primeiraFalha);
  try {
    return await consultarPedidoOnline({ data: { token } });
  } catch (e) {
    throw new Error(errorMessage(e, primeiraFalha ?? "Não foi possível consultar o pedido"));
  }
}

/** Expira o pedido quando o tempo de pagamento acaba. Chama a função RPC para atualizar o status no banco. */
export async function expirarPedidoOnline(token: string): Promise<void> {
  if (!isUuid(token)) return;
  
  try {
    const { error } = await (supabase as any).rpc("expirar_pedido_online", { _token: token });
    if (error) {
      console.warn("[loja] Não foi possível expirar o pedido:", error.message);
    }
  } catch (e) {
    console.warn("[loja] Erro ao expirar pedido:", errorMessage(e));
  }
}

/** Confirma o pagamento de um pedido online. Registra a venda, baixa o estoque e atualiza o status. */
export async function confirmarPagamento(pedidoId: string): Promise<string | null> {
  if (!isUuid(pedidoId)) return null;

  // Tenta RPC confirmar_pagamento_online (registra venda + baixa estoque + muda status)
  try {
    const { data, error } = await (supabase as any).rpc("confirmar_pagamento_online", { _pedido_id: pedidoId });
    if (!error) return data; // Retorna o venda_id
    console.warn("[delivery] RPC confirmar_pagamento_online falhou, usando fallback:", error.message);
  } catch (e) {
    console.warn("[delivery] RPC confirmar_pagamento_online indisponível, usando fallback:", errorMessage(e));
  }

  // Fallback: apenas atualiza o status para "pago"
  try {
    const { error } = await supabase
      .from("pedidos_online")
      .update({
        status: "pago",
        status_pagamento: "pago",
      } as any)
      .eq("id", pedidoId)
      .eq("status", "aguardando_pagamento");

    if (error) {
      console.warn("[delivery] Fallback confirmar_pagamento falhou:", error.message);
      throw new Error(error.message);
    }
  } catch (e) {
    console.warn("[delivery] Erro no fallback confirmar pagamento:", errorMessage(e));
    throw e;
  }

  return null;
}

/** Aceita o pedido no delivery. Tenta RPC primeiro, depois fallback para UPDATE direto. */
export async function aceitarPedido(pedidoId: string): Promise<void> {
  if (!isUuid(pedidoId)) return;

  // Tenta RPC aceitar_pedido (registra venda + baixa estoque + muda status)
  try {
    const { error } = await (supabase as any).rpc("aceitar_pedido", { _pedido_id: pedidoId });
    if (!error) return;
    console.warn("[delivery] RPC aceitar_pedido falhou, usando fallback:", error.message);
  } catch (e) {
    console.warn("[delivery] RPC aceitar_pedido indisponível, usando fallback:", errorMessage(e));
  }

  // Fallback: atualiza status diretamente no banco
  try {
    const { error } = await supabase
      .from("pedidos_online")
      .update({
        status: "recebido",
        status_delivery: "aceito",
        aceito_em: new Date().toISOString(),
      } as any)
      .eq("id", pedidoId)
      .eq("status_delivery", "pendente");

    if (error) {
      console.warn("[delivery] Fallback aceitar_pedido falhou:", error.message);
      throw new Error(error.message);
    }
  } catch (e) {
    console.warn("[delivery] Erro no fallback aceitar pedido:", errorMessage(e));
    throw e;
  }
}

/** Recusa o pedido no delivery com um motivo. Tenta RPC primeiro, depois fallback. */
export async function recusarPedido(pedidoId: string, motivo: string): Promise<void> {
  if (!isUuid(pedidoId)) return;

  // Tenta RPC recusar_pedido
  try {
    const { error } = await (supabase as any).rpc("recusar_pedido", { _pedido_id: pedidoId, _motivo: motivo });
    if (!error) return;
    console.warn("[delivery] RPC recusar_pedido falhou, usando fallback:", error.message);
  } catch (e) {
    console.warn("[delivery] RPC recusar_pedido indisponível, usando fallback:", errorMessage(e));
  }

  // Fallback: atualiza status diretamente
  try {
    const { error } = await supabase
      .from("pedidos_online")
      .update({
        status: "cancelado",
        status_delivery: "recusado",
        recusado_em: new Date().toISOString(),
        motivo_recusa: motivo,
      } as any)
      .eq("id", pedidoId);

    if (error) {
      console.warn("[delivery] Fallback recusar_pedido falhou:", error.message);
      throw new Error(error.message);
    }
  } catch (e) {
    console.warn("[delivery] Erro no fallback recusar pedido:", errorMessage(e));
    throw e;
  }
}

/** Cria um feedback para um pedido entregue. */
export async function criarFeedback(
  pedidoId: string,
  clienteNome: string,
  nota: number,
  comentario?: string
): Promise<void> {
  if (!isUuid(pedidoId)) return;
  if (nota < 1 || nota > 5) throw new Error("Nota deve ser entre 1 e 5");
  
  try {
    const { error } = await (supabase as any).rpc("criar_feedback", {
      _pedido_id: pedidoId,
      _cliente_nome: clienteNome,
      _cliente_email: null,
      _nota: nota,
      _comentario: comentario || null,
    });
    if (error) {
      console.warn("[feedback] Não foi possível criar o feedback:", error.message);
      throw new Error(error.message);
    }
  } catch (e) {
    console.warn("[feedback] Erro ao criar feedback:", errorMessage(e));
    throw e;
  }
}

/** Salva um pedido online permanentemente. Tenta RPC primeiro, depois fallback. */
export async function salvarPedido(pedidoId: string, usuario: string = "operador"): Promise<void> {
  if (!isUuid(pedidoId)) return;

  // Tenta RPC salvar_pedido_online
  try {
    const { data, error } = await (supabase as any).rpc("salvar_pedido_online", {
      _pedido_id: pedidoId,
      _usuario: usuario,
    });
    if (!error) {
      console.log("[delivery] Pedido salvo via RPC:", data);
      return;
    }
    // Se já está salvo, não é erro
    if (error.message?.includes("já está salvo")) {
      throw new Error("Este pedido já está salvo no sistema");
    }
    console.warn("[delivery] RPC salvar_pedido_online falhou, usando fallback:", error.message);
  } catch (e) {
    // Se já está salvo, propaga o erro
    if (errorMessage(e).includes("já está salvo")) throw e;
    console.warn("[delivery] RPC salvar_pedido_online indisponível, usando fallback:", errorMessage(e));
  }

  // Fallback: atualiza diretamente no banco
  try {
    const { error } = await supabase
      .from("pedidos_online")
      .update({
        salvo_em: new Date().toISOString(),
        salvo_por: usuario,
      } as any)
      .eq("id", pedidoId)
      .is("salvo_em", null); // Só atualiza se ainda não estiver salvo

    if (error) {
      console.warn("[delivery] Fallback salvar_pedido falhou:", error.message);
      throw new Error(error.message);
    }

    // Registra na auditoria
    try {
      await (supabase as any)
        .from("pedidos_online_audit")
        .insert({
          pedido_id: pedidoId,
          acao: "pedido_salvo",
          detalhes: { usuario },
        });
    } catch (auditError) {
      console.warn("[delivery] Erro ao registrar auditoria:", errorMessage(auditError));
    }
  } catch (e) {
    console.warn("[delivery] Erro no fallback salvar pedido:", errorMessage(e));
    throw e;
  }
}
