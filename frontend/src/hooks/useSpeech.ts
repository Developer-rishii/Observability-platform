import { useState, useEffect, useRef, useCallback } from 'react';

export type SpeechState = 'idle' | 'speaking' | 'paused';

export interface UseSpeechReturn {
  supported: boolean;
  state: SpeechState;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  currentSentenceIndex: number;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
  speak: (sentences: string[]) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function useSpeech(): UseSpeechReturn {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [state, setState] = useState<SpeechState>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);

  const sentencesRef = useRef<string[]>([]);
  const sentenceIndexRef = useRef<number>(-1);
  const isCancelledRef = useRef<boolean>(false);

  // Load and pick default voice
  useEffect(() => {
    if (!supported) return;

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (!available || available.length === 0) return;

      // Filter: strictly English voices only (prevents Hindi or foreign default voices mispronouncing English)
      const englishVoices = available.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en'));
      setVoices(englishVoices.length > 0 ? englishVoices : available);

      setSelectedVoice((prev) => {
        if (prev) return prev;
        // Priority: en-IN -> en-US -> en-GB -> first English voice
        const pool = englishVoices.length > 0 ? englishVoices : available;
        const enIn = pool.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en-in'));
        if (enIn) return enIn;
        const enUs = pool.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en-us'));
        if (enUs) return enUs;
        const enGb = pool.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en-gb'));
        if (enGb) return enGb;
        const anyEn = pool.find((v) => v.lang.toLowerCase().startsWith('en'));
        return anyEn || pool[0];
      });
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    isCancelledRef.current = true;
    window.speechSynthesis.cancel();
    setState('idle');
    setCurrentSentenceIndex(-1);
    sentenceIndexRef.current = -1;
  }, [supported]);

  // Handle unmount & pagehide/navigation
  useEffect(() => {
    if (!supported) return;

    const handleBeforeUnload = () => {
      window.speechSynthesis.cancel();
    };

    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isCancelledRef.current = true;
      window.speechSynthesis.cancel();
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [supported]);

  // Internal helper to speak a sentence at index
  const speakSentenceAtIndex = useCallback(
    (index: number) => {
      if (!supported || isCancelledRef.current) return;
      if (index >= sentencesRef.current.length) {
        setState('idle');
        setCurrentSentenceIndex(-1);
        sentenceIndexRef.current = -1;
        return;
      }

      sentenceIndexRef.current = index;
      setCurrentSentenceIndex(index);

      const utterance = new SpeechSynthesisUtterance(sentencesRef.current[index]);
      utterance.rate = 0.95;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onstart = () => {
        if (isCancelledRef.current) return;
        setState('speaking');
      };

      utterance.onend = () => {
        if (isCancelledRef.current) return;
        speakSentenceAtIndex(index + 1);
      };

      utterance.onerror = (e) => {
        // e.error === 'canceled' happens on stop/reset
        if (e.error !== 'canceled' && !isCancelledRef.current) {
          speakSentenceAtIndex(index + 1);
        }
      };

      window.speechSynthesis.speak(utterance);
    },
    [supported, selectedVoice]
  );

  const speak = useCallback(
    (sentences: string[]) => {
      if (!supported || sentences.length === 0) return;
      stop();
      isCancelledRef.current = false;
      sentencesRef.current = sentences;
      speakSentenceAtIndex(0);
    },
    [supported, stop, speakSentenceAtIndex]
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setState('paused');
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setState('speaking');
  }, [supported]);

  return {
    supported,
    state,
    voices,
    selectedVoice,
    currentSentenceIndex,
    setSelectedVoice,
    speak,
    pause,
    resume,
    stop,
  };
}
