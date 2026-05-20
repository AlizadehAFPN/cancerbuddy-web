"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { raiseUserLambda } from "@/lib/aws/raiseUserLambda";
import { LambdaPayloadType } from "@/lib/aws/lambdaPayload";

/* ── Icons ─────────────────────────────────────────────────────────────────── */

function LifeBuoyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IdCardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="8" cy="12" r="2" />
      <path d="M13 10h4M13 14h4" />
    </svg>
  );
}

function HelpCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-cb-gray-100"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-cb-black transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function RadioOption({
  groupName,
  label,
  value,
  selected,
  onSelect,
}: {
  groupName: string;
  label: string;
  value: string;
  selected: boolean;
  onSelect: (v: string) => void;
}) {
  const id = `help-radio-${groupName}-${value.replace(/\W+/g, "-")}`;
  return (
    <label
      htmlFor={id}
      className={[
        "flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-4 py-3.5 transition-colors",
        selected
          ? "border-cb-black bg-cb-black/[0.04]"
          : "border-cb-gray-200 hover:border-cb-gray-400",
      ].join(" ")}
    >
      <input
        id={id}
        name={groupName}
        type="radio"
        className="sr-only"
        value={value}
        checked={selected}
        onChange={() => onSelect(value)}
      />
      <span
        className={[
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-cb-black" : "border-cb-gray-400",
        ].join(" ")}
        aria-hidden
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-cb-black" />}
      </span>
      <span className="font-body text-[14px] leading-snug text-cb-black">{label}</span>
    </label>
  );
}

function MenuCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-xl border-[1.5px] border-cb-gray-200 px-4 py-4 text-left transition-colors hover:border-cb-gray-400 hover:bg-cb-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-1"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef0ff]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-body text-[14px] font-semibold text-cb-black">{title}</p>
        <p className="font-body text-[13px] leading-snug text-cb-gray-500">{description}</p>
      </div>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-cb-gray-400" />
    </button>
  );
}

/* ── Types & constants ──────────────────────────────────────────────────────── */

type View = "menu" | "cant-create-account" | "personal-info" | "other";
type Step = 1 | 2;

interface Fields {
  option: string;
  reason: string;
  helpFullName: string;
  helpEmail: string;
  helpOtherProblem: string;
}

interface FieldErrors {
  option?: string;
  reason?: string;
  helpFullName?: string;
  helpEmail?: string;
  helpOtherProblem?: string;
}

const INITIAL_FIELDS: Fields = {
  option: "",
  reason: "",
  helpFullName: "",
  helpEmail: "",
  helpOtherProblem: "",
};

const CANT_CREATE_REASONS = [
  "The app is shutting down",
  "I can’t continue to the next step",
];

const PERSONAL_INFO_REASONS = [
  "I can’t find my Diagnosis, Treatment or Side Effects",
  "I can’t find my Medical Center or Support Organization",
  "I can’t find my Zip Code",
];

const MEDICAL_CENTER_REASON =
  "I can’t find my Medical Center or Support Organization";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DIALOG_TITLE: Record<View, string> = {
  menu: "How can we help?",
  "cant-create-account": "I can’t create an account",
  "personal-info": "Personal information",
  other: "Other problems",
};

const SUBJECT: Record<Exclude<View, "menu">, string> = {
  "cant-create-account": "I can't create an account",
  "personal-info": "Personal information",
  other: "Other",
};

const STEP1_SUB: Record<Exclude<View, "menu" | "other">, string> = {
  "cant-create-account":
    "We can help create your account. We just need some feedback on what’s the issue.",
  "personal-info":
    "Tell us more about what information you can’t find on the provided lists.",
};

const STEP2_SUB =
  "Please provide us your name and email so we can contact and help you.";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

/* ── HelpDialog ──────────────────────────────────────────────────────────────
   Self-contained: renders the trigger button and, when open, a portal with
   the full help dialog. No props required — drop it anywhere in the layout.
   ─────────────────────────────────────────────────────────────────────────── */

