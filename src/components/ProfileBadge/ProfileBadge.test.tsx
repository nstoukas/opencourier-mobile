import React from 'react';
import { StyleSheet } from 'react-native';
import { render, act } from '@testing-library/react-native';
import i18n from '@app/localization/i18n';
import { ProfileBadge, StatusWord } from './ProfileBadge';
import { UserStatus } from '@app/types/types';
import { Colors } from '@app/styles/colors';
import { color } from '@app/styles/theme';

describe('ProfileBadge (spec 0018, AC-14)', () => {
  it('shows Online for UserStatus.Online and never the raw value', () => {
    const { getByText, queryByText } = render(
      <ProfileBadge userStatus={UserStatus.Online} onPress={jest.fn()} />,
    );

    expect(getByText('Online')).toBeTruthy();
    expect(queryByText('online')).toBeNull();
  });

  it('shows Offline for UserStatus.Offline and never the raw value', () => {
    const { getByText, queryByText } = render(
      <ProfileBadge userStatus={UserStatus.Offline} onPress={jest.fn()} />,
    );

    expect(getByText('Offline')).toBeTruthy();
    expect(queryByText('offline')).toBeNull();
  });

  it('shows Last Call for UserStatus.LastCall and never the raw value', () => {
    const { getByText, queryByText } = render(
      <ProfileBadge userStatus={UserStatus.LastCall} onPress={jest.fn()} />,
    );

    expect(getByText('Last Call')).toBeTruthy();
    expect(queryByText('last_call')).toBeNull();
    expect(queryByText('last_call_tag')).toBeNull();
  });
});

describe('StatusWord (Clause 2: centered status word under frame)', () => {
  it('renders Last Call in ink (warning-foreground) on a yellow tag', () => {
    const { getByTestId, getByText } = render(
      <StatusWord userStatus={UserStatus.LastCall} />,
    );
    const container = getByTestId('status-word');
    expect(StyleSheet.flatten(container.props.style).backgroundColor).toBe(
      Colors.yellow1,
    );

    const text = getByText('Last Call');
    const flatStyle = StyleSheet.flatten(text.props.style);
    expect(flatStyle.color).toBe(color['warning-foreground']);
    expect(flatStyle.textAlign).toBe('center');
    expect(text.props.numberOfLines).toBe(2);
  });

  it('renders Online in white on a green tag', () => {
    const { getByTestId, getByText } = render(
      <StatusWord userStatus={UserStatus.Online} />,
    );
    const container = getByTestId('status-word');
    expect(StyleSheet.flatten(container.props.style).backgroundColor).toBe(
      Colors.green1,
    );

    const text = getByText('Online');
    const flatStyle = StyleSheet.flatten(text.props.style);
    expect(flatStyle.color).toBe(Colors.white);
    expect(flatStyle.textAlign).toBe('center');
  });

  it('renders Offline in white on a red tag', () => {
    const { getByTestId, getByText } = render(
      <StatusWord userStatus={UserStatus.Offline} />,
    );
    const container = getByTestId('status-word');
    expect(StyleSheet.flatten(container.props.style).backgroundColor).toBe(
      Colors.red1,
    );

    const text = getByText('Offline');
    const flatStyle = StyleSheet.flatten(text.props.style);
    expect(flatStyle.color).toBe(Colors.white);
    expect(flatStyle.textAlign).toBe('center');
  });
});

describe('ProfileBadge with hideStatusWord (Clause 2)', () => {
  it('hides StatusWord when hideStatusWord is true', () => {
    const { queryByTestId, queryByText } = render(
      <ProfileBadge
        userStatus={UserStatus.Online}
        onPress={jest.fn()}
        hideStatusWord={true}
      />,
    );

    expect(queryByTestId('status-word')).toBeNull();
    expect(queryByText('Online')).toBeNull();
  });
});

