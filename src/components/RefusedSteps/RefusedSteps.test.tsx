import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RefusedSteps } from './RefusedSteps';
import * as jobStepOutbox from '@app/services/jobStepOutbox';
import { resetOutboxForTests, OutboxItem } from '@app/services/jobStepOutbox';
import i18n from '@app/localization/i18n';

describe('RefusedSteps component (spec 0009, AC-6)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    resetOutboxForTests();
    await AsyncStorage.clear();
  });

  const seedOutbox = async (items: OutboxItem[]) => {
    resetOutboxForTests();
    await AsyncStorage.setItem('jobStepOutbox', JSON.stringify(items));
    // Load into memory store
    await jobStepOutbox.waitingCount('__init__');
  };

  it('a card names the restaurant and the translated step label', async () => {
    const item: OutboxItem = {
      id: 'item-1',
      courierId: 'rider-1',
      deliveryId: 'del-101',
      step: 'arrived_at_pickup',
      tappedAt: 1000,
      state: 'refused',
      restaurantName: 'Tasty Gyros',
    };
    await seedOutbox([item]);

    render(<RefusedSteps courierId="rider-1" />);

    const translatedStep = i18n.t('translations:arrived_at_pickup');
    const expectedBody = i18n.t('translations:step_refused_body', {
      restaurant: 'Tasty Gyros',
      step: translatedStep,
    });

    const bodyNode = screen.getByText(expectedBody);
    expect(bodyNode).toBeTruthy();
    let alertContainer = bodyNode.parent;
    while (
      alertContainer &&
      alertContainer.props?.accessibilityRole !== 'alert'
    ) {
      alertContainer = alertContainer.parent;
    }
    expect(alertContainer?.props?.accessibilityRole).toBe('alert');

    expect(
      screen.getByText(i18n.t('translations:step_refused_close')),
    ).toBeTruthy();
  });

  it('several refused items of one delivery give one card (its first refused step)', async () => {
    const items: OutboxItem[] = [
      {
        id: 'step-1',
        courierId: 'rider-1',
        deliveryId: 'del-101',
        step: 'arrived_at_pickup',
        tappedAt: 1000,
        state: 'refused',
        restaurantName: 'Tasty Gyros',
      },
      {
        id: 'step-2',
        courierId: 'rider-1',
        deliveryId: 'del-101',
        step: 'picked_up',
        tappedAt: 2000,
        state: 'refused',
        restaurantName: 'Tasty Gyros',
      },
      {
        id: 'step-3',
        courierId: 'rider-1',
        deliveryId: 'del-101',
        step: 'delivered',
        tappedAt: 3000,
        state: 'refused',
        restaurantName: 'Tasty Gyros',
      },
    ];
    await seedOutbox(items);

    render(<RefusedSteps courierId="rider-1" />);

    // Exactly one refusal card is rendered (one close button)
    const closeButtons = screen.getAllByText(
      i18n.t('translations:step_refused_close'),
    );
    expect(closeButtons).toHaveLength(1);

    // Shows the first refused step label ('Arrived at pickup')
    const firstStepLabel = i18n.t('translations:arrived_at_pickup');
    expect(screen.getByText(new RegExp(firstStepLabel))).toBeTruthy();

    // Does not show the subsequent refused step labels
    const secondStepLabel = i18n.t('translations:confirm_items');
    expect(screen.queryByText(new RegExp(secondStepLabel))).toBeNull();
  });

  it('another rider refused items and any waiting items give no card', async () => {
    const items: OutboxItem[] = [
      {
        id: 'other-rider-refused',
        courierId: 'rider-2',
        deliveryId: 'del-202',
        step: 'dispatched',
        tappedAt: 1000,
        state: 'refused',
        restaurantName: 'Other Restaurant',
      },
      {
        id: 'current-rider-waiting',
        courierId: 'rider-1',
        deliveryId: 'del-101',
        step: 'picked_up',
        tappedAt: 2000,
        state: 'waiting',
        restaurantName: 'Tasty Gyros',
      },
    ];
    await seedOutbox(items);

    render(<RefusedSteps courierId="rider-1" />);

    expect(
      screen.queryByText(i18n.t('translations:step_refused_close')),
    ).toBeNull();
  });

  it('nothing renders with no refused items', async () => {
    await seedOutbox([]);

    const { toJSON } = render(<RefusedSteps courierId="rider-1" />);
    expect(toJSON()).toBeNull();
    expect(
      screen.queryByText(i18n.t('translations:step_refused_close')),
    ).toBeNull();

    // Also nothing renders when courierId is undefined
    const item: OutboxItem = {
      id: 'item-1',
      courierId: 'rider-1',
      deliveryId: 'del-101',
      step: 'dispatched',
      tappedAt: 1000,
      state: 'refused',
      restaurantName: 'Tasty Gyros',
    };
    await seedOutbox([item]);

    const { toJSON: toJSONUndefined } = render(
      <RefusedSteps courierId={undefined} />,
    );
    expect(toJSONUndefined()).toBeNull();
  });

  it('Close calls dismissRefused(courierId, deliveryId), and a rejected dismissRefused does not crash', async () => {
    const item: OutboxItem = {
      id: 'item-1',
      courierId: 'rider-1',
      deliveryId: 'del-101',
      step: 'dispatched',
      tappedAt: 1000,
      state: 'refused',
      restaurantName: 'Tasty Gyros',
    };
    await seedOutbox([item]);

    const dismissSpy = jest.spyOn(jobStepOutbox, 'dismissRefused');

    const { unmount } = render(<RefusedSteps courierId="rider-1" />);

    const closeBtn = screen.getByText(
      i18n.t('translations:step_refused_close'),
    );

    await act(async () => {
      fireEvent.press(closeBtn);
    });

    expect(dismissSpy).toHaveBeenCalledTimes(1);
    expect(dismissSpy).toHaveBeenCalledWith('rider-1', 'del-101');

    unmount();

    // Now test that a rejected dismissRefused does not crash
    await seedOutbox([item]);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    dismissSpy.mockRejectedValueOnce(new Error('AsyncStorage failure'));

    render(<RefusedSteps courierId="rider-1" />);

    const closeBtn2 = screen.getByText(
      i18n.t('translations:step_refused_close'),
    );

    await act(async () => {
      fireEvent.press(closeBtn2);
    });

    expect(dismissSpy).toHaveBeenCalledTimes(2);
    expect(dismissSpy).toHaveBeenLastCalledWith('rider-1', 'del-101');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Could not close the refusal card',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('names the refused step Picked up when picked_up is refused (spec 0021, review fix)', async () => {
    const item: OutboxItem = {
      id: 'step-pickup',
      courierId: 'rider-1',
      deliveryId: 'del-101',
      step: 'picked_up',
      tappedAt: 1000,
      state: 'refused',
      restaurantName: 'Tasty Gyros',
    };
    await seedOutbox([item]);

    render(<RefusedSteps courierId="rider-1" />);

    const translatedStep = i18n.t('translations:swipe_picked_up');
    expect(translatedStep).toBe('Picked up');
    const expectedBody = i18n.t('translations:step_refused_body', {
      restaurant: 'Tasty Gyros',
      step: translatedStep,
    });
    expect(screen.getByText(expectedBody)).toBeTruthy();
  });

  it('names the refused step Delivered when delivered is refused (spec 0021, review fix)', async () => {
    const item: OutboxItem = {
      id: 'step-deliv',
      courierId: 'rider-1',
      deliveryId: 'del-101',
      step: 'delivered',
      tappedAt: 1000,
      state: 'refused',
      restaurantName: 'Tasty Gyros',
    };
    await seedOutbox([item]);

    render(<RefusedSteps courierId="rider-1" />);

    const translatedStep = i18n.t('translations:swipe_delivered');
    expect(translatedStep).toBe('Delivered');
    const expectedBody = i18n.t('translations:step_refused_body', {
      restaurant: 'Tasty Gyros',
      step: translatedStep,
    });
    expect(screen.getByText(expectedBody)).toBeTruthy();
  });
});
