import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Button } from '@app/components/Button/Button';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { useSendSplitRequest, useSplitBusy } from '@app/hooks/useSplitRequest';
import { RequestSplit } from './RequestSplit';

// The screen's own rules are under test; the sending is the hook's (tested beside it).
jest.mock('@app/hooks/useSplitRequest', () => ({
  useSplitBusy: jest.fn(),
  useSendSplitRequest: jest.fn(),
}));

// Spec 0047 (AC-1): the rider picks 2 to 4 boxes and a size for each, and sends.
describe('RequestSplit screen (spec 0047, AC-1)', () => {
  const navigation: any = { goBack: jest.fn() };
  const props: any = {
    navigation,
    route: { params: { order: { id: 'del-split-1' } } },
  };
  const send = jest.fn();

  const sendButton = () => screen.UNSAFE_getByType(Button);
  const selected = (testID: string) =>
    screen.getByTestId(testID).props.accessibilityState?.selected;

  beforeEach(() => {
    // Fake timers, as the sister screen's test: a pressed button animates on a timer.
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useSplitBusy as jest.Mock).mockReturnValue(false);
    (useSendSplitRequest as jest.Mock).mockReturnValue({ send });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('starts with 2 boxes, none with a size, and Send off', () => {
    render(<RequestSplit {...props} />);

    expect(selected('split-count-2')).toBe(true);
    expect(screen.getByText('Box 1 (yours)')).toBeTruthy();
    expect(screen.getByText('Box 2')).toBeTruthy();
    expect(screen.queryByText('Box 3')).toBeNull();
    for (const size of ['SMALL', 'MEDIUM', 'LARGE']) {
      expect(selected(`split-box-1-${size}`)).toBe(false);
      expect(selected(`split-box-2-${size}`)).toBe(false);
    }
    expect(sendButton().props.disabled).toBe(true);
  });

  it('offers 2, 3 or 4 boxes, never 1 and never 5', () => {
    render(<RequestSplit {...props} />);

    for (const count of [2, 3, 4]) {
      expect(screen.getByTestId(`split-count-${count}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('split-count-1')).toBeNull();
    expect(screen.queryByTestId('split-count-5')).toBeNull();
  });

  it('offers Small, Medium and Large for each box', () => {
    render(<RequestSplit {...props} />);
    for (const size of ['SMALL', 'MEDIUM', 'LARGE']) {
      expect(screen.getByTestId(`split-box-1-${size}`)).toBeTruthy();
      expect(screen.getByTestId(`split-box-2-${size}`)).toBeTruthy();
    }
    expect(screen.getAllByText('Small')).toHaveLength(2);
    expect(screen.getAllByText('Medium')).toHaveLength(2);
    expect(screen.getAllByText('Large')).toHaveLength(2);
  });

  it('Send stays off until every box has a size, and pressing it early sends nothing', () => {
    render(<RequestSplit {...props} />);

    fireEvent.press(screen.getByTestId('split-box-1-LARGE'));
    expect(sendButton().props.disabled).toBe(true);
    fireEvent.press(screen.getByText(i18n.t('translations:split_send')));
    expect(send).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('split-box-2-SMALL'));
    expect(sendButton().props.disabled).toBe(false);
  });

  it('sends the boxes in order, box 1 first, for this order, and goes back only once it was sent', () => {
    render(<RequestSplit {...props} />);

    fireEvent.press(screen.getByTestId('split-box-1-LARGE'));
    fireEvent.press(screen.getByTestId('split-box-2-SMALL'));
    fireEvent.press(screen.getByText(i18n.t('translations:split_send')));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      {
        orderId: 'del-split-1',
        legs: [{ boxSize: 'LARGE' }, { boxSize: 'SMALL' }],
      },
      expect.any(Function),
    );
    // A refusal keeps the screen open: going back is the "sent" callback's job.
    expect(navigation.goBack).not.toHaveBeenCalled();
    const onSent = send.mock.calls[0][1];
    onSent();
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('choosing another size for a box replaces the first choice', () => {
    render(<RequestSplit {...props} />);

    fireEvent.press(screen.getByTestId('split-box-1-LARGE'));
    fireEvent.press(screen.getByTestId('split-box-1-MEDIUM'));
    fireEvent.press(screen.getByTestId('split-box-2-SMALL'));

    expect(selected('split-box-1-LARGE')).toBe(false);
    expect(selected('split-box-1-MEDIUM')).toBe(true);
    fireEvent.press(screen.getByText(i18n.t('translations:split_send')));
    expect(send.mock.calls[0][0].legs).toEqual([
      { boxSize: 'MEDIUM' },
      { boxSize: 'SMALL' },
    ]);
  });

  it('going to 3 boxes keeps the sizes picked and turns Send off until box 3 has one', () => {
    render(<RequestSplit {...props} />);
    fireEvent.press(screen.getByTestId('split-box-1-LARGE'));
    fireEvent.press(screen.getByTestId('split-box-2-SMALL'));

    fireEvent.press(screen.getByTestId('split-count-3'));

    expect(screen.getByText('Box 3')).toBeTruthy();
    expect(selected('split-box-1-LARGE')).toBe(true);
    expect(selected('split-box-2-SMALL')).toBe(true);
    expect(sendButton().props.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('split-box-3-MEDIUM'));
    fireEvent.press(screen.getByText(i18n.t('translations:split_send')));
    expect(send.mock.calls[0][0].legs).toEqual([
      { boxSize: 'LARGE' },
      { boxSize: 'SMALL' },
      { boxSize: 'MEDIUM' },
    ]);
  });

  it('4 boxes sends four legs; going back down to 2 sends only the first two', () => {
    render(<RequestSplit {...props} />);
    fireEvent.press(screen.getByTestId('split-count-4'));
    expect(screen.getByText('Box 4')).toBeTruthy();
    for (const box of [1, 2, 3, 4]) {
      fireEvent.press(screen.getByTestId(`split-box-${box}-SMALL`));
    }
    fireEvent.press(screen.getByText(i18n.t('translations:split_send')));
    expect(send.mock.calls[0][0].legs).toHaveLength(4);

    fireEvent.press(screen.getByTestId('split-count-2'));
    expect(screen.queryByText('Box 3')).toBeNull();
    fireEvent.press(screen.getByText(i18n.t('translations:split_send')));
    expect(send.mock.calls[1][0].legs).toEqual([
      { boxSize: 'SMALL' },
      { boxSize: 'SMALL' },
    ]);
  });

  it('while a send is on its way, Send is off and shows it is working', () => {
    (useSplitBusy as jest.Mock).mockReturnValue(true);
    render(<RequestSplit {...props} />);

    expect(useSplitBusy).toHaveBeenCalledWith('del-split-1');
    expect(sendButton().props.disabled).toBe(true);
    expect(sendButton().props.isLoading).toBe(true);
    // The boxes cannot be changed under a request that is already on its way.
    fireEvent.press(screen.getByTestId('split-count-3'));
    expect(screen.queryByText('Box 3')).toBeNull();
  });

  it('tells the rider what happens: they keep box 1 and are paid while they wait', () => {
    render(<RequestSplit {...props} />);
    const intro = i18n.t('translations:split_intro');
    expect(screen.getByText(intro)).toBeTruthy();
    expect(intro).toContain('you take box 1');
    expect(intro).toContain('paid while you wait');
  });

  it('the back button leaves without sending', () => {
    render(<RequestSplit {...props} />);

    fireEvent.press(screen.UNSAFE_getByType(BackNavButton));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  // Row 11 (spec 0047, OR.10): "Send to dispatch" sits above Android's navigation bar
  describe('safe area insets on Android (row 11, OR.10)', () => {
    const originalOS = Platform.OS;

    afterEach(() => {
      Platform.OS = originalOS;
    });

    it('pads the bottom with the safe area inset on Android so Send is above the navigation bar', () => {
      Platform.OS = 'android';
      (useSafeAreaInsets as jest.Mock).mockReturnValue({
        top: 24,
        bottom: 48,
        left: 0,
        right: 0,
      });

      render(<RequestSplit {...props} />);
      const safeArea = screen.UNSAFE_getByType(ScreenSafeArea);
      const flattened = StyleSheet.flatten(safeArea.props.style);
      expect(flattened.paddingBottom).toBe(48);
    });

    it('does not pad the bottom on iOS (ScreenSafeArea pads it via edges)', () => {
      Platform.OS = 'ios';
      (useSafeAreaInsets as jest.Mock).mockReturnValue({
        top: 44,
        bottom: 34,
        left: 0,
        right: 0,
      });

      render(<RequestSplit {...props} />);
      const safeArea = screen.UNSAFE_getByType(ScreenSafeArea);
      const flattened = StyleSheet.flatten(safeArea.props.style);
      expect(flattened.paddingBottom).toBe(0);
    });
  });
});
