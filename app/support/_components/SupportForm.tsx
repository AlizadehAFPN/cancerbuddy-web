"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Textarea } from "@/components/ui";
import {
  CATEGORY_LABELS,
  MESSAGE_MAX,
  SUBJECT_MAX,
  SUPPORT_CATEGORIES,
  type SupportCategory,
  type SupportTicketResult,
} from "@/lib/support/types";
import {
  supportFormSchema,
  type SupportFormValues,
} from "@/lib/support/validation";
import { defaultSupportService } from "@/lib/support/service";
import { t } from "@/lib/i18n";

/* ── Inline icons ── */

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function SupportForm() {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SupportFormValues>({
    resolver: zodResolver(supportFormSchema),
    mode: "onTouched",
    defaultValues: {
      subject: "",
      category: "general",
      message: "",
      email: "",
    },
  });

  const [sendError, setSendError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SupportTicketResult | null>(null);

  const category = watch("category");
  const message = watch("message") ?? "";

  async function onSubmit(values: SupportFormValues) {
    setSubmitting(true);
    setSendError(null);
    try {
      const ticket = await defaultSupportService.submitTicket({
        ...values,
        subject: values.subject.trim(),
        message: values.message.trim(),
        email: values.email.trim().toLowerCase(),
      });
      setResult(ticket);
    } catch (err) {
      // Surface the failure. The previous implementation could not fail — it
      // resolved with an invented ticket id no matter what.
      console.error("[support] submit failed:", err);
      setSendError(t("support.form.couldntSend"));
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    reset();
    setSendError(null);
    setResult(null);
  }

  if (result) {
    return (
      <div className="text-center">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cb-success/15 text-cb-success">
          <CheckIcon className="h-7 w-7" />
        </div>
        <h2
          className="font-heading font-bold text-cb-black tracking-tight"
          style={{ fontSize: "clamp(1.6rem, 2.2vw, 2rem)", lineHeight: 1.15 }}
        >
          {t("support.success.heading")}
        </h2>
        <p className="mx-auto mt-2 max-w-[40ch] font-body text-cb-gray-500">
          {t("support.success.sub")}
        </p>
        <div className="mt-6 flex gap-3">
          <Button type="button" variant="secondary" size="lg" fullWidth onClick={startOver}>
            {t("support.success.sendAnother")}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              window.location.href = "/";
            }}
          >
            {t("support.success.backHome")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col">
      <Input
        label={t("support.form.subjectLabel")}
        placeholder={t("support.form.subjectPlaceholder")}
        autoFocus
        maxLength={SUBJECT_MAX}
        error={errors.subject?.message}
        {...register("subject")}
      />

      {/* Category picker */}
      <div className="mb-5">
        <label className="mb-1.5 block font-body text-[13px] font-medium text-cb-gray-700">
          {t("support.form.categoryLabel")}
        </label>
        <div className="flex flex-wrap gap-2">
          {SUPPORT_CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() =>
                  setValue("category", c as SupportCategory, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                aria-pressed={active}
                className={[
                  "inline-flex h-10 items-center rounded-full border-[1.5px] px-4 font-body text-sm transition-all duration-150",
                  active
                    ? "border-cb-black bg-cb-black text-white shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                    : "border-cb-gray-300 bg-white text-cb-gray-700 hover:border-cb-black hover:text-cb-black",
                ].join(" ")}
              >
                {CATEGORY_LABELS[c]}
              </button>
            );
          })}
        </div>
        {errors.category?.message ? (
          <p role="alert" className="mt-1.5 font-body text-[13px] text-cb-danger">
            {errors.category.message}
          </p>
        ) : null}
      </div>

      <Textarea
        label={t("support.form.messageLabel")}
        placeholder={t("support.form.messagePlaceholder")}
        rows={6}
        maxLength={MESSAGE_MAX + 100}
        error={errors.message?.message}
        labelHint={
          <span
            className={message.length > MESSAGE_MAX ? "text-cb-danger" : undefined}
          >
            {t("support.form.messageCounter", { length: message.length, max: MESSAGE_MAX })}
          </span>
        }
        {...register("message")}
      />

      <Input
        label={t("support.form.emailLabel")}
        placeholder={t("support.form.emailPlaceholder")}
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        error={errors.email?.message}
        {...register("email")}
      />

      {sendError ? (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-cb-danger/10 px-4 py-3 font-body text-[13.5px] text-cb-danger"
        >
          {sendError}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={submitting}
      >
        {submitting ? t("support.form.submitting") : t("support.form.submit")}
      </Button>
    </form>
  );
}
