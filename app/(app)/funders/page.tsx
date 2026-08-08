import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { fetchFunders } from "@/lib/contentful/server";

export const metadata: Metadata = { title: t("app.screens.fundersTitle") };

/**
 * `/funders` — who pays for CancerBuddy.
 *
 * A server component: the list is the same for everyone, changes about once a
 * year, and is already cached by `fetchFunders`, so there is nothing to hydrate.
 * An unreachable Contentful yields `[]` rather than an error page — a missing
 * funding credit should not take the route down.
 */
export default async function FundersPage() {
  const funders = await fetchFunders();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="font-heading text-2xl font-bold text-cb-black">
        {t("app.screens.fundersTitle")}
      </h1>
      <p className="mt-1 font-body text-cb-gray-500">
        {t("app.screens.fundersBody")}
      </p>

      {funders.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-cb-gray-200 bg-white p-5 font-body text-[14.5px] text-cb-gray-600">
          {t("app.funders.empty")}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {funders.map((funder) => (
            <li
              key={funder.name}
              data-testid="funder"
              className="rounded-2xl border border-cb-gray-200 bg-white p-5"
            >
              <h2 className="font-heading text-[16px] font-bold text-cb-black">
                {funder.name}
              </h2>
              {funder.description && (
                <p className="mt-1.5 font-body text-[14px] leading-relaxed text-cb-gray-600">
                  {funder.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
