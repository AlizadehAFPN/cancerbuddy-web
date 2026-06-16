import { MessageSquareText } from "lucide-react";
import { t } from "@/lib/i18n";

/** Right-pane placeholder shown on desktop when no conversation is open. */
export default function ChatEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cb-gray-100 text-cb-gray-400">
        <MessageSquareText className="h-8 w-8" />
      </span>
      <p className="font-heading text-lg font-semibold text-cb-black">
        {t("app.chat.selectPrompt")}
      </p>
      <p className="max-w-xs font-body text-sm text-cb-gray-500">
        {t("app.chat.selectPromptSub")}
      </p>
    </div>
  );
}
