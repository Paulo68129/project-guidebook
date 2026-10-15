import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "gerente" | "atendente";

export function useRole() {
  const q = useQuery({
    queryKey: ["me-role"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { email: null as string | null, role: null as Role | null };
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const roles = (data ?? []).map((r) => r.role as Role);
      const role: Role | null = roles.includes("admin") ? "admin" : roles.includes("gerente") ? "gerente" : roles[0] ?? null;
      return { email: u.user.email ?? null, role };
    },
  });
  const role = q.data?.role ?? null;
  return { role, email: q.data?.email ?? null, isManager: role === "admin" || role === "gerente", isAdmin: role === "admin", loading: q.isLoading };
}
