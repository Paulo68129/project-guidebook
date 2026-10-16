import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — PizzaStockAI" },
      { name: "description", content: "Acesse o painel de gestão da sua pizzaria." },
      { property: "og:title", content: "Entrar — PizzaStockAI" },
      { property: "og:description", content: "Acesse o painel de gestão da sua pizzaria." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard" } });
        if (error) throw error;
        toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
        setMode("in");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      toast.success("Enviamos um link de recuperação para o seu e-mail.");
      setMode("in");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) return toast.error(r.error.message);
    if (r.redirected) return undefined;
    nav({ to: "/dashboard" });
    return undefined;
  }

  return (
    <div className="grid min-h-screen place-items-center bg-hearth px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-glow">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ember-gradient text-2xl">🍕</div>
          <h1 className="mt-4 text-2xl font-bold">{mode === "in" ? "Entrar" : mode === "up" ? "Criar conta" : "Recuperar senha"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot" ? "Informe seu e-mail para receber o link de recuperação." : "O primeiro usuário vira administrador."}
          </p>
        </div>
        {mode === "forgot" ? (
          <form onSubmit={forgot} className="mt-6 space-y-4">
            <div><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <Button type="submit" disabled={busy} className="w-full bg-ember-gradient">Enviar link de recuperação</Button>
          </form>
        ) : (
          <>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label htmlFor="pw">Senha</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" disabled={busy} className="w-full bg-ember-gradient">{mode === "in" ? "Entrar" : "Cadastrar"}</Button>
            </form>
            {mode === "in" && (
              <button className="mt-2 w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>
                Esqueci a senha
              </button>
            )}
            <Button variant="outline" className="mt-3 w-full" onClick={google}>Continuar com Google</Button>
          </>
        )}
        <button className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}
