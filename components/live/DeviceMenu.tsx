"use client";

/**
 * The little chevron next to the camera and microphone buttons.
 *
 * Opens upward because the control bar sits at the bottom of the room. Closes
 * on Escape, on an outside pointer-down, and on selection. Deliberately not the
 * shared `Sheet`: that one is a modal with a backdrop, and covering the video
 * to pick a microphone is exactly the wrong trade in a call.
 */

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Check, ChevronUp } from "lucide-react";
import type { DeviceOption } from "@/lib/live/types";

export interface DeviceMenuGroup {
  label: string;
  options: DeviceOption[];
  selectedId?: string;
  onSelect: (deviceId: string) => void;
}

export default function DeviceMenu({
  open,
  onOpenChange,
  groups,
  label,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: DeviceMenuGroup[];
  label: string;
  footer?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onOpenChange(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onOpenChange]);

  const hasOptions = groups.some((group) => group.options.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => onOpenChange(!open)}
        className={[
          "flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-white/80",
          "transition-colors hover:bg-white/15 hover:text-white",
          open ? "bg-white/20 text-white" : "bg-cb-live-raised",
        ].join(" ")}
      >
        <ChevronUp size={13} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute bottom-9 left-1/2 z-30 w-72 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-cb-live-surface shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)]"
        >
          {!hasOptions && (
            <p className="px-4 py-4 font-body text-[13px] text-white/55">{label}</p>
          )}

          {groups.map((group) =>
            group.options.length === 0 ? null : (
              <div key={group.label} className="border-b border-white/8 last:border-b-0">
                <p className="px-4 pb-1 pt-3 font-heading text-[10.5px] font-bold uppercase tracking-[0.13em] text-white/40">
                  {group.label}
                </p>
                <ul className="pb-2">
                  {group.options.map((option) => {
                    const selected = option.deviceId === group.selectedId;
                    return (
                      <li key={option.deviceId}>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          onClick={() => {
                            group.onSelect(option.deviceId);
                            onOpenChange(false);
                          }}
                          className={[
                            "flex w-full items-center gap-2.5 px-4 py-2 text-left font-body text-[13.5px] transition-colors",
                            selected ? "text-white" : "text-white/70 hover:text-white",
                            "hover:bg-white/8",
                          ].join(" ")}
                        >
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                            {selected && <Check size={14} className="text-cb-yellow" />}
                          </span>
                          <span className="truncate">{option.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ),
          )}

          {footer}
        </div>
      )}
    </div>
  );
}
