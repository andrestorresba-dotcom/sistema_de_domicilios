// Alertas sonoras del panel, generadas con Web Audio (sin archivos de sonido).
// Los navegadores solo dejan sonar audio después de que la persona toca la pantalla;
// por eso el contexto se "despierta" con el primer clic o tecla.

let ctx: AudioContext | null = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudioOnInteraction() {
  const wake = () => getCtx();
  window.addEventListener('pointerdown', wake, { once: true });
  window.addEventListener('keydown', wake, { once: true });
}

function tone(freq: number, start: number, dur: number, gain = 0.18) {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export type SoundKind = 'pedido' | 'llamada' | 'pago';

export function playSound(kind: SoundKind) {
  try {
    if (kind === 'pedido') {
      // Dos notas ascendentes
      tone(784, 0, 0.25);
      tone(1047, 0.18, 0.4);
    } else if (kind === 'llamada') {
      // Timbre: tres toques
      [0, 0.22, 0.44].forEach(t => tone(1319, t, 0.18, 0.22));
    } else {
      tone(659, 0, 0.2);
      tone(880, 0.15, 0.2);
      tone(1175, 0.3, 0.35);
    }
  } catch {
    /* sin audio */
  }
}
