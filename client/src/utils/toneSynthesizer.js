let audioCtx = null;
let activeNodes = [];
let dialInterval = null;
let ringInterval = null;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
};

const stopAll = () => {
  // Clear any scheduled intervals
  if (dialInterval) {
    clearInterval(dialInterval);
    dialInterval = null;
  }
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }

  // Stop and disconnect all active nodes
  activeNodes.forEach(({ oscs, gainNode }) => {
    try {
      oscs.forEach((osc) => osc.stop());
      gainNode.disconnect();
    } catch (e) {
      // already stopped or discarded
    }
  });
  activeNodes = [];
};

/**
 * Play a professional soft sonar dial tone (ringing back to the caller).
 * Alternates 1.5s of dual-frequency tone (440Hz + 480Hz) with 2s of silence.
 */
const playDialTone = () => {
  stopAll();
  const ctx = getAudioContext();

  const playSingleBeep = () => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(440, ctx.currentTime);
    osc2.frequency.setValueAtTime(480, ctx.currentTime);

    // Soft rise and fall to make it pleasant and non-jarring
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.04, ctx.currentTime + 1.4);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);

    const nodeRef = { oscs: [osc1, osc2], gainNode };
    activeNodes.push(nodeRef);

    setTimeout(() => {
      try {
        osc1.stop();
        osc2.stop();
        gainNode.disconnect();
      } catch (err) {}
      activeNodes = activeNodes.filter((n) => n !== nodeRef);
    }, 1600);
  };

  // Play immediately and schedule loop
  playSingleBeep();
  dialInterval = setInterval(playSingleBeep, 3500);
};

/**
 * Play a beautiful, premium chord arpeggio ringtone for incoming calls.
 * Plays a pleasant C-Major/A-Minor warm chord sequence every 3 seconds.
 */
const playIncomingRingtone = () => {
  stopAll();
  const ctx = getAudioContext();

  const playChordSequence = () => {
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5 arpeggio
    const now = ctx.currentTime;
    
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + index * 0.15);

      const noteStart = now + index * 0.15;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.setValueAtTime(0, noteStart);
      gainNode.gain.linearRampToValueAtTime(0.05, noteStart + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.8);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + 0.9);

      const nodeRef = { oscs: [osc], gainNode };
      activeNodes.push(nodeRef);

      setTimeout(() => {
        try {
          osc.stop();
          gainNode.disconnect();
        } catch (e) {}
        activeNodes = activeNodes.filter((n) => n !== nodeRef);
      }, (index * 0.15 + 1.0) * 1000);
    });
  };

  playChordSequence();
  ringInterval = setInterval(playChordSequence, 3000);
};

/**
 * Play a sleek double descending beep indicating a disconnected call.
 */
const playEndTone = () => {
  stopAll();
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const freqs = [350, 250];
  freqs.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + index * 0.12);

    const noteStart = now + index * 0.12;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.setValueAtTime(0, noteStart);
    gainNode.gain.linearRampToValueAtTime(0.06, noteStart + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.2);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteStart + 0.22);

    const nodeRef = { oscs: [osc], gainNode };
    activeNodes.push(nodeRef);

    setTimeout(() => {
      try {
        osc.stop();
        gainNode.disconnect();
      } catch (e) {}
      activeNodes = activeNodes.filter((n) => n !== nodeRef);
    }, (index * 0.12 + 0.3) * 1000);
  });
};

export const toneSynthesizer = {
  playDialTone,
  playIncomingRingtone,
  playEndTone,
  stopAll,
};
