import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { PageHeader, Panel, RouteError } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Shield, UserX } from "lucide-react";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — PizzaStockAI" },
      { name: "description", content: "Gerencie usuários e permissões da equipe." },
      { property: "og:title", content: "Equipe — PizzaStockAI" },
      { property: "og:description", content: "Gerencie a equipe da pizzaria." },
    ],
  }),
  errorComponent: RouteError,
  component: Equipe,
});

type UserRole = "admin" | "gerente" | "atendente";

function Equipe() {
  const { isAdmin, isManager } = useRole();
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["team-users"],
    queryFn: async () => {
      // Busca todos os usuários com seus roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Mapeia roles por user_id
      const roleMap = new Map<string, string[]>();
      roles?.forEach((r) => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      return (profiles || []).map((p) => ({
        ...p,
        roles: roleMap.get(p.id) || [],
        primaryRole: (roleMap.get(p.id) || []).includes("admin")
          ? "admin"
          : (roleMap.get(p.id) || []).includes("gerente")
            ? "gerente"
            : (roleMap.get(p.id) || [])[0] || "atendente",
      }));
    },
  });

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<UserRole>("atendente");
  const [busy, setBusy] = useState(false);

  // Só admins podem gerenciar a equipe
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Equipe" />
        <Panel>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Acesso restrito</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Apenas administradores podem gerenciar a equipe.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  async function convidarUsuario(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !nome) {
      toast.error("Preencha nome e e-mail.");
      return;
    }

    setBusy(true);
    try {
      // Verifica se o email já está cadastrado
      const existing = users?.find((u) => u.email === email);
      if (existing) {
        toast.error("Este e-mail já está cadastrado.");
        return;
      }

      // Usa o Supabase admin API para criar o usuário e enviar email de convite
      // O signUp envia o email de confirmação com link para criar senha
      const { data, error } = await supabase.auth.signUp({
        email,
        options: {
          data: {
            nome,
            invited_role: role,
          },
          emailRedirectTo: window.location.origin + "/auth",
        },
      });

      if (error) throw error;

      if (data.user) {
        // Insere o profile do usuário
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id,
          nome,
          email,
        });

        if (profileError) throw profileError;

        // Insere o role do usuário
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role,
        });

        if (roleError) throw roleError;

        toast.success(`Convite enviado para ${email} como ${role}!`);
        setEmail("");
        setNome("");
        setRole("atendente");
        qc.invalidateQueries({ queryKey: ["team-users"] });
      }
    } catch (err) {
      console.error("[Equipe] Erro ao convidar usuário:", err);
      toast.error((err as Error).message || "Não foi possível enviar o convite.");
    } finally {
      setBusy(false);
    }
  }

  async function removerRole(userId: string, userRole: string) {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", userRole);

      if (error) throw error;

      toast.success("Permissão removida.");
      qc.invalidateQueries({ queryKey: ["team-users"] });
    } catch (err) {
      toast.error((err as Error).message || "Não foi possível remover a permissão.");
    }
  }

  async function atualizarRole(userId: string, newRole: UserRole) {
    try {
      // Atualiza o role principal
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: newRole });

      if (error) throw error;

      toast.success(`Permissão atualizada para ${newRole}.`);
      qc.invalidateQueries({ queryKey: ["team-users"] });
    } catch (err) {
      toast.error((err as Error).message || "Não foi possível atualizar a permissão.");
    }
  }

  const roleLabel: Record<UserRole, string> = {
    admin: "Administrador",
    gerente: "Gerente",
    atendente: "Atendente",
  };

  const roleBadgeVariant: Record<UserRole, "default" | "secondary" | "outline"> = {
    admin: "default",
    gerente: "secondary",
    atendente: "outline",
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Equipe" />
        <Panel><div className="py-12 text-center text-muted-foreground">Carregando...</div></Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Equipe" />

      <Panel title="Convidar membro">
        <form onSubmit={convidarUsuario} className="max-w-2xl">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                placeholder="Nome do usuário"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="role">Permissão</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="atendente">Atendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={busy} className="w-full bg-ember-gradient">
                <UserPlus className="mr-2 h-4 w-4" />
                {busy ? "Enviando..." : "Convidar"}
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            O convite será enviado por e-mail. O usuário receberá um link para criar sua senha e acessar o sistema.
          </p>
        </form>
      </Panel>

      <Panel title="Membros da equipe">
        {users && users.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Nenhum membro na equipe ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {users?.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{user.nome || user.email}</span>
                    <Badge variant={roleBadgeVariant[user.primaryRole as UserRole] || "outline"}>
                      {roleLabel[user.primaryRole as UserRole] || user.primaryRole}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{user.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={user.primaryRole}
                    onValueChange={(v) => atualizarRole(user.id, v as UserRole)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="atendente">Atendente</SelectItem>
                    </SelectContent>
                  </Select>
                  {user.roles.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removerRole(user.id, user.primaryRole)}
                      title="Remover permissão"
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
