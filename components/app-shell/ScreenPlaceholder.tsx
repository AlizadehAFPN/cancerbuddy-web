/**
 * Temporary content for the authenticated tab/section screens. Each real
 * screen (chat, groups list + live calendar, etc.) replaces its placeholder
 * as it's built. The navigation shell around it is already final.
 */
export default function ScreenPlaceholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <h1 className="font-heading text-2xl font-bold text-cb-black">{title}</h1>
      <p className="max-w-sm font-body text-cb-gray-500">{body}</p>
    </div>
  );
}
