import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { brl, custoProduto, ingredientesQ, produtosQ, receitasQ, type Produto } from "@/lib/data";
import { useRole } from "@/hooks/useRole";
import { upsertProduto, deleteProduto, deleteReceitasPorProduto, insertReceitas } from "@/lib/rpc-direct";
import { compressImage } from "@/lib/local-storage";
import { PageHeader, RouteError } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Image as ImageIcon, X, Upload, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cardapio")({
  head: () => ({ meta: [{ title: "Cardápio — PizzaStockAI" }, { name: "description", content: "Produtos, preços, receitas e margem de lucro." }, { property: "og:title", content: "Cardápio — PizzaStockAI" }, { property: "og:description", content: "Cardápio e fichas técnicas da pizzaria." }] }),
  loader: ({ context }) => Promise.all([produtosQ, receitasQ, ingredientesQ].map((q) => context.queryClient.ensureQueryData(q as typeof produtosQ))),
  errorComponent: RouteError,
  component: Cardapio,
});

type Linha = { ingrediente_id: string; quantidade: string };

const FOTOS_PADRAO: Record<string, string> = {
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
  bebida: "https://images.unsplash.com/photo-1581006852262-e4307cf6283a",
  refrigerante: "https://images.unsplash.com/photo-1581006852262-e4307cf6283a",
  suco: "https://images.unsplash.com/photo-1600271886742-f049cd451bba",
  sobremesa: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop",
  entrada: "https://images.unsplash.com/photo-1528735602780-2552fd1b1d59?w=400&h=300&fit=crop",
  combo: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
};

function getFoto(p: { foto_url?: string | null; categoria?: string }) {
  const cat = p.categoria?.toLowerCase();
  return p.foto_url || (cat ? FOTOS_PADRAO[cat] : undefined) || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop";
}

