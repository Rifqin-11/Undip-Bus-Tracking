"use client";

import { useEffect, useRef, useState } from "react";

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function useAnimatedNumber(value: number, durationMs = 900) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);

  useEffect(() => {
    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      durationMs <= 0
    ) {
      previousValueRef.current = value;
      const frameId = window.requestAnimationFrame(() => {
        setDisplayValue(value);
      });
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    const startValue = previousValueRef.current;
    const delta = value - startValue;
    const startedAt = performance.now();
    let frameId = 0;

    const animate = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / durationMs);
      const nextValue = startValue + delta * easeOutCubic(progress);
      setDisplayValue(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
        return;
      }

      previousValueRef.current = value;
      setDisplayValue(value);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [durationMs, value]);

  return displayValue;
}

export function AnimatedStatNumber({
  value,
  formatter,
  durationMs,
}: {
  value: number;
  formatter: (value: number) => string;
  durationMs?: number;
}) {
  const animatedValue = useAnimatedNumber(value, durationMs);
  return <>{formatter(animatedValue)}</>;
}
