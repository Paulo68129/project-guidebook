import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, ArrowLeft, MessageSquare, Send, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { criarFeedback } from "@/lib/online-order-api";

export const Route = createFileRoute("/avaliacoes")({
  head: () => ({
    meta: [
      { title: "Avaliações — PizzaStockAI" },
      { name: "description", content: "Veja o que nossos clientes dizem e avalie seu pedido." },
    ],
  }),
  component: AvaliacoesPage,
});

function StarRating({ rating, onRate, size = "md" }: { 
  rating: number; 
  onRate?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6";
  
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate?.(star)}
          disabled={!onRate}
          className={`${onRate ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}
        >
          <Star
            className={`${sizeClass} ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function FeedbackForm({ pedidoId, onSubmitted }: { pedidoId: string; onSubmitted: () => void }) {
  const [nome, setNome] = useState("");
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    if (nota < 1 || nota > 5) {
      toast.error("Selecione uma nota de 1 a 5 estrelas");
      return;
    }

    setSubmitting(true);
    try {
      await criarFeedback(pedidoId, nome.trim(), nota, comentario.trim() || undefined);
      toast.success("Avaliação enviada com sucesso! Obrigado pelo feedback.");
      setNome("");
      setNota(0);
      setComentario("");
      onSubmitted();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível enviar a avaliação");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Seu nome</label>
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Como podemos te chamar?"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Sua avaliação</label>
        <StarRating rating={nota} onRate={setNota} size="lg" />
        <p className="text-xs text-muted-foreground">
          {nota === 0 ? "Clique nas estrelas para avaliar" : `${nota} estrela${nota > 1 ? "s" : ""}`}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Comentário (opcional)</label>
        <Textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Conte-nos sobre sua experiência..."
          rows={3}
        />
      </div>

      <Button type="submit" disabled={submitting || nota === 0}>
        {submitting ? (
          <>Enviando...</>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Enviar avaliação
          </>
        )}
      </Button>
    </form>
  );
}

function FeedbackCard({ feedback }: { feedback: any }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <span className="font-semibold text-primary">
              {feedback.cliente_nome.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium">{feedback.cliente_nome}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(feedback.criado_em).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <StarRating rating={feedback.nota} size="sm" />
      </div>

      {feedback.comentario && (
        <p className="text-sm text-foreground">{feedback.comentario}</p>
      )}

      {feedback.resposta && (
        <div className="mt-3 rounded-lg bg-muted/50 p-3 border-l-2 border-primary">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary">Resposta da loja</span>
          </div>
          <p className="text-sm text-muted-foreground">{feedback.resposta}</p>
        </div>
      )}
    </div>
  );
}

function AvaliacoesPage() {
  const qc = useQueryClient();
  const [filtroNota, setFiltroNota] = useState<number | null>(null);
  const [pedidoId, setPedidoId] = useState<string | null>(null);

  // Busca estatísticas
  const statsQ = useQuery({
    queryKey: ["feedback-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("estatisticas_feedback");
      if (error) {
        // Tabela feedback_clientes não existe — retorna dados vazios
        if (error.message?.includes('does not exist') || error.message?.includes('could not open relation') || error.message?.includes('function')) {
          return { media_geral: 0, total_aprovados: 0 };
        }
        throw error;
      }
      return data;
    },
  });

  // Busca feedbacks aprovados
  const feedbacksQ = useQuery({
    queryKey: ["feedbacks-aprovados", filtroNota],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_feedbacks_aprovados", {
        _limite: 50,
        _offset: 0,
        _nota_filtro: filtroNota,
      });
      if (error) {
        // Tabela feedback_clientes não existe — retorna lista vazia
        if (error.message?.includes('does not exist') || error.message?.includes('could not open relation') || error.message?.includes('function')) {
          return [];
        }
        throw error;
      }
      return data || [];
    },
  });

  // Verifica se veio com token na URL (apenas no cliente)
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
  const urlToken = urlParams.get("token");

  const stats = statsQ.data;
  const mediaGeral = Number(stats?.media_geral || 0);
  const totalAvaliacoes = Number(stats?.total_aprovados || 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => window.location.href = "/loja"}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <div className="font-display text-lg font-bold">
            PizzaStockAI
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Título */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">Avaliações dos Clientes</h1>
          <p className="text-muted-foreground mt-1">
            Veja o que nossos clientes dizem sobre nós
          </p>
        </div>

        {/* Estatísticas gerais */}
        {statsQ.data && (
          <div className="rounded-xl border bg-white p-6 text-center shadow-sm">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star className="h-8 w-8 fill-yellow-400 text-yellow-400" />
              <span className="text-4xl font-bold">{mediaGeral.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-center gap-1 mb-2">
              <StarRating rating={Math.round(mediaGeral)} size="md" />
            </div>
            <p className="text-sm text-muted-foreground">
              Baseado em {totalAvaliacoes} avaliaçã{totalAvaliacoes > 1 ? "es" : "o"}
            </p>
          </div>
        )}

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtrar por nota:</span>
          <Button
            variant={filtroNota === null ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroNota(null)}
          >
            Todas
          </Button>
          {[5, 4, 3, 2, 1].map((nota) => (
            <Button
              key={nota}
              variant={filtroNota === nota ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroNota(nota)}
            >
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-1" />
              {nota}
            </Button>
          ))}
        </div>

        {/* Formulário de avaliação (se veio com token) */}
        {urlToken && !pedidoId && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="font-bold mb-4">Avalie seu pedido</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Obrigado por sua compra! Gostaríamos de saber sua opinião.
            </p>
            <FeedbackForm
              pedidoId={urlToken}
              onSubmitted={() => {
                qc.invalidateQueries({ queryKey: ["feedbacks-aprovados"] });
                qc.invalidateQueries({ queryKey: ["feedback-stats"] });
              }}
            />
          </div>
        )}

        {/* Lista de feedbacks */}
        <div>
          <h2 className="font-bold mb-4">
            {filtroNota ? `Avaliações com ${filtroNota} estrela${filtroNota > 1 ? "s" : ""}` : "Todas as avaliações"}
          </h2>

          {feedbacksQ.isPending && (
            <p className="text-center text-muted-foreground py-8">Carregando avaliações...</p>
          )}

          {feedbacksQ.isError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-red-600">Não foi possível carregar as avaliações.</p>
              <Button variant="outline" className="mt-2" onClick={() => feedbacksQ.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}

          {!feedbacksQ.isPending && !feedbacksQ.isError && feedbacksQ.data?.length === 0 && (
            <div className="rounded-xl border bg-white p-8 text-center">
              <Star className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-3 text-muted-foreground">
                {filtroNota 
                  ? `Nenhuma avaliação com ${filtroNota} estrela${filtroNota > 1 ? "s" : ""}`
                  : "Ainda não há avaliações. Seja o primeiro a avaliar!"
                }
              </p>
            </div>
          )}

          <div className="space-y-4">
            {feedbacksQ.data?.map((feedback: any) => (
              <FeedbackCard key={feedback.id} feedback={feedback} />
            ))}
          </div>
        </div>

        {/* Botão para voltar */}
        <Button className="w-full" variant="outline" size="lg" onClick={() => window.location.href = "/loja"}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Loja
        </Button>
      </main>
    </div>
  );
}
