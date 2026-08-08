import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ageSuffix } from "@/lib/buddies/age";
import { formatLocation } from "@/lib/buddies/display";
import { identityFactsFor } from "./identityFacts";
import {
  MAX_SUPPORT_ORGANIZATIONS,
  applyTreatmentStatus,
  validateRemissionAgainstBirth,
} from "./medicalInfo";
import { formatTimestamp } from "./manageLives";
import {
  FAVORITES_SECTION,
  groupAdsByOrganization,
} from "@/lib/contentful/partnerSections";
import { sortFunders } from "@/lib/contentful/server";
import type { ContentfulAd } from "@/lib/contentful/types";

function sourceOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const helpers = { ageSuffix, formatLocation };

function birthFor(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(0, 1);
  return `${d.getFullYear()}-01-01`;
}

/* ── profile-hub-identity-facts ─────────────────────────────────────────── */

describe("the hub identity line", () => {
  it("prints age, location and pronouns in mobile's order", () => {
    expect(
      identityFactsFor(
        {
          birth: birthFor(34),
          userType: "PATIENT",
          city: { name: "Austin" },
          state: { stateAbbreviation: "TX" },
          pronoun: { name: "She/her" },
        },
        helpers,
      ),
    ).toEqual(["34", "Austin, TX", "She/her"]);
  });

  it("never prints an undisclosed pronoun", () => {
    const facts = identityFactsFor(
      {
        birth: birthFor(40),
        userType: "PATIENT",
        pronoun: { name: "I rather not disclose" },
      },
      helpers,
    );
    expect(facts).not.toContain("I rather not disclose");
    expect(facts).toEqual(["40"]);
  });

  it("omits what is missing rather than leaving a gap", () => {
    expect(identityFactsFor({ userType: "PATIENT" }, helpers)).toEqual([]);
    expect(identityFactsFor(null, helpers)).toEqual([]);
  });

  /** Staff accounts have no age on mobile, and `ageSuffix` already knows that. */
  it("shows no age for a host or support account", () => {
    expect(
      identityFactsFor({ birth: birthFor(40), userType: "HOST" }, helpers),
    ).toEqual([]);
  });
});

/* ── profile-medical-form-data-rules ────────────────────────────────────── */

describe("the medical form's data rules", () => {
  const statuses = [
    { value: "pre", label: "Pre-treatment" },
    { value: "in", label: "In treatment" },
  ];

  it("clears treatments when the status is cleared", () => {
    expect(applyTreatmentStatus({ treatmentIds: ["t1", "t2"] }, "", statuses)).toEqual({
      treatmentStatusId: "",
      treatmentIds: [],
    });
  });

  it("clears them for Pre-treatment, and keeps them otherwise", () => {
    expect(
      applyTreatmentStatus({ treatmentIds: ["t1"] }, "pre", statuses).treatmentIds,
    ).toEqual([]);
    expect(
      applyTreatmentStatus({ treatmentIds: ["t1"] }, "in", statuses).treatmentIds,
    ).toEqual(["t1"]);
  });

  it("rejects a remission date from before the member was born", () => {
    expect(validateRemissionAgainstBirth("1990-05-31", "03/1985")).toBe(
      "remissionBeforeBirth",
    );
    expect(validateRemissionAgainstBirth("1990-05-31", "03/2020")).toBeNull();
  });

  it("leaves incomplete or unparseable pairs to the format validator", () => {
    expect(validateRemissionAgainstBirth(null, "03/2020")).toBeNull();
    expect(validateRemissionAgainstBirth("1990-05-31", "")).toBeNull();
    expect(validateRemissionAgainstBirth("1990-05-31", "13/xx")).toBeNull();
  });

  it("caps support organisations at three, as mobile's picker does", () => {
    expect(MAX_SUPPORT_ORGANIZATIONS).toBe(3);
    const form = sourceOf("components/profile/MedicalInfoForm.tsx");
    expect(form).toMatch(/maxItems=\{MAX_SUPPORT_ORGANIZATIONS\}/);
    // Hiding Add is not a cap on its own — the picker sheet must refuse too.
    expect(sourceOf("components/ui/form.tsx")).toMatch(
      /if \(!removing && maxItems !== undefined && ids\.length >= maxItems\) return;/,
    );
  });
});

