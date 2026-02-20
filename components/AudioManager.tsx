import React, { useEffect, useRef } from 'react';
import { BotLockStatus } from '../types';

interface AudioManagerProps {
  profile: 'Industrial' | 'Natural' | 'Void' | 'Electronic' | 'Hostile';
  status: BotLockStatus;
  scrollPos: number; // 0 to 100
  isMuted: boolean;
}

const AudioManager: React.FC<AudioManagerProps> = ({ profile, status, scrollPos, isMuted }) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  
  // Ambient noise components
  const noiseNodeRef = useRef<ScriptProcessorNode | null>(null);
  const noiseFilterRef = useRef<BiquadFilterNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  
  // Harmonic components (Drones)
  const oscBankRef = useRef<OscillatorNode[]>([]);
  const droneGainRef = useRef<GainNode | null>(null);
  const spatialPannerRef = useRef<StereoPannerNode | null>(null);
  
  // System components
  const alarmOscRef = useRef<OscillatorNode | null>(null);
  const alarmGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const mainGain = ctx.createGain();
    mainGain.connect(ctx.destination);
    mainGain.gain.value = isMuted ? 0 : 0.4;
    mainGainRef.current = mainGain;

    // 1. Noise Generator Logic
    const bufferSize = 4096;
    const noiseNode = ctx.createScriptProcessor(bufferSize, 1, 1);
    noiseNode.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    };
    
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    
    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(mainGain);
    
    noiseNodeRef.current = noiseNode;
    noiseFilterRef.current = noiseFilter;
    noiseGainRef.current = noiseGain;

    // 2. Drone / Spatial Bank
    const panner = ctx.createStereoPanner();
    panner.connect(mainGain);
    spatialPannerRef.current = panner;

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.2;
    droneGain.connect(panner);
    droneGainRef.current = droneGain;

    const bank: OscillatorNode[] = [];
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.connect(droneGain);
      osc.start();
      bank.push(osc);
    }
    oscBankRef.current = bank;

    // 3. OVERRIDE Alarm
    const alarmOsc = ctx.createOscillator();
    const alarmGain = ctx.createGain();
    alarmOsc.type = 'sawtooth';
    alarmGain.gain.value = 0;
    alarmOsc.connect(alarmGain);
    alarmGain.connect(mainGain);
    alarmOsc.start();
    alarmOscRef.current = alarmOsc;
    alarmGainRef.current = alarmGain;

    return () => {
      ctx.close();
    };
  }, []);

  // Handle Muting
  useEffect(() => {
    if (mainGainRef.current && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      mainGainRef.current.gain.setTargetAtTime(isMuted ? 0 : 0.4, now, 0.1);
    }
  }, [isMuted]);

  // Handle Spatial Panning
  useEffect(() => {
    if (spatialPannerRef.current && audioCtxRef.current) {
      const panValue = (scrollPos / 50) - 1; 
      spatialPannerRef.current.pan.setTargetAtTime(panValue, audioCtxRef.current.currentTime, 0.1);
    }
  }, [scrollPos]);

  // Handle OVERRIDE status
  useEffect(() => {
    if (!audioCtxRef.current || !alarmGainRef.current || !alarmOscRef.current) return;

    const now = audioCtxRef.current.currentTime;
    if (status === BotLockStatus.OVERRIDE) {
      alarmGainRef.current.gain.setTargetAtTime(0.1, now, 0.1);
      const interval = setInterval(() => {
        if (!audioCtxRef.current || !alarmOscRef.current) return;
        const time = audioCtxRef.current.currentTime;
        alarmOscRef.current.frequency.setValueAtTime(880, time);
        alarmOscRef.current.frequency.exponentialRampToValueAtTime(440, time + 0.4);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      alarmGainRef.current.gain.setTargetAtTime(0, now, 0.2);
    }
  }, [status]);

  // Core Synthesis logic for Profiles
  useEffect(() => {
    if (!audioCtxRef.current || !noiseFilterRef.current || !noiseGainRef.current || oscBankRef.current.length < 3 || !droneGainRef.current) return;
    
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const filter = noiseFilterRef.current;
    const nGain = noiseGainRef.current;
    const bank = oscBankRef.current;
    const dGain = droneGainRef.current;

    // Default transitions
    filter.Q.setTargetAtTime(1, now, 0.5);
    nGain.gain.setTargetAtTime(0.5, now, 0.5);
    dGain.gain.setTargetAtTime(0.2, now, 0.5);

    let profileInterval: any = null;

    switch (profile) {
      case 'Natural': // Wind soundscape
        filter.type = 'lowpass';
        filter.frequency.setTargetAtTime(400, now, 0.5);
        nGain.gain.setTargetAtTime(0.6, now, 0.5);
        
        bank[0].type = 'sine'; bank[0].frequency.setTargetAtTime(120, now, 0.5);
        bank[1].type = 'sine'; bank[1].frequency.setTargetAtTime(180, now, 0.5);
        bank[2].type = 'sine'; bank[2].frequency.setTargetAtTime(60, now, 0.5);

        profileInterval = setInterval(() => {
          const t = ctx.currentTime;
          filter.frequency.exponentialRampToValueAtTime(200 + Math.random() * 800, t + 1.5);
        }, 2000);
        break;

      case 'Industrial': // Machinery hums
        filter.type = 'bandpass';
        filter.frequency.setTargetAtTime(200, now, 0.5);
        filter.Q.setTargetAtTime(8, now, 0.5);
        nGain.gain.setTargetAtTime(0.3, now, 0.5);

        bank[0].type = 'square'; bank[0].frequency.setTargetAtTime(50, now, 0.5);
        bank[1].type = 'triangle'; bank[1].frequency.setTargetAtTime(100, now, 0.5);
        bank[2].type = 'sine'; bank[2].frequency.setTargetAtTime(150, now, 0.5);
        
        profileInterval = setInterval(() => {
          const t = ctx.currentTime;
          dGain.gain.setValueAtTime(0.15, t);
          dGain.gain.linearRampToValueAtTime(0.25, t + 0.1);
          dGain.gain.linearRampToValueAtTime(0.15, t + 0.5);
        }, 1000); // Periodic mechanical pulse
        break;

      case 'Void': // Sub-bass and silence
        filter.type = 'lowpass';
        filter.frequency.setTargetAtTime(60, now, 0.5);
        nGain.gain.setTargetAtTime(0.1, now, 0.5);

        bank[0].type = 'sine'; bank[0].frequency.setTargetAtTime(32, now, 0.5);
        bank[1].type = 'sine'; bank[1].frequency.setTargetAtTime(48, now, 0.5);
        bank[2].type = 'sine'; bank[2].frequency.setTargetAtTime(24, now, 0.5);
        break;

      case 'Electronic': // Digital static and glitches
        filter.type = 'highpass';
        filter.frequency.setTargetAtTime(3000, now, 0.5);
        nGain.gain.setTargetAtTime(0.4, now, 0.5);

        bank[0].type = 'sawtooth'; bank[0].frequency.setTargetAtTime(440, now, 0.5);
        bank[1].type = 'square'; bank[1].frequency.setTargetAtTime(880, now, 0.5);
        bank[2].type = 'sine'; bank[2].frequency.setTargetAtTime(1760, now, 0.5);

        profileInterval = setInterval(() => {
          const t = ctx.currentTime;
          const targetOsc = bank[Math.floor(Math.random() * 3)];
          const originalFreq = targetOsc.frequency.value;
          targetOsc.frequency.setValueAtTime(100 + Math.random() * 5000, t);
          targetOsc.frequency.setValueAtTime(originalFreq, t + 0.05);
        }, 600);
        break;

      case 'Hostile': // Unsettling distorted sounds
        filter.type = 'notch';
        filter.frequency.setTargetAtTime(1000, now, 0.5);
        filter.Q.setTargetAtTime(4, now, 0.5);
        nGain.gain.setTargetAtTime(0.8, now, 0.5);

        bank[0].type = 'sawtooth'; bank[0].frequency.setTargetAtTime(40, now, 0.5);
        bank[1].type = 'sawtooth'; bank[1].frequency.setTargetAtTime(43, now, 0.5);
        bank[2].type = 'square'; bank[2].frequency.setTargetAtTime(21, now, 0.5);

        profileInterval = setInterval(() => {
          const t = ctx.currentTime;
          bank.forEach(osc => {
            const current = osc.frequency.value;
            osc.frequency.setTargetAtTime(current + (Math.random() - 0.5) * 20, t, 0.05);
          });
        }, 50);
        break;
    }

    return () => {
      if (profileInterval) clearInterval(profileInterval);
    };
  }, [profile]);

  return null;
};

export default AudioManager;