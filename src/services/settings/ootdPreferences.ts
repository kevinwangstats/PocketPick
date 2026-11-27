import * as SecureStore from 'expo-secure-store';

export const OOTD_PREFS_STORAGE_KEY = 'POCKETPICK_OOTD_PREFERENCES_V1';

export type CooldownDaysOption = 0 | 3 | 7;

export interface OotdPreferences {
  unveilModeDefault: boolean;
  cooldownDays: CooldownDaysOption;
  autoLearnMemory: boolean;
  autoClassifyPhotos: boolean;
}

export const DEFAULT_OOTD_PREFERENCES: OotdPreferences = {
  unveilModeDefault: true,
  cooldownDays: 3,
  autoLearnMemory: true,
  autoClassifyPhotos: true,
};

export async function getOotdPreferences(): Promise<OotdPreferences> {
  try {
    const raw = await SecureStore.getItemAsync(OOTD_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_OOTD_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<OotdPreferences>;
    const cooldown: CooldownDaysOption =
      parsed.cooldownDays === 0 || parsed.cooldownDays === 3 || parsed.cooldownDays === 7
        ? parsed.cooldownDays
        : DEFAULT_OOTD_PREFERENCES.cooldownDays;

    return {
      unveilModeDefault:
        typeof parsed.unveilModeDefault === 'boolean'
          ? parsed.unveilModeDefault
          : DEFAULT_OOTD_PREFERENCES.unveilModeDefault,
      cooldownDays: cooldown,
      autoLearnMemory:
        typeof parsed.autoLearnMemory === 'boolean'
          ? parsed.autoLearnMemory
          : DEFAULT_OOTD_PREFERENCES.autoLearnMemory,
      autoClassifyPhotos:
        typeof parsed.autoClassifyPhotos === 'boolean'
          ? parsed.autoClassifyPhotos
          : DEFAULT_OOTD_PREFERENCES.autoClassifyPhotos,
    };
  } catch {
    return DEFAULT_OOTD_PREFERENCES;
  }
}

export async function updateOotdPreferences(
  patch: Partial<OotdPreferences>,
): Promise<OotdPreferences> {
  const current = await getOotdPreferences();
  const next: OotdPreferences = {
    ...current,
    ...patch,
  };
  await SecureStore.setItemAsync(OOTD_PREFS_STORAGE_KEY, JSON.stringify(next));
  return next;
}
