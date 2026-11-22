import AsyncStorage from '@react-native-async-storage/async-storage';

// Spec 0053 (AC-8): whether the rider on this phone has seen the address notes rules, so the notice
// opens by itself only the first time they add a note. Kept on the phone only, and cleared at
// logout and when a session ends, so the next rider on a shared phone sees it too.
export const ADDRESS_NOTES_RULES_SEEN_KEY = 'address_notes_rules_seen';

export async function hasSeenAddressNotesRules(): Promise<boolean> {
  try {
    return (
      (await AsyncStorage.getItem(ADDRESS_NOTES_RULES_SEEN_KEY)) === 'true'
    );
  } catch {
    // Unreadable storage shows the notice again, the safe side.
    return false;
  }
}

export async function markAddressNotesRulesSeen(): Promise<void> {
  await AsyncStorage.setItem(ADDRESS_NOTES_RULES_SEEN_KEY, 'true');
}

export async function clearAddressNotesRulesSeen(): Promise<void> {
  await AsyncStorage.removeItem(ADDRESS_NOTES_RULES_SEEN_KEY);
}
