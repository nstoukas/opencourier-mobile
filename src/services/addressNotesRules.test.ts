import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ADDRESS_NOTES_RULES_SEEN_KEY,
  clearAddressNotesRulesSeen,
  hasSeenAddressNotesRules,
  markAddressNotesRulesSeen,
} from './addressNotesRules';

// Spec 0053 (AC-8):
// Tracks whether the rider on this phone has seen the address notes rules,
// so the notice opens automatically only the first time they add a note.
// Cleared at logout and session expiry so subsequent riders see it.
describe('addressNotesRules service (spec 0053, AC-8)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('returns false when rules have not been seen yet', async () => {
    const seen = await hasSeenAddressNotesRules();
    expect(seen).toBe(false);
  });

  it('returns true after markAddressNotesRulesSeen is called', async () => {
    await markAddressNotesRulesSeen();
    const stored = await AsyncStorage.getItem(ADDRESS_NOTES_RULES_SEEN_KEY);
    expect(stored).toBe('true');

    const seen = await hasSeenAddressNotesRules();
    expect(seen).toBe(true);
  });

  it('returns false again after clearAddressNotesRulesSeen is called', async () => {
    await markAddressNotesRulesSeen();
    expect(await hasSeenAddressNotesRules()).toBe(true);

    await clearAddressNotesRulesSeen();
    const stored = await AsyncStorage.getItem(ADDRESS_NOTES_RULES_SEEN_KEY);
    expect(stored).toBeNull();

    expect(await hasSeenAddressNotesRules()).toBe(false);
  });

  it('returns false gracefully when storage read throws', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('Storage unreadable'));

    const seen = await hasSeenAddressNotesRules();
    expect(seen).toBe(false);

    spy.mockRestore();
  });
});
