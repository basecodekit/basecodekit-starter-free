import type { AuthFeatureConfig } from "@/types/config";

export const authConfig: AuthFeatureConfig = {
  emailPassword: true,
  magicLink: true,
  oauth: {
    google: true,
    github: true,
  },
  passkeys: true,
  totpMfa: true,
};
