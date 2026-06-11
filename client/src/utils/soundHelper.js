let audioCtx = null;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
};

/**
 * Plays a modern, subtle check/swoosh chime representing a sent message.
 */
export const playSentSound = () => {
  try {
    const ctx = getAudioContext();
    const time = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(1450, time + 0.07);
    
    gainNode.gain.setValueAtTime(0.06, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(time);
    osc.stop(time + 0.07);
  } catch (e) {
    console.warn("Failed to play sent sound:", e);
  }
};

/**
 * Plays a warm, double-tone rising bell representing a received message.
 */
export const playReceivedSound = () => {
  try {
    const ctx = getAudioContext();
    const time = ctx.currentTime;
    
    // First tone (warm deep beep - D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, time);
    
    gain1.gain.setValueAtTime(0.06, time);
    gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(time);
    osc1.stop(time + 0.06);
    
    // Second tone (brighter high bell - A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.00, time + 0.065);
    
    gain2.gain.setValueAtTime(0.06, time + 0.065);
    gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(time + 0.065);
    osc2.stop(time + 0.22);
  } catch (e) {
    console.warn("Failed to play received sound:", e);
  }
};
