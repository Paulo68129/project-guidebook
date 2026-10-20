import { useEffect, useRef, useCallback } from "react";

/**
 * Hook que gerencia o alerta sonoro de novos pedidos.
 * Reproduz um som de campainha quando um novo pedido chega.
 */
export function useNewOrderSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playedOrdersRef = useRef<Set<string>>(new Set());
  const soundEnabledRef = useRef(true);

  // Inicializa o áudio com um som de campainha gerado via Web Audio API
  useEffect(() => {
    // Verifica se o som está habilitado nas configurações
    const stored = localStorage.getItem("delivery-sound-enabled");
    if (stored !== null) {
      soundEnabledRef.current = stored === "true";
    }

    // Cria um áudio de campainha usando Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    function playBellSound() {
      if (!soundEnabledRef.current) return;
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configura o som de campainha
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    }

    // Armazena a função para uso posterior
    (window as any).__playOrderBell = playBellSound;

    return () => {
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
