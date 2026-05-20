"use client";

import { Button } from "@/components/ui";
import { t } from "@/lib/i18n";

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

const HIGHLIGHTS = [
  {
    icon: HeartIcon,
    titleKey: "register.intro.highlights.connectTitle",
    bodyKey: "register.intro.highlights.connectBody",
    accent: "bg-cb-yellow text-cb-black",
  },
  {
    icon: ShieldIcon,
    titleKey: "register.intro.highlights.privateTitle",
    bodyKey: "register.intro.highlights.privateBody",
    accent: "bg-cb-purple/50 text-cb-gray-800",
  },
  {
    icon: ClockIcon,
    titleKey: "register.intro.highlights.flexibleTitle",
    bodyKey: "register.intro.highlights.flexibleBody",
    accent: "bg-cb-blue/40 text-cb-gray-800",
  },
] as const;

interface Props {
  onStart: () => void;
}

export function StepIntro({ onStart }: Props) {
  return (
    <div className="w-full">
      <header className="mb-5">
        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-cb-gray-500">
          {t("register.intro.eyebrow")}
        </p>
        <h1
          className="mt-1.5 font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.6rem, 2.3vw, 2rem)", lineHeight: 1.12 }}
        >
          {t("register.intro.heading")}
        </h1>
        <p className="mt-2 max-w-[44ch] font-body text-[14px] leading-relaxed text-cb-gray-600">
          {t("register.intro.body")}
        </p>
      </header>

      <ul className="mb-5 space-y-2">
        {HIGHLIGHTS.map(({ icon: Icon, titleKey, bodyKey, accent }) => (
          <li
            key={titleKey}
            className="flex items-start gap-3 rounded-2xl border border-cb-gray-200/90 bg-white p-3"
          >
            <span
              className={[
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5",
                accent,
              ].join(" ")}
              aria-hidden
            >
              <Icon className="h-[16px] w-[16px]" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-[14px] font-semibold text-cb-black">
                {t(titleKey)}
              </p>
              <p className="mt-0.5 font-body text-[13px] leading-snug text-cb-gray-600">
                {t(bodyKey)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mb-5 text-center font-body text-[12.5px] text-cb-gray-500">
        {t("register.intro.timeNote")}
      </p>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={onStart}
          className="touch-manipulation"
        >
          {t("register.intro.startCta")}
          <ArrowRightIcon />
        </Button>
        <p className="text-center text-[10px] text-cb-gray-300">
          {t("register.intro.version")}
        </p>
      </div>
    </div>
  );
}
