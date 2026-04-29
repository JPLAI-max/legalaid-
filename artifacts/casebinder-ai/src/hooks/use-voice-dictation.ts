import { useState, useRef, useCallback, useEffect } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

function getSpeechRecognitionConstructor(): AnyRecognition | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseVoiceDictationOptions {
  lang?: string;
}

export interface UseVoiceDictationReturn {
  isListening: boolean;
  isSupported: boolean;
  interimText: string;
  toggle: () => void;
  stop: () => void;
}

export function useVoiceDictation(
  onTranscript: (text: string) => void,
  options: UseVoiceDictationOptions = {}
): UseVoiceDictationReturn {
  const { lang = "en-US" } = options;
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<AnyRecognition>(null);

  useEffect(() => {
    setIsSupported(!!getSpeechRecognitionConstructor());
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
  }, []);

  const startListening = useCallback(() => {
    const SR = getSpeechRecognitionConstructor();
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimText("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterimText("");
      recognitionRef.current = null;
    };

    recognition.onresult = (event: AnyRecognition) => {
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      setInterimText(interim);

      if (finalText) {
        onTranscript(finalText.trim());
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [lang, onTranscript]);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      startListening();
    }
  }, [isListening, startListening, stop]);

  return { isListening, isSupported, interimText, toggle, stop };
}
