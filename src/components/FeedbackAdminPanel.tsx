import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, CheckCircle, XCircle, MessageSquare, Filter, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function StarRating({ rating, size = "sm" }: { 
  rating: number; 
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-3 w-3" : "h-5 w-5";
  
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

export function FeedbackAdminPanel() {
  const qc = useQueryClient();
  const [filtroNota, setFiltroNota] = useState<number | null>(null);
  const [filtroAprovado, setFiltroAprovado] = useState<boolean | null>(null);
  const [respostaFeedbackId, setRespostaFeedbackId] = useState<string | null>(null);
  const [respostaTexto, setRespostaTexto] = useState("");

  // Busca estatísticas
  const statsQ = useQuery({
    queryKey: ["feedback-stats-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("estatisticas_feedback");
      if (error) {
        if (error.message?.includes('does not exist') || error.message?.includes('could not open relation') || error.message?.includes('function')) {
          return { total_feedbacks: 0, total_aprovados: 0, media_geral: 0 };
        }
        throw error;
      }
      return data;
    },
  });

  // Busca todos os feedbacks (admin)
  const feedbacksQ = useQuery({
    queryKey: ["feedbacks-admin", filtroNota, filtroAprovado],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_todos_feedbacks", {
        _limite: 100,
        _offset: 0,
        _nota_filtro: filtroNota,
        _aprovado_filtro: filtroAprovado,
      });
      if (error) {
        if (error.message?.includes('does not exist') || error.message?.includes('could not open relation') || error.message?.includes('function')) {
          return [];
        }
        throw error;
      }
      return data || [];
    },
  });

  // Aprovar/ocultar feedback
  async function handleToggleAprovacao(feedbackId: string, atual: boolean) {
    try {
      const { error } = await (supabase as any).rpc("modificar_feedback_aprovacao", {
        _feedback_id: feedbackId,
        _aprovado: !atual,
      });
      if (error) throw error;
      toast.success(!atual ? "Feedback aprovado" : "Feedback ocultado");
      await qc.invalidateQueries({ queryKey: ["feedbacks-admin"] });
      await qc.invalidateQueries({ queryKey: ["feedback-stats-admin"] });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível alterar o feedback");
    }
  }

  // Responder feedback
  async function handleResponderFeedback() {
    if (!respostaFeedbackId) return;
    if (!respostaTexto.trim()) {
      toast.error("Digite a resposta");
      return;
    }

    try {
      const { error } = await (supabase as any).rpc("responder_feedback", {
        _feedback_id: respostaFeedbackId,
        _resposta: respostaTexto.trim(),
      });
      if (error) throw error;
      toast.success("Resposta enviada");
      setRespostaFeedbackId(null);
      setRespostaTexto("");
      await qc.invalidateQueries({ queryKey: ["feedbacks-admin"] });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível enviar a resposta");
    }
  }

  const stats = statsQ.data;
  const totalFeedbacks = Number(stats?.total_feedbacks || 0);
  const totalAprovados = Number(stats?.total_aprovados || 0);
  const mediaGeral = Number(stats?.media_geral || 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Avaliações dos Clientes</h3>
      </div>

      {/* Estatísticas */}
      {statsQ.data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Total de avaliações</p>
            <p className="text-2xl font-bold">{totalFeedbacks}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Aprovadas</p>
            <p className="text-2xl font-bold">{totalAprovados}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Média geral</p>
            <div className="flex items-center gap-1">
              <p className="text-2xl font-bold">{mediaGeral.toFixed(1)}</p>
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Filtrar:</span>
        
        <select
          className="rounded border bg-background px-2 py-1 text-xs"
          value={filtroNota ?? ""}
          onChange={(e) => setFiltroNota(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Todas as notas</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{n} estrela{n > 1 ? "s" : ""}</option>
          ))}
        </select>

        <select
          className="rounded border bg-background px-2 py-1 text-xs"
          value={filtroAprovado === null ? "" : String(filtroAprovado)}
          onChange={(e) => setFiltroAprovado(e.target.value === "" ? null : e.target.value === "true")}
        >
          <option value="">Todos os status</option>
          <option value="true">Aprovados</option>
          <option value="false">Não aprovados</option>
        </select>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => {
            setFiltroNota(null);
            setFiltroAprovado(null);
          }}
        >
          Limpar
        </Button>
      </div>

      {/* Lista de feedbacks */}
      {feedbacksQ.isPending && (
        <p className="text-center text-muted-foreground py-4">Carregando...</p>
      )}

      {feedbacksQ.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">Erro ao carregar feedbacks</p>
        </div>
      )}

      {!feedbacksQ.isPending && feedbacksQ.data?.length === 0 && (
        <p className="text-center text-muted-foreground py-4">Nenhum feedback encontrado</p>
      )}

      <div className="space-y-3">
        {feedbacksQ.data?.map((feedback: any) => (
          <div key={feedback.id} className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-xs font-semibold text-primary">
                    {feedback.cliente_nome.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">{feedback.cliente_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(feedback.criado_em).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StarRating rating={feedback.nota} />
                <Badge variant={feedback.aprovado ? "default" : "secondary"}>
                  {feedback.aprovado ? "Aprovado" : "Pendente"}
                </Badge>
              </div>
            </div>

            {feedback.comentario && (
              <p className="text-sm">{feedback.comentario}</p>
            )}

            {feedback.resposta && (
              <div className="rounded bg-muted/50 p-2 border-l-2 border-primary">
                <p className="text-xs font-medium text-primary mb-1">Resposta da loja</p>
                <p className="text-xs text-muted-foreground">{feedback.resposta}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleToggleAprovacao(feedback.id, feedback.aprovado)}
              >
                {feedback.aprovado ? (
                  <>
                    <EyeOff className="h-3 w-3 mr-1" />
                    Ocultar
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    Aprovar
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setRespostaFeedbackId(feedback.id);
                  setRespostaTexto(feedback.resposta || "");
                }}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                {feedback.resposta ? "Editar resposta" : "Responder"}
              </Button>
            </div>

            {/* Campo de resposta */}
            {respostaFeedbackId === feedback.id && (
              <div className="space-y-2 pt-2 border-t">
                <Input
                  value={respostaTexto}
                  onChange={(e) => setRespostaTexto(e.target.value)}
                  placeholder="Digite sua resposta..."
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleResponderFeedback}
                    disabled={!respostaTexto.trim()}
                  >
                    Enviar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRespostaFeedbackId(null);
                      setRespostaTexto("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
