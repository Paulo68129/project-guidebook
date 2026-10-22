import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Esta página não carregou</h1>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PizzaStockAI — Gestão inteligente para pizzarias" },
      { name: "description", content: "Estoque, PDV, delivery, finanças e previsão de demanda para pizzarias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Manrope:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  // Solução principal: JavaScript substitui o coração por caractere invisível (Zero Width Space)
  // CSS de cor preta atua como camada adicional para qualquer elemento DOM injetado pelo Lovable
  // O fundo escuro do site (oklch(0.17 0.01 40)) faz com que o preto seja praticamente invisível
  useEffect(() => {
    const emojiPattern = /[\u{1F000}-\u{1FAD6}\u{1FAD7}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\p{Emoji}\p{Extended_Pictographic}]/gu;
    // Padrão específico para todos os tipos de coração
    const heartPattern = /[♥❤💖💗💕💓💝💘💞💟❣️🖤🤍🧡💛💚💙💜]/gu;

    const fixTitle = () => {
      const title = document.title;
      // Substitui corações por Zero Width Space (caractere invisível) antes de limpar
      const heartsReplaced = title.replace(heartPattern, "\u200B");
      // Remove TODOS os emojis restantes e caracteres não-alfanuméricos do início
      const cleaned = heartsReplaced
        .replace(emojiPattern, "")
        .replace(/^[^\w\u00C0-\u024F]*/, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      // Sempre força o título limpo se houver diferença ou se houver emoji/coração
      if (cleaned && (cleaned !== title || emojiPattern.test(title) || heartPattern.test(title))) {
        document.title = cleaned;
      }
    };

    // Injeta CSS para forçar cor preta em qualquer elemento injetado pelo Lovable
    const styleId = "lovable-heart-black";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        /* Camada adicional: força cor preta em elementos do Lovable para ficar invisível no fundo escuro */
        [class*="lovable"], [id*="lovable"], [class*="Lovable"], [id*="Lovable"] {
          color: black !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Corrige imediatamente ao carregar
    fixTitle();
    // Intervalo de 300ms para bloquear reinjeção do Lovable em tempo real
    const interval = setInterval(fixTitle, 300);
    // Observa mudanças no <head> para detectar injeção dinâmica
    const observer = new MutationObserver(() => fixTitle());
    observer.observe(document.head, { childList: true, subtree: true });
    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
      <SpeedInsights />
    </QueryClientProvider>
  );
}