export function HelpDialog() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [step, setStep] = useState<Step>(1);
  const [fields, setFields] = useState<Fields>(INITIAL_FIELDS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /* ── Hydration guard ── */
  useEffect(() => setMounted(true), []);

  /* ── Escape + scroll lock ── */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") doClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ── Move focus into dialog on open / view / step change ── */
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const first = dialogRef.current.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }, [open, view, step]);

  /* ── Focus trap ── */
  useEffect(() => {
    if (!open) return;
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const nodes = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onTab);
    return () => document.removeEventListener("keydown", onTab);
  }, [open, view, step]);

  /* ── Handlers ── */

  function doOpen() {
    setOpen(true);
    setView("menu");
    setStep(1);
    setFields(INITIAL_FIELDS);
    setErrors({});
  }

  function doClose() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function updateField(key: keyof Fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function goTo(v: View) {
    setView(v);
    setStep(1);
    setFields(INITIAL_FIELDS);
    setErrors({});
  }

  function goBack() {
    if (step === 2) {
      setErrors({});
      setStep(1);
    } else {
      goTo("menu");
    }
  }

  /* ── Validation ── */

  function validateStep1(): boolean {
    const errs: FieldErrors = {};
    if (!fields.option) {
      errs.option = "Please select an option.";
    } else if (
      view === "personal-info" &&
      fields.option === MEDICAL_CENTER_REASON &&
      !fields.reason.trim()
    ) {
      errs.reason = "Please provide more details.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateContact(): boolean {
    const errs: FieldErrors = {};
    if (!fields.helpFullName.trim()) errs.helpFullName = "Your name is required.";
    if (!fields.helpEmail.trim()) {
      errs.helpEmail = "Your email is required.";
    } else if (!EMAIL_RE.test(fields.helpEmail.trim())) {
      errs.helpEmail = "Please enter a valid email address.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateOther(): boolean {
    const errs: FieldErrors = {};
    if (!fields.helpOtherProblem.trim()) errs.helpOtherProblem = "Please describe the issue.";
    if (!fields.helpFullName.trim()) errs.helpFullName = "Your name is required.";
    if (!fields.helpEmail.trim()) {
      errs.helpEmail = "Your email is required.";
    } else if (!EMAIL_RE.test(fields.helpEmail.trim())) {
      errs.helpEmail = "Please enter a valid email address.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  /* ── Next / Submit ── */

  function handleNext() {
    if (validateStep1()) {
      setErrors({});
      setStep(2);
    }
  }

  async function handleSubmit() {
    if (view === "menu") return;
    const valid = view === "other" ? validateOther() : validateContact();
    if (!valid) return;

    const lambdaFn = process.env.NEXT_PUBLIC_USERS_LAMBDA?.trim();
    if (!lambdaFn) {
      toast.error("Help service is not configured. Please contact support.");
      return;
    }

    setSubmitting(true);
    try {
      const raw = await raiseUserLambda(LambdaPayloadType.SEND_HELP_EMAIL, lambdaFn, {
        email: fields.helpEmail.trim(),
        name: fields.helpFullName.trim(),
        textIfAdded: view === "other" ? fields.helpOtherProblem.trim() : fields.option,
        reason: fields.reason.trim() || " ",
        subject: SUBJECT[view],
      });
      const parsed = raw ? (JSON.parse(raw) as { statusCode?: number }) : {};
      if (parsed.statusCode === 200) {
        doClose();
        toast.success("We are here to help you, we will be in touch soon.");
      } else {
        toast.error("Could not send information, please try again later.");
      }
    } catch {
      toast.error("Could not send information, please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Derived state ── */
  const isTwoStepView = view === "cant-create-account" || view === "personal-info";
  const isStep1 = isTwoStepView && step === 1;
  const progressPct = step === 1 ? 50 : 100;

  /* ── Trigger button ─────────────────────────────────────────────────────── */

  const triggerBtn = (
    <button
      ref={triggerRef}
      type="button"
      onClick={doOpen}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Open help"
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-cb-gray-300 px-3 font-body text-[11px] font-bold uppercase tracking-[0.09em] text-cb-gray-600 transition-colors hover:border-cb-gray-600 hover:text-cb-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black"
    >
      <LifeBuoyIcon className="h-3.5 w-3.5" />
      Help
    </button>
  );

  /* ── Dialog ──────────────────────────────────────────────────────────────── */

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) doClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-[440px] sm:rounded-2xl"
        style={{ maxHeight: "92dvh" }}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center gap-2 border-b border-cb-gray-100 px-4 py-3.5 sm:px-5 sm:py-4">
          {view !== "menu" ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="-ms-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cb-gray-500 transition-colors hover:bg-cb-gray-100 hover:text-cb-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
          ) : (
            <span className="h-8 w-8 shrink-0" aria-hidden />
          )}

          <p
            id={titleId}
            className="min-w-0 flex-1 text-center font-body text-[15px] font-semibold text-cb-black"
          >
            {DIALOG_TITLE[view]}
          </p>

          <button
            type="button"
            onClick={doClose}
            aria-label="Close help"
            className="-me-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cb-gray-500 transition-colors hover:bg-cb-gray-100 hover:text-cb-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-5 sm:px-5">

          {/* Progress bar — only for two-step views */}
          {isTwoStepView && <ProgressBar pct={progressPct} />}

          {/* Sub-heading — everything except menu */}
          {view !== "menu" && (
            <p className="mb-5 font-body text-[14px] text-cb-gray-500">
              {view === "other"
                ? "Please provide us your name and email so we can contact and help you."
                : step === 1
                  ? STEP1_SUB[view]
                  : STEP2_SUB}
            </p>
          )}

          {/* ─── Menu ─── */}
          {view === "menu" && (
            <div className="flex flex-col gap-3 pb-4">
              <MenuCard
                icon={<IdCardIcon className="h-5 w-5 text-[#7986fc]" />}
                title="I can't create an account"
                description="I need help creating my account"
                onClick={() => goTo("cant-create-account")}
              />
              <MenuCard
                icon={<HelpCircleIcon className="h-5 w-5 text-[#7986fc]" />}
                title="Personal information"
                description="I can't find my Zip Code, Diagnosis or Medical Center"
                onClick={() => goTo("personal-info")}
              />
              <MenuCard
                icon={<AlertCircleIcon className="h-5 w-5 text-[#7986fc]" />}
                title="Other"
                description="Describe the problem"
                onClick={() => goTo("other")}
              />
            </div>
          )}

          {/* ─── Step 1: radio selection ─── */}
          {isTwoStepView && step === 1 && (
            <div className="flex flex-col gap-3 pb-2">
              {(view === "cant-create-account"
                ? CANT_CREATE_REASONS
                : PERSONAL_INFO_REASONS
              ).map((reason) => (
                <RadioOption
                  key={reason}
                  groupName={view}
                  label={reason}
                  value={reason}
                  selected={fields.option === reason}
                  onSelect={(v) => updateField("option", v)}
                />
              ))}

              {/* Conditional detail textarea — personal-info / medical center only */}
              {view === "personal-info" && fields.option === MEDICAL_CENTER_REASON && (
                <Textarea
                  label="More details"
                  placeholder="Enter details"
                  hint="(Maximum 1000 characters)"
                  maxLength={1000}
                  rows={3}
                  error={errors.reason}
                  value={fields.reason}
                  onChange={(e) => updateField("reason", e.target.value)}
                  wrapperClassName="mt-1"
                />
              )}

              {errors.option && (
                <p role="alert" className="font-body text-[13px] text-cb-danger">
                  {errors.option}
                </p>
              )}
            </div>
          )}

          {/* ─── Step 2: contact info (shared by both two-step views) ─── */}
          {isTwoStepView && step === 2 && (
            <div className="pb-2">
              <Input
                label="Full name"
                placeholder="What's your name?"
                hint="(First & last name)"
                autoComplete="name"
                maxLength={200}
                error={errors.helpFullName}
                value={fields.helpFullName}
                onChange={(e) => updateField("helpFullName", e.target.value)}
              />
              <Input
                label="Email"
                placeholder="What's your email?"
                hint="Other app users won't see this."
                type="email"
                autoComplete="email"
                error={errors.helpEmail}
                value={fields.helpEmail}
                onChange={(e) => updateField("helpEmail", e.target.value)}
              />
            </div>
          )}

          {/* ─── Other: issue + contact on one screen ─── */}
          {view === "other" && (
            <div className="pb-2">
              <Textarea
                label="Describe the issue"
                placeholder="Describe issue"
                hint="(Maximum 1000 characters)"
                maxLength={1000}
                rows={4}
                error={errors.helpOtherProblem}
                value={fields.helpOtherProblem}
                onChange={(e) => updateField("helpOtherProblem", e.target.value)}
              />
              <Input
                label="Full name"
                placeholder="What's your name?"
                hint="(First & last name)"
                autoComplete="name"
                maxLength={200}
                error={errors.helpFullName}
                value={fields.helpFullName}
                onChange={(e) => updateField("helpFullName", e.target.value)}
              />
              <Input
                label="Email"
                placeholder="What's your email?"
                hint="Other app users won't see this."
                type="email"
                autoComplete="email"
                error={errors.helpEmail}
                value={fields.helpEmail}
                onChange={(e) => updateField("helpEmail", e.target.value)}
              />
            </div>
          )}
        </div>

        {/* ── Footer: action button ── */}
        {view !== "menu" && (
          <div className="shrink-0 border-t border-cb-gray-100 px-4 pb-6 pt-4 sm:px-5 sm:pb-5">
            <button
              type="button"
              onClick={isStep1 ? handleNext : handleSubmit}
              disabled={submitting}
              className="h-12 w-full rounded-xl bg-cb-black font-body text-[15px] font-semibold text-white transition-colors hover:bg-cb-gray-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-black focus-visible:ring-offset-2"
            >
              {isStep1 ? "Next" : submitting ? "Sending…" : "Submit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {triggerBtn}
      {mounted && open && createPortal(dialog, document.body)}
    </>
  );
}