/* ── profile-field-help-text ────────────────────────────────────────────── */

describe("field help text", () => {
  it("explains the four medical catalogue fields", () => {
    const form = sourceOf("components/profile/MedicalInfoForm.tsx");
    for (const key of [
      "hintDiagnosis",
      "hintMedicalCenter",
      "hintSupportOrganization",
      "hintSideEffects",
    ]) {
      expect(form, key).toMatch(new RegExp(`app\\.profile\\.${key}`));
    }
  });

  it("explains workplace and college on the personal form", () => {
    const form = sourceOf("components/profile/PersonalInfoForm.tsx");
    expect(form).toMatch(/app\.profile\.hintWorkplace/);
    expect(form).toMatch(/app\.profile\.hintCollege/);
  });

  /**
   * The date-of-birth explainer during signup was covered by nothing else —
   * both steps ask for a birth date and neither said why.
   */
  it("answers 'why do we ask this' wherever a birth date is asked for", () => {
    for (const path of [
      "components/profile/PatientInfoForm.tsx",
      "app/register/_components/StepProfile.tsx",
      "app/register/_components/StepCGPatientAge.tsx",
    ]) {
      expect(sourceOf(path), path).toMatch(/<WhyWeAsk>/);
      expect(sourceOf(path), path).toMatch(/app\.profile\.whyWeAskAge/);
    }
  });
});

/* ── medical-info-help-flow ─────────────────────────────────────────────── */

describe("the medical help flow", () => {
  const dialog = sourceOf("components/auth/HelpDialog.tsx");

  it("adds a view rather than a second help component", () => {
    expect(dialog).toMatch(/\| "medical-info"/);
    expect(dialog).toMatch(/"medical-info": "Medical Information"/);
    // The subject record is keyed by view, so a new view without copy fails to
    // compile — that exhaustiveness is the guard, asserted here as intent.
    expect(dialog).toMatch(/const SUBJECT: Record<Exclude<View, "menu">, string>/);
  });

  it("offers mobile's two options and requires details for the second", () => {
    expect(dialog).toMatch(/MEDICAL_INFO_REASONS/);
    expect(dialog).toMatch(
      /\(view === "personal-info" \|\| view === "medical-info"\) &&\s*fields\.option === MEDICAL_CENTER_REASON/,
    );
  });

  it("sends the signed-in member's own address instead of asking", () => {
    expect(dialog).toMatch(/\(signedInEmail \?\? fields\.helpEmail\)\.trim\(\)/);
    expect(sourceOf("components/profile/MedicalInfoForm.tsx")).toMatch(
      /view="medical-info"/,
    );
  });
});

/* ── profile-avatar-crop ────────────────────────────────────────────────── */

describe("the avatar", () => {
  it("goes through the cropper before it uploads", () => {
    const hub = sourceOf("components/profile/ProfileHub.tsx");
    expect(hub).toMatch(/<PhotoCropper/);
    expect(hub).toMatch(/onApply=\{\(cropped\) => void uploadAvatar\(cropped\)\}/);
    // Picking a file now opens the cropper; only the cropper's output uploads.
    expect(hub).toMatch(/const changeAvatar[\s\S]{0,300}setPendingPhoto\(file\)/);
    expect(hub).toMatch(/const uploadAvatar[\s\S]{0,400}setProfilePicture/);
  });
});

/* ── profile-refetch-on-focus ───────────────────────────────────────────── */

