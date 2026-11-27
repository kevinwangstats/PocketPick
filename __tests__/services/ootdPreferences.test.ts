import {
  getOotdPreferences,
  updateOotdPreferences,
  DEFAULT_OOTD_PREFERENCES,
} from '@/services/settings/ootdPreferences';
import { mockSecureStore } from '../mocks/secure-store.mock';

describe('OOTD Preferences Service (TDD)', () => {
  beforeEach(() => {
    mockSecureStore._reset();
  });

  it('returns default preferences when unset', async () => {
    const prefs = await getOotdPreferences();
    expect(prefs).toEqual(DEFAULT_OOTD_PREFERENCES);
    expect(prefs.unveilModeDefault).toBe(true);
    expect(prefs.cooldownDays).toBe(3);
  });

  it('persists partial preference updates cleanly', async () => {
    await updateOotdPreferences({ unveilModeDefault: false, cooldownDays: 7 });
    const updated = await getOotdPreferences();
    expect(updated.unveilModeDefault).toBe(false);
    expect(updated.cooldownDays).toBe(7);
    expect(updated.autoLearnMemory).toBe(true);
  });
});
