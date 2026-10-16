import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — PizzaStockAI" },
      { name: "description", content: "Defina uma nova senha para acessar o painel da sua pizzaria." },
      { property: "og:title", content: "Redefinir senha — PizzaStockAI" },
      { property: "og:description", content: "Defina uma nova senha para acessar o painel da sua pizzaria." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // O link do e-mail traz type=recovery no hash; o Supabase cria a sessão de recuperação.
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
      return undefined;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setTimeout(() => setInvalid((v) => v || true), 4000);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("As senhas não coincidem."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada! Entre com a nova senha.");
      await supabase.auth.signOut();
      nav({ to: "/auth" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-hearth px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-glow">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ember-gradient text-2xl">🔑</div>
          <h1 className="mt-4 text-2xl font-bold">Redefinir senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">Escolha uma nova senha para sua conta.</p>
        </div>
        {ready ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="npw">Nova senha</Label>
              <Input id="npw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cpw">Confirmar senha</Label>
              <Input id="cpw" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-ember-gradient">Salvar nova senha</Button>
          </form>
        ) : (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {invalid ? (
              <>
                <p>Link inválido ou expirado. Solicite um novo na tela de entrada.</p>
                <Button variant="outline" className="mt-4 w-full" onClick={() => nav({ to: "/auth" })}>Voltar para entrar</Button>
              </>
            ) : (
              <p>Validando o link de recuperação…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