describe("returning to the tab", () => {
  it("re-reads the profile and the gallery", () => {
    const provider = sourceOf("lib/profile/ProfileProvider.tsx");
    expect(provider).toMatch(/useVisibilityResync\(/);
    expect(provider).toMatch(/Promise\.all\(\[refresh\(\), refreshGallery\(\)\]\)/);
  });

  it("re-reads the lives list, and a session when its editor opens", () => {
    const screen = sourceOf("components/profile/ManageLivesScreen.tsx");
    expect(screen).toMatch(/useVisibilityResync\(load\)/);
    expect(screen).toMatch(/fetchLiveSession\(session\.id\)/);
  });
});

/* ── profile-live-session-timestamps ────────────────────────────────────── */

describe("live session timestamps", () => {
  it("formats a stored timestamp without a locale-dependent time", () => {
    expect(formatTimestamp("2026-01-04T10:00:00Z")).toMatch(/^4 Jan 2026$/);
    expect(formatTimestamp("2026-02-11T09:00:00Z")).toMatch(/^11 Feb 2026$/);
  });

  it("renders nothing for a missing or unparseable value", () => {
    expect(formatTimestamp(null)).toBe("");
    expect(formatTimestamp("not a date")).toBe("");
  });

  it("shows both dates in the editor", () => {
    const screen = sourceOf("components/profile/ManageLivesScreen.tsx");
    expect(screen).toMatch(/editing\.session\.createdAt/);
    expect(screen).toMatch(/editing\.session\.updatedAt/);
  });
});

/* ── partners-list ──────────────────────────────────────────────────────── */

describe("the partners list", () => {
  const ad = (id: string, organization: string): ContentfulAd => ({
    id,
    title: `Ad ${id}`,
    url: "",
    bgColor: "",
    organization,
    logoUrl: null,
    imageUrl: null,
    description: null,
  });

  const ads = [ad("a", "Acme"), ad("b", "Beta"), ad("c", "Acme")];

  it("groups by organisation in first-appearance order", () => {
    expect(groupAdsByOrganization(ads).map((s) => s.title)).toEqual(["Acme", "Beta"]);
  });

  it("pins a Favorites section first, holding exactly what was starred", () => {
    const sections = groupAdsByOrganization(ads, ["b"]);
    expect(sections[0]!.title).toBe(FAVORITES_SECTION);
    expect(sections[0]!.ads.map((a) => a.id)).toEqual(["b"]);
    expect(sections.slice(1).map((s) => s.title)).toEqual(["Acme"]);
  });

  it("omits Favorites entirely when nothing is starred", () => {
    expect(groupAdsByOrganization(ads).some((s) => s.title === FAVORITES_SECTION)).toBe(
      false,
    );
  });

  it("places every ad exactly once", () => {
    const flat = groupAdsByOrganization(ads, ["a"]).flatMap((s) => s.ads.map((x) => x.id));
    expect(flat.sort()).toEqual(["a", "b", "c"]);
  });

  it("is a real screen, not the placeholder", () => {
    expect(sourceOf("app/(app)/partners/page.tsx")).not.toMatch(/ScreenPlaceholder/);
  });
});

/* ── funders-screen ─────────────────────────────────────────────────────── */

describe("the funders screen", () => {
  it("queries the collection mobile reads", () => {
    const queries = readFileSync("lib/contentful/queries.ts", "utf8");
    expect(queries).toMatch(/fundersCollection/);
    expect(queries).toMatch(/name/);
    expect(queries).toMatch(/description/);
  });

  it("sorts alphabetically, ignoring case", () => {
    expect(
      sortFunders([
        { name: "zeta", description: "" },
        { name: "Alpha", description: "" },
        { name: "beta", description: "" },
      ]).map((f) => f.name),
    ).toEqual(["Alpha", "beta", "zeta"]);
  });

  it("is a real screen, not the placeholder", () => {
    expect(sourceOf("app/(app)/funders/page.tsx")).not.toMatch(/ScreenPlaceholder/);
  });
});

/* ── ads-more-resources-cta ─────────────────────────────────────────────── */

describe("the partner interstitial", () => {
  it("sends the primary action to the partners list", () => {
    const screen = sourceOf("components/buddies/AdScreen.tsx");
    expect(screen).toMatch(/href="\/partners"/);
    expect(screen).toMatch(/app\.partners\.moreResources/);
    // The partner's own site stays reachable, as a secondary control.
    expect(screen).toMatch(/href=\{ad\.url\}/);
  });
});
