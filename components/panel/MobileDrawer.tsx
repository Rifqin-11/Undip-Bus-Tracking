"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  animate,
  type PanInfo,
} from "motion/react";
import { XIcon } from "@/components/ui/Icons";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

type SnapPoint = "half" | "full";

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

const CARD_MARGIN_X = 12; // px each side in half mode
const CARD_HEIGHT = 300;  // px – fixed card height in half mode

/** Spring config – snappy but not bouncy */
const SPRING = { type: "spring", stiffness: 440, damping: 40, mass: 0.85 } as const;
/**
 * Close spring – overdamped (damping > 2*sqrt(stiffness)) so height
 * never overshoots below 0, which would cause a backdrop-filter flash.
 */
const CLOSE_SPRING = { type: "spring", stiffness: 360, damping: 52 } as const;

/**
 * Sensitivity thresholds – intentionally LOW so even slow drags register.
 * Velocity: px/s  |  Distance: px
 */
const VEL = 120;  // px/s  (was 300)
const DIST = 20;  // px    (was 50)

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MobileDrawer({ open, onClose, children }: MobileDrawerProps) {
  const [snap, setSnap] = useState<SnapPoint>("half");

  /**
   * HEIGHT MotionValue – drives card height for all states.
   * Closing: shrinks 300→0 while bottom stays pinned at navbar.
   * Never uses translateY so the card never slides below the navbar.
   */
  const cardHeight = useMotionValue(CARD_HEIGHT);

  /**
   * OPACITY MotionValue – fades card to 0 during close so that
   * the `backdrop-filter: blur()` effect also fades out cleanly
   * and does not leave a ghosted blur layer as height → 0.
   */
  const cardOpacity = useMotionValue(1);

  /**
   * Full-mode height in px.
   * Extra 28px extends the card below the viewport so the rounded bottom
   * corners are hidden by the screen edge — giving a true edge-to-edge look
   * while the borderRadius stays constant (no jarring corner animation).
   */
  const fullHeightPx = () =>
    typeof window !== "undefined" ? window.innerHeight * 0.85 + 28 : 728;

  // ── Sync open prop ↔ animate in / out ────────────────────────────────────────
  useEffect(() => {
    if (open) {
      // ── Animate IN: grow card from bottom up, restore opacity ────────────────
      setSnap("half");
      cardHeight.set(0);
      cardOpacity.set(1);
      animate(cardHeight, CARD_HEIGHT, SPRING);
    } else {
      // ── Animate OUT: collapse to 0 in floating-card shape ───────────────
      // Force half shape first so we never see the full edge-to-edge sheet
      // during the close animation regardless of which snap was active.
      setSnap("half");
      animate(cardOpacity, 0, { duration: 0.16, ease: "easeOut" });
      animate(cardHeight, 0, CLOSE_SPRING);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll lock ─────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = open && snap === "full" ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, snap]);

  // ── Navigation helpers ───────────────────────────────────────────────────
  const goToFull = useCallback(() => {
    setSnap("full");
    animate(cardHeight, fullHeightPx(), SPRING);
  }, [cardHeight]);

  const goToHalf = useCallback(() => {
    setSnap("half");
    animate(cardHeight, CARD_HEIGHT, SPRING);
  }, [cardHeight]);

  /**
   * Immediately signals parent to close (open → false).
   * The actual collapse animation is handled by the useEffect([open]) else-branch.
   * This avoids the race condition where .then() would fire after the user had
   * already re-opened, causing a double-tap requirement.
   */
  const goToClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // ── Resolve gesture decision ─────────────────────────────────────────────
  const resolveHalf = useCallback(
    (dy: number, vy: number) => {
      if (dy < -DIST || vy < -VEL) {
        goToFull();
      } else if (dy > DIST || vy > VEL) {
        goToClose();
      } else {
        // Rubber-band back
        animate(cardHeight, CARD_HEIGHT, SPRING);
      }
    },
    [cardHeight, goToFull, goToClose],
  );

  const resolveFull = useCallback(
    (dy: number, vy: number) => {
      if (dy > DIST || vy > VEL) {
        goToHalf();
      } else {
        animate(cardHeight, fullHeightPx(), SPRING);
      }
    },
    [cardHeight, goToHalf],
  );

  // ── Handle-area pan gestures ─────────────────────────────────────────────
  const onHandlePan = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      if (snap === "half") {
        /** Drag down = shrink height; drag up = grow (capped at CARD_HEIGHT for half) */
        const next = Math.max(0, Math.min(CARD_HEIGHT, CARD_HEIGHT - info.offset.y));
        cardHeight.set(next);
      } else {
        /** In full mode also shrink from top (same visual as sliding down) */
        const next = Math.max(
          0,
          Math.min(fullHeightPx(), fullHeightPx() - info.offset.y),
        );
        cardHeight.set(next);
      }
    },
    [snap, cardHeight],
  );

  const onHandlePanEnd = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;
      if (snap === "half") resolveHalf(offset.y, velocity.y);
      else resolveFull(offset.y, velocity.y);
    },
    [snap, resolveHalf, resolveFull],
  );

  // ── Content-area pan gestures (half mode only) ───────────────────────────
  const onContentPan = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      if (snap !== "half") return;
      const next = Math.max(0, Math.min(CARD_HEIGHT, CARD_HEIGHT - info.offset.y));
      cardHeight.set(next);
    },
    [snap, cardHeight],
  );

  const onContentPanEnd = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      if (snap !== "half") return;
      resolveHalf(info.offset.y, info.velocity.y);
    },
    [snap, resolveHalf],
  );

  /** Wheel / trackpad in half mode */
  const onContentWheel = useCallback(
    (e: React.WheelEvent) => {
      if (snap !== "half") return;
      if (e.deltaY < -20) goToFull();
      else if (e.deltaY > 20) goToClose();
    },
    [snap, goToFull, goToClose],
  );

  // ── Shape styles per snap ────────────────────────────────────────────────
  const isHalf = snap === "half";
  const shapeAnimate = isHalf
    ? {
        bottom: "calc(1rem + var(--sai-bottom, 0px))",
        left: `${CARD_MARGIN_X}px`,
        right: `${CARD_MARGIN_X}px`,
        /**
         * borderRadius stays CONSTANT at "28px" for BOTH states.
         * This prevents the jarring bottom-corner animation during half → full.
         * In full mode, the +28px height extension hides the rounded bottom
         * corners below the viewport → edge-to-edge appearance.
         */
        borderRadius: "28px",
        boxShadow: "0 8px 40px rgba(15,23,42,0.22)",
      }
    : {
        bottom: "-28px", // extend 28px below viewport to hide rounded bottom corners
        left: "0px",
        right: "0px",
        borderRadius: "28px", // same as half → NO corner animation!
        boxShadow: "0 -16px 50px rgba(15,23,42,0.14)",
      };

  const showBackdrop = open && snap === "full";

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────── */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] xl:hidden"
        animate={{ opacity: showBackdrop ? 1 : 0, pointerEvents: showBackdrop ? "auto" : "none" }}
        transition={{ duration: 0.22 }}
        onClick={goToHalf}
        aria-hidden="true"
      />

      {/* ── Card / Drawer ─────────────────────────────────────────────── */}
      <motion.div
        style={{
          /**
           * HEIGHT is driven entirely by `cardHeight` MotionValue.
           * OPACITY is driven by `cardOpacity` (fades on close).
           * Bottom stays pinned to navbar → drawer never slides below it.
           */
          height: cardHeight,
          opacity: cardOpacity,
          // Frosted glass
          backdropFilter: "blur(20px) saturate(1.8)",
          WebkitBackdropFilter: "blur(20px) saturate(1.8)",
          backgroundColor: "rgba(255,255,255,0.62)",
          border: isHalf
            ? "1px solid rgba(255,255,255,0.45)"
            : "1px solid rgba(255,255,255,0.40)",
          // Layout + shape animated via `animate` prop (spring)
          position: "fixed",
          overflow: "hidden",
        }}
        animate={shapeAnimate}
        transition={SPRING}
        className="z-[80] flex flex-col xl:hidden"
      >
        {/* ── Drag handle ──────────────────────────────────────────────── */}
        <motion.div
          onPan={onHandlePan}
          onPanEnd={onHandlePanEnd}
          onTap={() => { if (snap === "half") goToFull(); }}
          className="flex shrink-0 touch-none select-none flex-col cursor-grab active:cursor-grabbing"
          aria-label="Seret atau ketuk untuk membuka panel"
        >
          {/* Pill indicator */}
          <div className="flex justify-center pb-2 pt-3">
            <div className="h-1 w-10 rounded-full bg-slate-400/50" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3">
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Smart Mobility UNDIP
              </p>
              <h2 className="text-[20px] font-bold leading-tight text-slate-900">
                Buggy Monitoring
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                Live
              </span>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  goToClose();
                }}
                className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition active:bg-slate-100"
                aria-label="Tutup panel"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Scrollable content ────────────────────────────────────────── */}
        <motion.div
          onPan={onContentPan}
          onPanEnd={onContentPanEnd}
          onWheel={onContentWheel}
          className="flex-1 overscroll-contain px-4 pb-6"
          style={{
            overflow: snap === "half" ? "hidden" : "auto",
            touchAction: snap === "half" ? "none" : "pan-y",
          }}
        >
          {children}
        </motion.div>
      </motion.div>
    </>
  );
}
