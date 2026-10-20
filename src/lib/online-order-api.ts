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