describe('ProfileBadge accessibility (row 134 review)', () => {
  it('sets accessibilityRole="button" and accessibilityLabel="Menu, Online" for UserStatus.Online', () => {
    const { getByRole, getByLabelText } = render(
      <ProfileBadge userStatus={UserStatus.Online} onPress={jest.fn()} />,
    );
    const button = getByRole('button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Menu, Online');
    expect(getByLabelText('Menu, Online')).toBeTruthy();
  });

  it('sets accessibilityRole="button" and accessibilityLabel="Menu, Last Call" for UserStatus.LastCall', () => {
    const { getByRole, getByLabelText } = render(
      <ProfileBadge userStatus={UserStatus.LastCall} onPress={jest.fn()} />,
    );
    const button = getByRole('button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Menu, Last Call');
    expect(getByLabelText('Menu, Last Call')).toBeTruthy();
  });

  it('sets accessibilityRole="button" and accessibilityLabel="Menu, Offline" for UserStatus.Offline', () => {
    const { getByRole, getByLabelText } = render(
      <ProfileBadge userStatus={UserStatus.Offline} onPress={jest.fn()} />,
    );
    const button = getByRole('button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Menu, Offline');
    expect(getByLabelText('Menu, Offline')).toBeTruthy();
  });

  it('preserves button role and accessibilityLabel when hideStatusWord is true', () => {
    const { getByRole, getByLabelText } = render(
      <ProfileBadge
        userStatus={UserStatus.Online}
        onPress={jest.fn()}
        hideStatusWord={true}
      />,
    );
    const button = getByRole('button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Menu, Online');
    expect(getByLabelText('Menu, Online')).toBeTruthy();
  });

  it('translates accessibilityLabel to Greek ("Μενού, {{status}}") when language is el', async () => {
    await act(async () => {
      await i18n.changeLanguage('el');
    });
    try {
      const { getByRole, getByLabelText, unmount } = render(
        <ProfileBadge userStatus={UserStatus.Online} onPress={jest.fn()} />,
      );
      const button = getByRole('button');
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe('Μενού, Σε σύνδεση');
      expect(getByLabelText('Μενού, Σε σύνδεση')).toBeTruthy();
      unmount();
    } finally {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
    }
  });
});

