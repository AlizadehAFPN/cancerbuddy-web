/**
 * Types for the signed-in user's own profile.
 *
 * Field names are the AppSync ones (`userPronounId`, `desabilities`, and the
 * rest, misspellings included) rather than tidied-up local names. The profile
 * screens read and write these directly, and renaming them here would mean a
 * translation layer in every save path for no gain.
 */

/** Mirror of `cancerbuddyapp/src/model/user/user.tsx`. */
export const UserType = {
  PATIENT: "PATIENT",
  CAREGIVER: "CAREGIVER",
  SURVIVOR: "SURVIVOR",
  HOST: "HOST",
  SUPPORT: "SUPPORT",
  /** @deprecated Ambassadorship is the boolean `ambassador` field. */
  AMBASSADOR: "AMBASSADOR",
} as const;

export type UserTypeValue = (typeof UserType)[keyof typeof UserType];

export interface NamedRef {
  id?: string;
  name?: string | null;
}

export interface ConnectionOf<T> {
  items?: T[];
}

/**
 * The shape returned by `getAvatarInformation` — the hub's single query.
 * Everything the completion rings and the avatar header need, and nothing else.
 */
export interface ProfileUser {
  id?: string;
  name?: string | null;
  birth?: string | null;
  bio?: string | null;
  zipcode?: string | null;
  userType?: string | null;
  ambassador?: boolean | null;
  buddyId?: string | null;

  /* Foreign keys — presence is what the progress rings score. */
  userCityId?: string | null;
  userStateId?: string | null;
  userWorkplaceId?: string | null;
  userPronounId?: string | null;
  userEthnicitiesId?: string | null;
  userTransgenderId?: string | null;
  userSexualOrientationId?: string | null;
  userTreatmentStatusId?: string | null;
  userRelationshipId?: string | null;
  userProfilePicId?: string | null;
  userCollegeId?: string | null;
  userCopingwithcancerlossId?: string | null;
  CurrentlyInCollege?: boolean | null;
  cancerloss?: boolean | null;

  /** Caregiver-only: the person they care for. */
  patientBirth?: string | null;
  patientName?: string | null;

  /** Survivor-only. */
  inRemissionSince?: string | null;

  profilePicUrl?: string;
  goal?: NamedRef | null;
  city?: { name?: string | null } | null;
  state?: { name?: string | null; stateAbbreviation?: string | null } | null;
  pronoun?: { name?: string | null } | null;
  ethnicities?: { name?: string | null } | null;
  sexualOrientation?: NamedRef | null;
  transgender?: NamedRef | null;

  diagnosis?: ConnectionOf<{ id: string }> | null;
  treatments?: ConnectionOf<{ id: string }> | null;
  hospitals?: ConnectionOf<{ id: string }> | null;
  interests?: ConnectionOf<{ id: string }> | null;
  languages?: ConnectionOf<{ id: string; language?: NamedRef | null }> | null;
  supportOrganizations?: ConnectionOf<{
    supportOrganizations?: { name?: string | null } | null;
  }> | null;
  desabilities?: ConnectionOf<{
    disabilities?: { name?: string | null } | null;
  }> | null;
}

export interface GalleryPicture {
  id: string;
  url?: string;
  createdAt?: string | null;
}

/**
 * Which hub sections a user type can reach.
 *
 * Ported from the conditionals in `HomeProfile.tsx`. Two are worth calling out
 * because they read as surprises:
 *
 *  • A CAREGIVER has **no** medical section of their own — their "Medical" card
 *    sits under "my patient's info" and opens the same screen (`:150`, `:242`).
 *  • The Languages card is commented out in mobile for everyone (`:190-202`),
 *    so it is not offered here either.
 */
export interface ProfileSections {
  manageLives: boolean;
  ownMedical: boolean;
  patientInfo: boolean;
}

export function sectionsFor(userType: string | null | undefined): ProfileSections {
  return {
    manageLives: userType === UserType.HOST,
    ownMedical: userType !== UserType.CAREGIVER,
    patientInfo: userType === UserType.CAREGIVER,
  };
}

/**
 * Mobile never mounts the Profile tab for a SUPPORT account
 * (`navigation/tabs/TabsNavigator.tsx`), so the web hides the nav entry and
 * redirects the route rather than rendering a profile they were never meant to
 * manage.
 */
export function canAccessProfile(userType: string | null | undefined): boolean {
  return userType !== UserType.SUPPORT;
}
