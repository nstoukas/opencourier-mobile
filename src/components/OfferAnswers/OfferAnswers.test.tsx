import React from 'react';
import fs from 'fs';
import path from 'path';
import { StyleSheet } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import en from '@app/localization/en/translations';
import el from '@app/localization/el/translations';
import { OfferAnswers, ACCEPT_HOLD_MS, DECLINE_HOLD_MS } from './OfferAnswers';
import { Order } from '@app/types/types';
import { HoldButton } from '../HoldButton/HoldButton';
import { BUTTON_WIDTH } from '../ButtonSwipe/ButtonSwipe';
import { color, control, space } from '@app/styles/theme';

describe('OfferAnswers (row 135, Clauses 1, 2, 5, 7)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const dummyOrder: Order = {
    id: 'offer-ans-1',
    currencyCode: 'EUR',
    deliveryFee: 500,
  } as unknown as Order;

  describe('Clause 1: Layout, colors, labels, icons, flex and height', () => {
    it('shows Decline on left (red, 100 tall, flex 1) and Accept on right (green, 100 tall, flex 2)', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const { getByTestId, UNSAFE_getAllByType } = render(
        <OfferAnswers
          order={dummyOrder}
          acceptLabel="Accept"
          acceptHint="Hold to take this order"
          onAccept={onAccept}
          onDecline={onDecline}
        />,
      );

      // Row container has BUTTON_WIDTH, flexDirection 'row', and gap
      const answersContainer = getByTestId('offer-answers');
      const rowContainer = answersContainer.props.children;
      const rowStyle = StyleSheet.flatten(rowContainer.props.style);
      expect(rowStyle.flexDirection).toBe('row');
      expect(rowStyle.width).toBe(BUTTON_WIDTH);
      expect(rowStyle.gap).toBe(space['3']);

      // Two HoldButtons in the row
      const holdButtons = UNSAFE_getAllByType(HoldButton);
      expect(holdButtons).toHaveLength(2);

      // First child is Decline (on the left)
      const declineButton = holdButtons[0];
      const declineProps = declineButton.props;
      expect(declineProps.testID).toBe('offer-decline');
      expect(declineProps.tone).toBe('destructive');
      expect(declineProps.label).toBe(i18n.t('translations:decline'));
      const declineStyle = StyleSheet.flatten(declineProps.style);
      expect(declineStyle.flex).toBe(1);
      expect(declineStyle.height).toBe(control.offer);
      expect(declineStyle.height).toBe(100);

      // Second child is Accept (on the right, about two thirds: flex 2)
      const acceptButton = holdButtons[1];
      const acceptProps = acceptButton.props;
      expect(acceptProps.testID).toBe('offer-accept');
      expect(acceptProps.tone).toBe('success');
      expect(acceptProps.label).toBe('Accept');
      const acceptStyle = StyleSheet.flatten(acceptProps.style);
      expect(acceptStyle.flex).toBe(2);
      expect(acceptStyle.height).toBe(control.offer);
      expect(acceptStyle.height).toBe(100);
    });

    it('applies pinned styles with top border and padding when pinned is true, leaves them out when false', () => {
      const { getByTestId, rerender } = render(
        <OfferAnswers
          order={dummyOrder}
          acceptLabel="Accept"
          acceptHint="Hold to take this order"
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          pinned={true}
        />,
      );

      const container = getByTestId('offer-answers');
      let flatStyle = StyleSheet.flatten(container.props.style);
      expect(flatStyle.borderTopWidth).toBe(1);
      expect(flatStyle.borderTopColor).toBe(color.border);
      expect(flatStyle.paddingTop).toBe(space['3']);

      rerender(
        <OfferAnswers
          order={dummyOrder}
          acceptLabel="Accept"
          acceptHint="Hold to take this order"
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          pinned={false}
        />,
      );
      flatStyle = StyleSheet.flatten(container.props.style);
      expect(flatStyle.borderTopWidth).toBeUndefined();
    });
  });

  describe('Clause 2: Hold times are not swapped (Accept = 200 ms, Decline = 1000 ms)', () => {
    it('constants define ACCEPT_HOLD_MS = 200 and DECLINE_HOLD_MS = 1000', () => {
      expect(ACCEPT_HOLD_MS).toBe(200);
      expect(DECLINE_HOLD_MS).toBe(1000);
    });

    it('Accept fires only after 200 ms hold and Decline only after 1000 ms hold', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const { getByTestId } = render(
        <OfferAnswers
          order={dummyOrder}
          acceptLabel="Accept"
          acceptHint="Hold to take this order"
          onAccept={onAccept}
          onDecline={onDecline}
        />,
      );

      const acceptBtn = getByTestId('offer-accept');
      const declineBtn = getByTestId('offer-decline');

      // 1. Accept button:
      fireEvent(acceptBtn, 'pressIn');
      act(() => {
        jest.advanceTimersByTime(190);
      });
      expect(onAccept).not.toHaveBeenCalled();

      // Complete 200 ms hold
      act(() => {
        jest.advanceTimersByTime(10);
      });
      expect(onAccept).toHaveBeenCalledTimes(1);
      expect(onAccept).toHaveBeenCalledWith(dummyOrder);
      fireEvent(acceptBtn, 'pressOut');

      // 2. Decline button: 200 ms does NOT trigger decline
      fireEvent(declineBtn, 'pressIn');
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(onDecline).not.toHaveBeenCalled();

      // 990 ms does not trigger decline
      act(() => {
        jest.advanceTimersByTime(790);
      });
      expect(onDecline).not.toHaveBeenCalled();

      // Complete 1000 ms hold
      act(() => {
        jest.advanceTimersByTime(10);
      });
      expect(onDecline).toHaveBeenCalledTimes(1);
      expect(onDecline).toHaveBeenCalledWith(dummyOrder);
      fireEvent(declineBtn, 'pressOut');
    });

    it('early release cancels hold for both buttons', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const { getByTestId } = render(
        <OfferAnswers
          order={dummyOrder}
          acceptLabel="Accept"
          acceptHint="Hold to take this order"
          onAccept={onAccept}
          onDecline={onDecline}
        />,
      );

      const acceptBtn = getByTestId('offer-accept');
      const declineBtn = getByTestId('offer-decline');

      // Accept early release
      fireEvent(acceptBtn, 'pressIn');
      act(() => {
        jest.advanceTimersByTime(190);
      });
      fireEvent(acceptBtn, 'pressOut');
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(onAccept).not.toHaveBeenCalled();

      // Decline early release
      fireEvent(declineBtn, 'pressIn');
      act(() => {
        jest.advanceTimersByTime(990);
      });
      fireEvent(declineBtn, 'pressOut');
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(onDecline).not.toHaveBeenCalled();
    });
  });

  describe('Clause 5: Screen reader accessibility and activate action', () => {
    it('sets proper accessibilityLabel and accessibilityHint on both buttons', () => {
      const { getByTestId } = render(
        <OfferAnswers
          order={dummyOrder}
          acceptLabel="Accept"
          acceptHint="Hold to take this order"
          onAccept={jest.fn()}
          onDecline={jest.fn()}
        />,
      );

      const declineBtn = getByTestId('offer-decline');
      expect(declineBtn.props.accessibilityLabel).toBe(
        i18n.t('translations:decline'),
      );
      expect(declineBtn.props.accessibilityHint).toBe(
        i18n.t('translations:decline_hold_hint'),
      );

      const acceptBtn = getByTestId('offer-accept');
      expect(acceptBtn.props.accessibilityLabel).toBe('Accept');
      expect(acceptBtn.props.accessibilityHint).toBe('Hold to take this order');
    });

    it('screen reader "activate" action answers at once for Decline and Accept', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const { getByTestId } = render(
        <OfferAnswers
          order={dummyOrder}
          acceptLabel="Accept"
          acceptHint="Hold to take this order"
          onAccept={onAccept}
          onDecline={onDecline}
        />,
      );

      const declineBtn = getByTestId('offer-decline');
      const acceptBtn = getByTestId('offer-accept');

      // TalkBack double tap on Decline
      fireEvent(declineBtn, 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      });
      expect(onDecline).toHaveBeenCalledTimes(1);
      expect(onDecline).toHaveBeenCalledWith(dummyOrder);

      // TalkBack double tap on Accept
      fireEvent(acceptBtn, 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      });
      expect(onAccept).toHaveBeenCalledTimes(1);
      expect(onAccept).toHaveBeenCalledWith(dummyOrder);
    });
  });

  describe('Clause 7: Old ButtonOrder and removed strings are gone', () => {
    it('ButtonOrder file has been deleted', () => {
      const buttonOrderPath = path.resolve(
        __dirname,
        '../ButtonOrder/ButtonOrder.tsx',
      );
      expect(fs.existsSync(buttonOrderPath)).toBe(false);
    });

    it('deleted swipe and instant strings are gone from en and el translations', () => {
      const removedKeys = [
        'accept_now',
        'decline_now',
        'slide_to_accept',
        'stack_offer_slide',
        'add_on_offer_slide',
      ];

      for (const key of removedKeys) {
        expect((en as any)[key]).toBeUndefined();
        expect((el as any)[key]).toBeUndefined();
      }
    });

    it('new hold hint strings are present in both en and el translations', () => {
      const newKeys = [
        'accept_hold_hint',
        'decline_hold_hint',
        'stack_offer_hold_hint',
        'add_on_offer_hold_hint',
      ];

      for (const key of newKeys) {
        expect(typeof (en as any)[key]).toBe('string');
        expect((en as any)[key].trim().length).toBeGreaterThan(0);
        expect(typeof (el as any)[key]).toBe('string');
        expect((el as any)[key].trim().length).toBeGreaterThan(0);
      }
    });
  });
});