describe('Last call status tag word (row 134 follow-up, 23 Nov operator decision)', () => {
  // Pin 1: StatusWord for UserStatus.LastCall shows "Τελευταία" in el and "Last Call" in en.
  it('StatusWord for UserStatus.LastCall shows "Τελευταία" with the language set to el and "Last Call" in en', async () => {
    // In Greek (el): uses short tag word last_call_tag ("Τελευταία"), never the full phrase ("Τελευταία παραγγελία")
    await act(async () => {
      await i18n.changeLanguage('el');
    });
    try {
      const { getByText, queryByText, unmount } = render(
        <StatusWord userStatus={UserStatus.LastCall} />,
      );
      expect(getByText('Τελευταία')).toBeTruthy();
      expect(queryByText('Τελευταία παραγγελία')).toBeNull();
      expect(queryByText('last_call')).toBeNull();
      expect(queryByText('last_call_tag')).toBeNull();
      unmount();
    } finally {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
    }

    // In English (en): shows "Last Call"
    const { getByText, queryByText } = render(
      <StatusWord userStatus={UserStatus.LastCall} />,
    );
    expect(getByText('Last Call')).toBeTruthy();
    expect(queryByText('last_call')).toBeNull();
    expect(queryByText('last_call_tag')).toBeNull();
  });

  // Pin 2: Online and Offline words are unchanged in both languages.
  it('keeps Online and Offline words unchanged in Greek and English', async () => {
    // In Greek (el): Online is "Σε σύνδεση", Offline is "Εκτός σύνδεσης"
    await act(async () => {
      await i18n.changeLanguage('el');
    });
    try {
      const { getByText: getOnlineEl, queryByText: queryOnlineEl, unmount: unmountOnline } = render(
        <StatusWord userStatus={UserStatus.Online} />,
      );
      expect(getOnlineEl('Σε σύνδεση')).toBeTruthy();
      expect(queryOnlineEl('online')).toBeNull();
      unmountOnline();

      const { getByText: getOfflineEl, queryByText: queryOfflineEl, unmount: unmountOffline } = render(
        <StatusWord userStatus={UserStatus.Offline} />,
      );
      expect(getOfflineEl('Εκτός σύνδεσης')).toBeTruthy();
      expect(queryOfflineEl('offline')).toBeNull();
      unmountOffline();
    } finally {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
    }

    // In English (en): Online is "Online", Offline is "Offline"
    const { getByText: getOnlineEn, queryByText: queryOnlineEn } = render(
      <StatusWord userStatus={UserStatus.Online} />,
    );
    expect(getOnlineEn('Online')).toBeTruthy();
    expect(queryOnlineEn('online')).toBeNull();

    const { getByText: getOfflineEn, queryByText: queryOfflineEn } = render(
      <StatusWord userStatus={UserStatus.Offline} />,
    );
    expect(getOfflineEn('Offline')).toBeTruthy();
    expect(queryOfflineEn('offline')).toBeNull();
  });

  // Pin 3: The badge's accessibilityLabel still uses the full Last call words.
  it("badge's accessibilityLabel still uses the full Last call words in Greek and English", async () => {
    // In Greek (el): screen reader hears "Μενού, Τελευταία παραγγελία", never the short tag "Μενού, Τελευταία"
    await act(async () => {
      await i18n.changeLanguage('el');
    });
    try {
      const { getByRole, getByLabelText, queryByLabelText, unmount } = render(
        <ProfileBadge userStatus={UserStatus.LastCall} onPress={jest.fn()} />,
      );
      const button = getByRole('button');
      expect(button.props.accessibilityLabel).toBe('Μενού, Τελευταία παραγγελία');
      expect(getByLabelText('Μενού, Τελευταία παραγγελία')).toBeTruthy();
      expect(queryByLabelText('Μενού, Τελευταία')).toBeNull();
      unmount();

      // When hideStatusWord is true (as on Home header)
      const { getByRole: getByRoleHidden, unmount: unmountHidden } = render(
        <ProfileBadge
          userStatus={UserStatus.LastCall}
          onPress={jest.fn()}
          hideStatusWord={true}
        />,
      );
      expect(getByRoleHidden('button').props.accessibilityLabel).toBe(
        'Μενού, Τελευταία παραγγελία',
      );
      unmountHidden();
    } finally {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
    }

    // In English (en): screen reader hears "Menu, Last Call"
    const { getByRole, getByLabelText } = render(
      <ProfileBadge userStatus={UserStatus.LastCall} onPress={jest.fn()} />,
    );
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Menu, Last Call');
    expect(getByLabelText('Menu, Last Call')).toBeTruthy();
  });

  // Edge / integration case: ProfileBadge displays the short tag word visually but keeps full words in accessibilityLabel
  it('renders short tag word visually ("Τελευταία") while retaining full phrase in accessibilityLabel in Greek', async () => {
    await act(async () => {
      await i18n.changeLanguage('el');
    });
    try {
      // ProfileBadge with default hideStatusWord=false renders both the button and child StatusWord
      const { getByRole, getByText, queryByText, unmount } = render(
        <ProfileBadge userStatus={UserStatus.LastCall} onPress={jest.fn()} />,
      );
      const button = getByRole('button');

      // Visual tag word inside the badge
      expect(getByText('Τελευταία')).toBeTruthy();
      expect(queryByText('Τελευταία παραγγελία')).toBeNull();

      // Accessibility label on the button
      expect(button.props.accessibilityLabel).toBe('Μενού, Τελευταία παραγγελία');
      unmount();
    } finally {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
    }
  });

  // Edge case: missing or undefined userStatus falls back to plain menu label
  it('falls back to plain Menu label when userStatus is undefined and hideStatusWord is true', async () => {
    const { getByRole: getByRoleEn } = render(
      <ProfileBadge
        userStatus={undefined as any}
        onPress={jest.fn()}
        hideStatusWord={true}
      />,
    );
    expect(getByRoleEn('button').props.accessibilityLabel).toBe('Menu');

    await act(async () => {
      await i18n.changeLanguage('el');
    });
    try {
      const { getByRole: getByRoleEl, unmount } = render(
        <ProfileBadge
          userStatus={undefined as any}
          onPress={jest.fn()}
          hideStatusWord={true}
        />,
      );
      expect(getByRoleEl('button').props.accessibilityLabel).toBe('Μενού');
      unmount();
    } finally {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
    }
  });
});
