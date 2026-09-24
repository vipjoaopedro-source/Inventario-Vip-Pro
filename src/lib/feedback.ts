let ctx: AudioContext | null = null;

function tocar(freq: number, ms: number, vezes = 1) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    for (let i = 0; i < vezes; i++) {
      const inicio = ctx.currentTime + i * (ms / 1000 + 0.06);
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      ganho.gain.value = 0.15;
      osc.connect(ganho).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + ms / 1000);
    }
  } catch {
    // Sem áudio disponível.
  }
}

function vibrar(padrao: number | number[]) {
  try {
    navigator.vibrate?.(padrao);
  } catch {
    // Sem vibração.
  }
}

export function somOk(ativo = true) {
  if (!ativo) return;
  tocar(1800, 80);
  vibrar(40);
}

export function somErro(ativo = true) {
  if (!ativo) return;
  tocar(320, 180, 3);
  vibrar([200, 80, 200, 80, 200]);
}
