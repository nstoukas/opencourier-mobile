import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import '@app/localization/i18n';
import { OfferAnswers } from './OfferAnswers';
import { Order } from '@app/types/types';
import ButtonSwipe from '../ButtonSwipe/ButtonSwipe';
import { ButtonOrder, ButtonOrderType } from '../ButtonOrder/ButtonOrder';
import { color, control, space } from '@app/styles/theme';

describe('OfferAnswers (Clause 6: single shared offer answers component)', () => {
  const dummyOrder: Order = {
    id: 'offer-ans-1',
    currencyCode: 'EUR',
    deliveryFee: 500,
  } as unknown as Order;

  it('renders ButtonSwipe with control.offer height (100) and given title/subtitle, swiping calls onAccept', () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    const { UNSAFE_getByType } = render(
      <OfferAnswers
        order={dummyOrder}
        acceptTitle="Accept"
        acceptSubtitle="Slide to accept"
        onAccept={onAccept}
        onDecline={onDecline}
      />,
    );

    const swipe = UNSAFE_getByType(ButtonSwipe);
    expect(swipe.props.height).toBe(control.offer);
    expect(swipe.props.title).toBe('Accept');
    expect(swipe.props.subtitle).toBe('Slide to accept');

    // Swiping calls onAccept with order
    act(() => {
      swipe.props.onSwiped(true);
    });
    expect(onAccept).toHaveBeenCalledWith(dummyOrder);
  });

  it('renders ButtonOrder for decline and pressing it calls onDecline with order', () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    const { UNSAFE_getByType } = render(
      <OfferAnswers
        order={dummyOrder}
        acceptTitle="Accept"
        acceptSubtitle="Slide to accept"
        onAccept={onAccept}
        onDecline={onDecline}
      />,
    );

    const declineBtn = UNSAFE_getByType(ButtonOrder);
    expect(declineBtn.props.type).toBe(ButtonOrderType.decline);

    fireEvent.press(declineBtn);
    expect(onDecline).toHaveBeenCalledWith(dummyOrder);
  });

  it('applies pinned styles with top border and padding when pinned is true', () => {
    const { getByTestId, rerender } = render(
      <OfferAnswers
        order={dummyOrder}
        acceptTitle="Accept"
        acceptSubtitle="Slide to accept"
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
        acceptTitle="Accept"
        acceptSubtitle="Slide to accept"
        onAccept={jest.fn()}
        onDecline={jest.fn()}
        pinned={false}
      />,
    );
    flatStyle = StyleSheet.flatten(container.props.style);
    expect(flatStyle.borderTopWidth).toBeUndefined();
  });
});
