import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useLocalStorageSync } from "@/hooks/useLocalStorageSync";

function AuthenticatedLayout() {
  // Auto-refresh all pages when localStorage data changes (real-time sync)
  useLocalStorageSync();
  return <AppShell />;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});
