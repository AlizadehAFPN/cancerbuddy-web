"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";

/* ── Layout constants ──────────────────────────────────────────────────
   Centered card modal. The surface auto-sizes via ResizeObserver on its
   container so it scales down on small viewports but stays generous on
   desktop. The crop math reads the actual rendered surface size, so no
   fixed constant can drift out of sync with the layout. */

const SURFACE_MIN = 240;
const SURFACE_MAX = 560;
const CIRCLE_RATIO = 0.82;
const OUTPUT_SIZE = 512;
/** Slider range. `min` is *dynamic* below — for non-square images, it
 *  drops below 1 so the user can zoom out to "contain fit" (the whole
 *  image visible, letterboxed inside the surface). 1 corresponds to
 *  cover fit, 5 to deep zoom. */
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.05;

/** Reserved space (CSS px) around the surface so the card always fits the
 *  viewport without the surface bleeding over the footer. Header + footer
 *  + modal padding all live in this budget. */
const VIEWPORT_RESERVE_H = 232;
const VIEWPORT_RESERVE_W = 48;

/* ── Icons ─────────────────────────────────────────────────────────────── */

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className={className} aria-hidden>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* ── Props ─────────────────────────────────────────────────────────────── */

interface Props {
  source: File;
  onApply: (cropped: File) => void;
  onCancel: () => void;
}

/* ── Component ─────────────────────────────────────────────────────────── */

/**
 * Centered modal photo cropper. The surface is rendered as a CSS
 * background-image, which is structurally constrained to its box — the
 * image cannot overflow regardless of natural dimensions.
 *
 * The whole modal is rendered through a React portal because the shell's
 * fade-up animation applies a `transform`, which creates a CSS containing
 * block for fixed-positioned descendants. The portal mounts directly on
 * `document.body` so `position: fixed` resolves to the real viewport.
 */
