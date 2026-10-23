import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Hook que gerencia o alerta sonoro de novos pedidos.
 * Reproduz um som de campainha quando um novo pedido chega.
 * Usa Web Audio API para gerar som sem arquivos externos.
 * Funciona mesmo quando o operador está em outra aba do navegador.
 */
export function useNewOrderSound() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playedOrdersRef = useRef<Set<string>>(new Set());
  const soundEnabledRef = useRef(true);
  const [isPageVisible, setIsPageVisible] = useState(true);

  // Inicializa o áudio com um som de campainha gerado via Web Audio API
  useEffect(() => {
    // Verifica se o som está habilitado nas configurações
    const stored = localStorage.getItem("delivery-sound-enabled");
    if (stored !== null) {
      soundEnabledRef.current = stored === "true";
    }

    // Cria o AudioContext (suspended até interação do usuário)
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioCtxClass();
    audioCtxRef.current = audioContext;

    // Garante que o AudioContext esteja ativo (navegadores suspendem até interação)
    const resumeOnInteraction = () => {
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }
    };
    document.addEventListener("click", resumeOnInteraction, { once: true });
    document.addEventListener("keydown", resumeOnInteraction, { once: true });

    // Page Visibility API — detecta quando a aba volta a ser visível
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      setIsPageVisible(visible);
      
      // Resume o AudioContext quando a aba volta a ser visível
      if (visible && audioContext.state === "suspended") {
        audioContext.resume();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    function playBellSound() {
      if (!soundEnabledRef.current) return;
      
      // Resume o contexto se estiver suspenso
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      // Toca duas notas de campainha para maior visibilidade
      const now = audioContext.currentTime;

      // Primeira nota
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(660, now + 0.15);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Segunda nota (ligeiramente atrasada — efeito de campainha)
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.2);
      osc2.frequency.exponentialRampToValueAtTime(660, now + 0.35);
      gain2.gain.setValueAtTime(0.4, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.5);

      // Atualiza o título da aba para chamar atenção quando em outra aba
      if (!isPageVisible) {
        const originalTitle = document.title;
        document.title = "🔔 Novo Pedido! — PizzaStockAI";
        setTimeout(() => {
          document.title = originalTitle;
        }, 5000);
      }
    }

    // Armazena a função globalmente para uso em outros módulos
    (window as any).__playOrderBell = playBellSound;

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("click", resumeOnInteraction);
      document.removeEventListener("keydown", resumeOnInteraction);
      audioContext.close();
      delete (window as any).__playOrderBell;
    };
  }, []);

  // Toca o som quando um novo pedido chega
  const playNewOrderSound = useCallback((orderId: string) => {
    // Evita tocar o som mais de uma vez para o mesmo pedido
    if (playedOrdersRef.current.has(orderId)) {
      return;
    }

    playedOrdersRef.current.add(orderId);

    // Toca o som de campainha
    const playBell = (window as any).__playOrderBell as (() => void) | undefined;
    if (playBell) {
      playBell();
    }

    // Remove o pedido do set após 10 minutos para permitir tocar novamente se necessário
    setTimeout(() => {
      playedOrdersRef.current.delete(orderId);
    }, 10 * 60 * 1000);
  }, []);

  // Limpa o set de pedidos tocados
  const clearPlayedOrders = useCallback(() => {
    playedOrdersRef.current.clear();
  }, []);

  // Toggle do som
  const toggleSound = useCallback((enabled?: boolean) => {
    const newValue = enabled !== undefined ? enabled : !soundEnabledRef.current;
    soundEnabledRef.current = newValue;
    localStorage.setItem("delivery-sound-enabled", String(newValue));
  }, []);

  // Verifica se o som está habilitado
  const isSoundEnabled = useCallback(() => {
    return soundEnabledRef.current;
  }, []);

  return {
    playNewOrderSound,
    clearPlayedOrders,
    toggleSound,
    isSoundEnabled,
  };
}
