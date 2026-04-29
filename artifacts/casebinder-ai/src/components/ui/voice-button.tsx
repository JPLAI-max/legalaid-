import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  lang?: string;
}

export function VoiceButton({ onTranscript, className, lang }: VoiceButtonProps) {
  const { isListening, isSupported, interimText, toggle } = useVoiceDictation(onTranscript, { lang });

  if (!isSupported) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggle}
            aria-label={isListening ? "Stop recording" : "Speak into this field"}
            className={cn(
              "inline-flex items-center justify-center rounded-md transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "h-7 w-7 shrink-0",
              isListening
                ? "text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 ring-1 ring-red-300 animate-pulse"
                : "text-muted-foreground hover:text-primary hover:bg-muted",
              className
            )}
          >
            {isListening ? (
              <MicOff className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isListening
            ? interimText
              ? `"${interimText}"`
              : "Listening… click to stop."
            : "Speak into this field."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
