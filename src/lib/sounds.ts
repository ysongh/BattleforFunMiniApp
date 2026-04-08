import * as Tone from 'tone';

let started = false;

async function ensureStarted() {
  if (!started) {
    await Tone.start();
    started = true;
  }
}

// Each play function creates a fresh synth, fires it, then disposes after
// its release tail — this allows overlapping sounds naturally.

export async function playAttack(muted = false) {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.MetalSynth({
    volume: -8,
    envelope: { attack: 0.001, decay: 0.12, release: 0.08 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).toDestination();
  synth.frequency.value = 200;
  synth.triggerAttackRelease(200, '32n');
  setTimeout(() => synth.dispose(), 500);
}

export async function playCounterAttack(muted = false) {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.MetalSynth({
    volume: -12,
    envelope: { attack: 0.001, decay: 0.1, release: 0.06 },
    harmonicity: 5.1,
    modulationIndex: 28,
    resonance: 3000,
    octaves: 1.2,
  }).toDestination();
  synth.triggerAttackRelease(140, '32n');
  setTimeout(() => synth.dispose(), 500);
}

export async function playImpact(muted = false) {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.NoiseSynth({
    volume: -6,
    noise: { type: 'brown' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
  }).toDestination();
  synth.triggerAttackRelease('16n');
  setTimeout(() => synth.dispose(), 600);
}

export async function playDestroyed(muted = false) {
  if (muted) return;
  await ensureStarted();
  // Low kick thud
  const kick = new Tone.MembraneSynth({
    volume: -4,
    pitchDecay: 0.08,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
  }).toDestination();
  kick.triggerAttackRelease('C1', '8n');

  // Noise burst layered on top
  const noise = new Tone.NoiseSynth({
    volume: -10,
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.05 },
  }).toDestination();
  noise.triggerAttackRelease('8n');

  setTimeout(() => { kick.dispose(); noise.dispose(); }, 800);
}

export async function playSelect(muted = false) {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.Synth({
    volume: -16,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.05 },
  }).toDestination();
  synth.triggerAttackRelease('G5', '32n');
  setTimeout(() => synth.dispose(), 400);
}

export async function playMove(muted = false) {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.Synth({
    volume: -20,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 },
  }).toDestination();
  synth.triggerAttackRelease('C4', '32n');
  setTimeout(() => synth.dispose(), 400);
}

export async function playCaptured(muted = false) {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.PolySynth(Tone.Synth, {
    volume: -10,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.3 },
  }).toDestination();
  // Major chord stab: C E G
  synth.triggerAttackRelease(['C5', 'E5', 'G5'], '8n');
  setTimeout(() => synth.dispose(), 1000);
}

export async function playVictory(muted = false) {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.PolySynth(Tone.Synth, {
    volume: -8,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 },
  }).toDestination();
  const now = Tone.now();
  // Ascending arpeggio: C E G C
  synth.triggerAttackRelease('C4', '8n', now);
  synth.triggerAttackRelease('E4', '8n', now + 0.15);
  synth.triggerAttackRelease('G4', '8n', now + 0.3);
  synth.triggerAttackRelease('C5', '4n', now + 0.45);
  setTimeout(() => synth.dispose(), 2000);
}

export async function playDefeat(muted = false) {
  if (muted) return;
  await ensureStarted();
  const synth = new Tone.Synth({
    volume: -8,
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.02, decay: 0.5, sustain: 0.2, release: 0.8 },
  }).toDestination();
  const reverb = new Tone.Reverb({ decay: 2, wet: 0.4 }).toDestination();
  synth.connect(reverb);
  const now = Tone.now();
  // Descending glide
  synth.triggerAttackRelease('G4', '4n', now);
  synth.triggerAttackRelease('E4', '4n', now + 0.3);
  synth.triggerAttackRelease('C4', '2n', now + 0.6);
  setTimeout(() => { synth.dispose(); reverb.dispose(); }, 3000);
}