export function PhotoCropper({ source, onApply, onCancel }: Props) {
  /* ── Object URL (Strict-Mode safe) ───────────────────────── */
  const [sourceUrl, setSourceUrl] = useState<string>("");
  useEffect(() => {
    const url = URL.createObjectURL(source);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  /* Detached <img> for measurement + canvas export. */
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!sourceUrl) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      imageElementRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = sourceUrl;
  }, [sourceUrl]);

  /* ── Surface size, derived from viewport ──────────────────────
     Direct computation from window dimensions — guarantees the card
     ALWAYS fits the viewport (no flex-1/ResizeObserver feedback gap
     where the surface could keep rendering at 600px while the card
     shrinks underneath, hiding the footer). */
  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1024,
    h: typeof window !== "undefined" ? window.innerHeight : 768,
  }));
  useEffect(() => {
    const update = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const surface = Math.floor(
    clamp(
      Math.min(
        viewport.w - VIEWPORT_RESERVE_W,
        viewport.h - VIEWPORT_RESERVE_H,
        SURFACE_MAX,
      ),
      SURFACE_MIN,
      SURFACE_MAX,
    ),
  );

  const circleDiameter = surface * CIRCLE_RATIO;
  const circleRadius = circleDiameter / 2;
  const cornerInset = (surface - circleDiameter) / 2;

  /* ── Pan + zoom state ───────────────────────────────────── */
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  /* Zoom starts at 0 as a sentinel; an effect below sets it to the
     dynamic min (contain fit) once the image's natural size is known. */
  const [zoom, setZoom] = useState(0);
  const [saving, setSaving] = useState(false);

  /* `baseScale` is the cover-fit ratio (smaller dimension fills surface).
     zoom = 1 ⇒ cover; zoom = minZoom ⇒ contain (whole image visible). */
  const baseScale = natural
    ? Math.max(surface / natural.w, surface / natural.h)
    : 1;
  /** zoom value at which displayScale equals the contain-fit scale —
   *  i.e. the whole image fits in the surface with letterboxing. */
  const minZoom = natural
    ? Math.min(surface / natural.w, surface / natural.h) / baseScale
    : 1;
  /** Effective zoom (zero sentinel falls back to minZoom). */
  const effectiveZoom = zoom > 0 ? zoom : minZoom;
  const displayScale = baseScale * effectiveZoom;
  const displayW = natural ? natural.w * displayScale : surface;
  const displayH = natural ? natural.h * displayScale : surface;
  /* Pan can move the image so that ANY pixel — including the very edges —
     reaches the circle's centre. */
  const maxX = displayW / 2;
  const maxY = displayH / 2;

  /* Once the natural size lands, snap zoom to the contain-fit minimum so
     the user starts by seeing the whole image. Runs exactly once per
     source — the `initialZoomSet` ref guards against re-firing on later
     ResizeObserver-driven `surface` changes. */
  const initialZoomSet = useRef(false);
  useEffect(() => {
    if (natural && !initialZoomSet.current) {
      initialZoomSet.current = true;
      setZoom(minZoom);
    }
  }, [natural, minZoom]);
  const clampedX = clamp(pos.x, -maxX, maxX);
  const clampedY = clamp(pos.y, -maxY, maxY);
  const bgX = surface / 2 + clampedX - displayW / 2;
  const bgY = surface / 2 + clampedY - displayH / 2;

  /* ── Drag-to-pan ───────────────────────────────────────── */
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    pointerId: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!natural) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: clampedX,
        origY: clampedY,
        pointerId: e.pointerId,
      };
      setDragging(true);
    },
    [natural, clampedX, clampedY],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      });
    },
    [],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (dragRef.current?.pointerId === e.pointerId) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* Capture may already be released. */
        }
        dragRef.current = null;
        setDragging(false);
      }
    },
    [],
  );

  /* ── Wheel zoom ────────────────────────────────────────── */
  const handleWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      if (!natural) return;
      const delta = -e.deltaY * 0.0025;
      setZoom((z) => clamp((z > 0 ? z : minZoom) * Math.exp(delta), minZoom, MAX_ZOOM));
    },
    [natural, minZoom],
  );

  /* ── Modal mechanics ───────────────────────────────────── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const handleBackdrop = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onCancel();
    },
    [onCancel],
  );

  /* ── Save ──────────────────────────────────────────────── */
  const handleApply = useCallback(async () => {
    if (!natural || !imageElementRef.current) return;
    setSaving(true);
    try {
      const srcW = surface / displayScale;
      const srcH = srcW;
      const srcX = natural.w / 2 - (surface / 2 + clampedX) / displayScale;
      const srcY = natural.h / 2 - (surface / 2 + clampedY) / displayScale;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setSaving(false);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      ctx.drawImage(
        imageElementRef.current,
        srcX,
        srcY,
        srcW,
        srcH,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
      );
      if (!blob) {
        setSaving(false);
        return;
      }
      const nameNoExt = source.name.replace(/\.[^.]+$/, "");
      const cropped = new File([blob], `${nameNoExt || "photo"}.jpg`, {
        type: "image/jpeg",
      });
      onApply(cropped);
    } finally {
      setSaving(false);
    }
  }, [natural, clampedX, clampedY, displayScale, surface, source.name, onApply]);

  /* ── Portal mount guard ──────────────────────────────────────────
     The shell uses a transform animation, which creates a containing
     block — so a "fixed inset-0" rendered in-tree would clip to the
     form column. The portal mounts on document.body so the modal
     genuinely covers the full viewport. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return null;

  const loading = !natural;
  const corners = [
    [cornerInset, cornerInset, 1, 1],
    [surface - cornerInset, cornerInset, -1, 1],
    [cornerInset, surface - cornerInset, 1, -1],
    [surface - cornerInset, surface - cornerInset, -1, -1],
  ] as const;

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop your photo"
      onClick={handleBackdrop}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm sm:p-6"
      style={{ animation: "hero-fade-in 0.2s ease-out both" }}
    >
      <div
        className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)]"
        style={{
          width: surface,
          animation: "hero-fade-up 0.25s ease-out both",
        }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
          <div>
            <h2 className="font-heading text-[18px] font-bold text-cb-black">
              Position your photo
            </h2>
            <p className="mt-0.5 font-body text-[12.5px] text-cb-gray-500">
              The circle is how your avatar will appear.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-cb-gray-500 transition-colors hover:bg-cb-gray-100 hover:text-cb-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Surface — sized directly from viewport math above, no flex
            wrapper. The card width matches the surface width so there is
            no horizontal gap or chance of overflow. */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className={[
            "relative shrink-0 overflow-hidden",
            dragging ? "cursor-grabbing" : natural ? "cursor-grab" : "cursor-progress",
          ].join(" ")}
          style={{
            width: surface,
            height: surface,
            touchAction: "none",
            backgroundColor: "#1A1A1A",
            backgroundImage:
              natural && sourceUrl ? `url("${sourceUrl}")` : "none",
            backgroundSize: `${displayW}px ${displayH}px`,
            backgroundPosition: `${bgX}px ${bgY}px`,
            backgroundRepeat: "no-repeat",
          }}
        >
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-white/60">
                <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </div>
            ) : null}

            {/* Overlay */}
            <svg
              className="pointer-events-none absolute inset-0"
              width={surface}
              height={surface}
              viewBox={`0 0 ${surface} ${surface}`}
              aria-hidden
            >
              <defs>
                <mask id="pc-mask">
                  <rect width={surface} height={surface} fill="white" />
                  <circle
                    cx={surface / 2}
                    cy={surface / 2}
                    r={circleRadius}
                    fill="black"
                  />
                </mask>
              </defs>

              <rect
                width={surface}
                height={surface}
                fill="rgba(0,0,0,0.55)"
                mask="url(#pc-mask)"
              />

              <circle
                cx={surface / 2}
                cy={surface / 2}
                r={circleRadius}
                fill="none"
                stroke="rgba(255,255,255,0.95)"
                strokeWidth={2}
              />
              <circle
                cx={surface / 2}
                cy={surface / 2}
                r={circleRadius - 1}
                fill="none"
                stroke="rgba(0,0,0,0.18)"
                strokeWidth={1}
              />

              {corners.map(([cx, cy, sx, sy], i) => (
                <g key={i} stroke="rgba(255,255,255,0.9)" strokeWidth={2.5} fill="none" strokeLinecap="round">
                  <line x1={cx} y1={cy} x2={cx + 18 * sx} y2={cy} />
                  <line x1={cx} y1={cy} x2={cx} y2={cy + 18 * sy} />
                </g>
              ))}
            </svg>
        </div>

        {/* Footer — zoom controls + actions packed together so they share
            the same shrink-0 region. Whenever the buttons are reachable,
            the zoom slider is too. */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-cb-gray-100 bg-cb-gray-100/40 px-5 pb-4 pt-3 sm:px-6 sm:pt-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => clamp((z > 0 ? z : minZoom) - ZOOM_STEP * 4, minZoom, MAX_ZOOM))}
              disabled={loading || effectiveZoom <= minZoom + 0.001}
              aria-label="Zoom out"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cb-black text-white shadow-sm transition-colors hover:bg-cb-gray-800 active:bg-cb-gray-700 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2"
            >
              <MinusIcon className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={minZoom}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={effectiveZoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={loading}
              aria-label="Zoom"
              className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-cb-gray-200 accent-cb-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2 disabled:opacity-40"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => clamp((z > 0 ? z : minZoom) + ZOOM_STEP * 4, minZoom, MAX_ZOOM))}
              disabled={loading || effectiveZoom >= MAX_ZOOM - 0.001}
              aria-label="Zoom in"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cb-black text-white shadow-sm transition-colors hover:bg-cb-gray-800 active:bg-cb-gray-700 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleApply}
              loading={saving}
              disabled={loading || saving}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
