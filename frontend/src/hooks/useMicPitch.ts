import { useCallback, useEffect, useRef, useState } from "react";
import { WS_PITCH_URL } from "../api";

export interface MicPitchState {
  hz: number | null;
  voiced: boolean;
}

const CHUNK_SIZE = 4096; // float32 samples per send (~256ms at 16kHz)

export function useMicPitch(active: boolean) {
  const [pitch, setPitch] = useState<MicPitchState>({ hz: null, voiced: false });
  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;

    ctxRef.current?.close();
    ctxRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    wsRef.current?.close();
    wsRef.current = null;

    setPitch({ hz: null, voiced: false });
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const ws = new WebSocket(WS_PITCH_URL);
        wsRef.current = ws;

        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data) as MicPitchState;
            setPitch(data);
          } catch {
            // ignore malformed frames
          }
        };

        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => resolve();
          ws.onerror = () => reject(new Error("WebSocket failed to open"));
        });

        if (cancelled) {
          ws.close();
          return;
        }

        const ctx = new AudioContext({ sampleRate: 16000 });
        ctxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(CHUNK_SIZE, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (ev) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const inputData = ev.inputBuffer.getChannelData(0);
          const pcmBytes = new Uint8Array(inputData.buffer.slice(0));
          ws.send(pcmBytes);
        };

        source.connect(processor);
        processor.connect(ctx.destination);
      } catch (err) {
        console.error("useMicPitch error:", err);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, stop]);

  return pitch;
}