function Cardapio() {
  const { data: produtos } = useSuspenseQuery(produtosQ);
  const { data: receitas } = useSuspenseQuery(receitasQ);
  const { data: ings } = useSuspenseQuery(ingredientesQ);
  const { isManager } = useRole();
  const qc = useQueryClient();
  const [ed, setEd] = useState<{ id?: string; nome: string; categoria: string; preco: string; descricao: string; foto_url: string; ativo: boolean; linhas: Linha[] } | null>(null);

  function abrir(p?: Produto) {
    setEd(p ? { id: p.id, nome: p.nome, categoria: p.categoria, preco: String(p.preco), descricao: p.descricao ?? "", foto_url: p.foto_url ?? "", ativo: p.ativo, linhas: receitas.filter((r) => r.produto_id === p.id).map((r) => ({ ingrediente_id: r.ingrediente_id, quantidade: String(r.quantidade) })) }
      : { nome: "", categoria: "pizza", preco: "0", descricao: "", foto_url: "", ativo: true, linhas: [] });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !ed) return;
    try {
      const base64 = await compressImage(file, 400, 0.7);
      setEd({ ...ed, foto_url: base64 });
      toast.success("Imagem adicionada!");
    } catch (err: any) {
      toast.error(`Erro ao carregar imagem: ${err.message}`);
    }
    // Reset input
    e.target.value = "";
  }

  async function excluirProduto(id: string) {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    try {
      const { error } = await deleteProduto(id);
      if (error) {
        toast.error(`Erro ao excluir: ${error.message}`);
        return;
      }
      toast.success("Produto excluído!");
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["receitas"] });
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err.message}`);
    }
  }

  async function salvar() {
    if (!ed) return;
    if (!ed.nome.trim()) { toast.error("Nome do produto é obrigatório"); return; }

    try {
      // Salvar produto — tenta Supabase primeiro, fallback para localStorage
      const { data: prodData, error: prodErr } = await upsertProduto({
        _id: ed.id || null,
        _nome: ed.nome.trim(),
        _categoria: ed.categoria.trim(),
        _preco: Number(ed.preco) || 0,
        _descricao: ed.descricao?.trim() || null,
        _foto_url: ed.foto_url?.trim() || null,
        _ativo: ed.ativo
      });

      if (prodErr) {
        console.error("[Cardapio] Erro ao salvar produto:", prodErr);
        toast.error(`Erro ao salvar produto: ${prodErr.message}`);
        return;
      }

      const id = (prodData as any)?.id || ed.id;
      if (!id) {
        toast.error("Falha ao obter ID do produto.");
        return;
      }

      // Limpar receitas antigas
      const { error: delErr } = await deleteReceitasPorProduto(id);
      if (delErr) console.warn("[Cardapio] Erro ao limpar receitas:", delErr);

      // Salvar novas receitas — tenta Supabase primeiro, fallback para localStorage
      const linhas = ed.linhas.filter((l) => l.ingrediente_id && Number(l.quantidade) > 0);
      if (linhas.length) {
        const { error: insErr } = await insertReceitas({
          _produto_id: id,
          _ingrediente_ids: linhas.map((l) => l.ingrediente_id),
          _quantidades: linhas.map((l) => Number(l.quantidade))
        });
        if (insErr) {
          console.error("[Cardapio] Erro ao salvar receitas:", insErr);
          toast.error(`Erro ao salvar ficha técnica: ${insErr.message}`);
          return;
        }
      }

      toast.success("Produto salvo com sucesso!");
      setEd(null);
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["receitas"] });
    } catch (err: any) {
      console.error("[Cardapio] Erro inesperado ao salvar:", err);
      toast.error(`Erro inesperado: ${err.message || "Tente novamente"}`);
    }
  }

  return (
    <div>
      <PageHeader title="Cardápio" sub="Custo calculado pela ficha técnica de cada produto">
        {isManager && <Button onClick={() => abrir()}>Novo produto</Button>}
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {produtos.map((p) => {
          const custo = custoProduto(p.id, receitas, ings);
          const margem = Number(p.preco) > 0 ? ((Number(p.preco) - custo) / Number(p.preco)) * 100 : 0;
          return (
            <div key={p.id} className={`group overflow-hidden rounded-xl border bg-card transition ${p.ativo ? "hover:border-primary hover:shadow-lg" : "opacity-50"}`}>
              <div className="relative h-40 overflow-hidden bg-muted">
                <img
                  src={getFoto(p)}
                  alt={p.nome}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = FOTOS_PADRAO[p.categoria?.toLowerCase()] || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop";
                  }}
                />
                {!p.ativo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="rounded-md bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground">Inativo</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div><div className="text-xs uppercase text-muted-foreground">{p.categoria}</div><div className="font-display text-lg font-semibold">{p.nome}</div></div>
                  <div className="font-display text-lg text-primary">{brl(Number(p.preco))}</div>
                </div>
                {p.descricao && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.descricao}</p>}
                <div className="mt-3 flex justify-between text-sm"><span>Custo {brl(custo)}</span><span className={margem < 30 ? "text-destructive" : ""}>Margem {margem.toFixed(0)}%</span></div>
                {isManager && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => abrir(p)}>Editar</Button>
                    <Button size="sm" variant="outline" className="w-10 px-0 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => excluirProduto(p.id)} title="Excluir produto">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!ed} onOpenChange={(o) => !o && setEd(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{ed?.id ? "Editar" : "Novo"} produto</DialogTitle></DialogHeader>
          {ed && (
            <div className="space-y-3">
              {/* Preview da foto com upload */}
              <div className="relative h-44 overflow-hidden rounded-xl bg-muted">
                {ed.foto_url ? (
                  <img
                    src={ed.foto_url}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={() => setEd({ ...ed, foto_url: "" })}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-10 w-10 opacity-50" />
                    <span className="text-sm">Sem foto</span>
                  </div>
                )}
                {ed.foto_url && (
                  <button
                    onClick={() => setEd({ ...ed, foto_url: "" })}
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                    title="Remover foto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {/* Upload overlay */}
                <label className="absolute bottom-2 right-2 cursor-pointer rounded-lg bg-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary">
                  <Upload className="mr-1 inline h-3 w-3" />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">URL da foto (opcional)</label>
                <Input
                  placeholder="https://exemplo.com/foto-do-produto.jpg"
                  value={ed.foto_url?.startsWith?.("data:") ? "" : (ed.foto_url || "")}
                  onChange={(e) => setEd({ ...ed, foto_url: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">Cole a URL de uma imagem, use o botão "Upload" para enviar uma foto, ou deixe vazio para usar a foto padrão.</p>
              </div>
              <Input placeholder="Nome" value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Categoria" value={ed.categoria} onChange={(e) => setEd({ ...ed, categoria: e.target.value })} />
                <Input type="number" step="0.01" placeholder="Preço" value={ed.preco} onChange={(e) => setEd({ ...ed, preco: e.target.value })} />
              </div>
              <Input placeholder="Descrição" value={ed.descricao} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ed.ativo} onChange={(e) => setEd({ ...ed, ativo: e.target.checked })} /> Disponível para venda</label>
              <div className="text-sm font-semibold">Ficha técnica</div>
              {ed.linhas.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <select className="flex-1 rounded-md border bg-background p-2 text-sm" value={l.ingrediente_id} onChange={(e) => {
                    const ls = ed.linhas.map((item, idx) => idx === i ? { ...item, ingrediente_id: e.target.value } : item);
                    setEd({ ...ed, linhas: ls });
                  }}>
                    <option value="">Ingrediente...</option>
                    {ings.map((g) => <option key={g.id} value={g.id}>{g.nome} ({g.unidade})</option>)}
                  </select>
                  <Input className="w-24" type="number" step="any" value={l.quantidade} onChange={(e) => {
                    const ls = ed.linhas.map((item, idx) => idx === i ? { ...item, quantidade: e.target.value } : item);
                    setEd({ ...ed, linhas: ls });
                  }} />
                  <Button variant="ghost" size="sm" onClick={() => setEd({ ...ed, linhas: ed.linhas.filter((_, j) => j !== i) })}>✕</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setEd({ ...ed, linhas: [...ed.linhas, { ingrediente_id: "", quantidade: "" }] })}>+ Ingrediente</Button>
              <Button className="w-full" onClick={salvar}>Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
