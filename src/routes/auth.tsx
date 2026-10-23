import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetPasswordBusy, setResetPasswordBusy] = useState(false);

  useEffect(() => {
    // Detecta se o usuário chegou via link de recuperação de senha do e-mail
    // O Supabase redireciona com o token no hash da URL
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    const isPasswordRecovery =
      hash.includes("type=password_recovery") ||
      urlParams.get("type") === "password_recovery" ||
      hash.includes("access_token") && hash.includes("refresh_token");

    if (isPasswordRecovery) {
      setResetMode(true);
      // Limpa o hash para não expor o token na URL
      window.history.replaceState(null, "", window.location.pathname);
    }

    // Listener para mudanças de estado de autenticação
    const { data: subscriber } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (session) {
          const currentHash = window.location.hash;
          const currentParams = new URLSearchParams(window.location.search);
          if (
            currentHash.includes("type=password_recovery") ||
            currentParams.get("type") === "password_recovery" ||
            event === "PASSWORD_RECOVERY"
          ) {
            setResetMode(true);
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      }
      // Quando um usuário novo confirma o email (PASSWORD_RECOVERY/SIGNED_IN), verifica se tem role
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session?.user) {
        const userId = session.user.id;
        // Verifica se já tem um role atribuído
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (!roles || roles.length === 0) {
          // Verifica se já existe algum admin no sistema
          const { data: admins } = await supabase
            .from("user_roles")
            .select("*")
            .eq("role", "admin");

          // Se não há admins, o primeiro usuário vira admin; senão, vira atendente
          const role = !admins || admins.length === 0 ? "admin" : "atendente";
          await supabase.from("user_roles").insert({ user_id: userId, role });

          // Cria ou atualiza o profile se necessário
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", userId);

          if (!profiles || profiles.length === 0) {
            await supabase.from("profiles").upsert({
              id: userId,
              email: session.user.email || "",
              nome: (session.user.user_metadata as Record<string, unknown>)['full_name'] as string | undefined || session.user.email?.split("@")[0] || "",
            });
          }
        }
      }
    });

    return () => {
      subscriber.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;

        // Se o usuário foi criado, verifica se é o primeiro usuário e atribui role de admin
        if (data.user) {
          const { data: existingRoles } = await supabase
            .from("user_roles")
            .select("*")
            .eq("user_id", data.user.id);

          if (!existingRoles || existingRoles.length === 0) {
            // Verifica se já existe algum admin no sistema
            const { data: admins } = await supabase
              .from("user_roles")
              .select("*")
              .eq("role", "admin");

            // Se não há admins, o primeiro usuário vira admin; senão, vira atendente
            const role = !admins || admins.length === 0 ? "admin" : "atendente";
            await supabase.from("user_roles").insert({
              user_id: data.user.id,
              role,
            });

            // Atualiza o profile
            await supabase.from("profiles").upsert({
              id: data.user.id,
              email,
            });
          }
        }

        toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
        setMode("in");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) return toast.error(r.error.message);
    if (r.redirected) return undefined;
    
    // Se o login foi bem-sucedido, verifica se é um novo usuário e atribui role
    if (r.tokens?.access_token) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: existingRoles } = await supabase
          .from("user_roles")
          .select("*")
          .eq("user_id", user.id);

        if (!existingRoles || existingRoles.length === 0) {
          // Verifica se já existe algum admin no sistema
          const { data: admins } = await supabase
            .from("user_roles")
            .select("*")
            .eq("role", "admin");

          // Se não há admins, o primeiro usuário vira admin; senão, vira atendente
          const role = !admins || admins.length === 0 ? "admin" : "atendente";
          await supabase.from("user_roles").insert({
            user_id: user.id,
            role,
          });

          // Cria ou atualiza o profile
          await supabase.from("profiles").upsert({
            id: user.id,
            email: user.email || "",
            nome: (user.user_metadata as Record<string, unknown>)['full_name'] as string | undefined || user.email?.split("@")[0] || "",
          });
        }
      }
    }
    
    nav({ to: "/dashboard" });
    return undefined;
  }

  async function sendResetEmail(e: React.FormEvent) {
    e.preventDefault();
    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + "/auth?type=password_recovery",
      });
      if (error) {
        console.error("[Auth] Erro ao enviar e-mail de recuperação:", error);
        throw error;
      }
      console.log("[Auth] E-mail de recuperação enviado para:", resetEmail);
      toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      setResetOpen(false);
      setResetEmail("");
    } catch (err) {
      console.error("[Auth] Falha ao enviar e-mail de recuperação:", err);
      toast.error((err as Error).message || "Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setResetBusy(false);
    }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setResetPasswordBusy(true);
    try {
      // Verifica se há uma sessão ativa (deve estar ativa após clicar no link de recuperação)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        console.error("[Auth] Nenhuma sessão ativa para atualizar a senha:", sessionError);
        toast.error("Sessão expirada. Por favor, solicite um novo link de recuperação.");
        setResetMode(false);
        return;
      }

      console.log("[Auth] Atualizando senha para o usuário:", sessionData.session.user.email);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        console.error("[Auth] Erro ao atualizar a senha:", error);
        throw error;
      }
      console.log("[Auth] Senha atualizada com sucesso!");
      toast.success("Senha atualizada com sucesso! Faça login com a nova senha.");
      setResetMode(false);
      setNewPassword("");
      setConfirmPassword("");
      setMode("in");
    } catch (err) {
      console.error("[Auth] Falha ao atualizar a senha:", err);
      toast.error((err as Error).message || "Não foi possível atualizar a senha.");
    } finally {
      setResetPasswordBusy(false);
    }
  }

  if (resetMode) {
    return (
      <div className="grid min-h-screen place-items-center bg-hearth px-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-glow">
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ember-gradient text-2xl">🔑</div>
            <h1 className="mt-4 text-2xl font-bold">Definir nova senha</h1>
            <p className="mt-1 text-sm text-muted-foreground">Crie uma nova senha para sua conta.</p>
          </div>
          <form onSubmit={updatePassword} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="new-pw">Nova senha</Label>
              <Input id="new-pw" type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <Label htmlFor="confirm-pw">Confirmar senha</Label>
              <Input id="confirm-pw" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" />
            </div>
            <Button type="submit" disabled={resetPasswordBusy} className="w-full bg-ember-gradient">
              {resetPasswordBusy ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setResetMode(false);
              setMode("in");
            }}
          >
            Voltar para login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-hearth px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-glow">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ember-gradient text-2xl">🍕</div>
          <h1 className="mt-4 text-2xl font-bold">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">O primeiro usuário vira administrador.</p>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label htmlFor="pw">Senha</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" disabled={busy} className="w-full bg-ember-gradient">{mode === "in" ? "Entrar" : "Cadastrar"}</Button>
        </form>
        {mode === "in" && (
          <button
            type="button"
            className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setResetOpen(true)}
          >
            Esqueci minha senha
          </button>
        )}
        <Button variant="outline" className="mt-3 w-full" onClick={google}>Continuar com Google</Button>
        <button className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe o e-mail cadastrado para receber o link de recuperação.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={sendResetEmail} className="space-y-4">
            <div>
              <Label htmlFor="reset-email">E-mail</Label>
              <Input
                id="reset-email"
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={resetBusy} className="bg-ember-gradient">
                Enviar link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
