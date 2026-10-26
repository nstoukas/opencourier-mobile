import React from 'react';
import renderer, { act } from 'react-test-renderer';
import notifee from '@notifee/react-native';
import '@app/localization/i18n';
import { OfferAlertScreen } from './OfferAlertScreen';
import { displayedOfferAlerts } from '@app/services/offerPush/offerAlert';
import { answerOffer } from '@app/services/offerPush/answerOffer';
import {
  closeAlertScreen,
  openAppFromAlert,
} from '@app/services/offerPush/phone';

jest.mock('@app/services/offerPush/offerAlert', () => ({
  displayedOfferAlerts: jest.fn(),
  offerSummary: jest.fn(() => 'Pizza Roma to Iasonos · 2.4 km · 12 min'),
  payText: jest.fn(() => '€6.50'),
}));

jest.mock('@app/services/offerPush/answerOffer', () => ({
  answerOffer: jest.fn(() => Promise.resolve('sent')),
}));

jest.mock('@app/services/offerPush/phone', () => ({
  closeAlertScreen: jest.fn(),
  openAppFromAlert: jest.fn(),
}));

describe('OfferAlertScreen (spec 0003, AC-4, AC-5, Decision 58.14, Commit 50f9d9c)', () => {
  const validOfferData = {
    kind: 'offer-alert',
    deliveryId: 'del-screen-1',
    offeredAt: '2026-10-26T10:00:00.000Z',
    deadlineAt: String(Date.now() + 30000),
    payTotal: '650',
    currencyCode: 'EUR',
    restaurantName: 'Pizza Roma',
    dropoffArea: 'Iasonos',
    distanceKm: '2.4',
    minutes: '12',
    insistent: '',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([]);
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders offer from initial notification without loading wait', async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
      notification: {
        id: 'del-screen-1',
        data: validOfferData,
      },
    });

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OfferAlertScreen />);
      await Promise.resolve();
    });

    const root = tree.root;
    // Check that pay and summary are rendered
    const texts = root.findAllByType('Text' as any).map(t => t.props.children);
    expect(texts).toContain('€6.50');
    expect(texts).toContain('Pizza Roma to Iasonos · 2.4 km · 12 min');
    expect(texts).toContain('Accept');
    expect(texts).toContain('Decline');

    tree.unmount();
  });

  it('finds offer from displayed alerts and skips Android group summary notification (commit 50f9d9c)', async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue(null);

    // Android adds a group summary notification on the same channel with no offer data
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([
      {
        notificationId: 'group-summary-notif',
        data: undefined, // Group summary has no offer data
      },
      {
        notificationId: 'del-screen-1',
        data: validOfferData, // Real offer
      },
    ]);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OfferAlertScreen />);
      await Promise.resolve();
    });

    const root = tree.root;
    const texts = root.findAllByType('Text' as any).map(t => t.props.children);
    // Finds the real offer and displays its details rather than showing "ended"
    expect(texts).toContain('€6.50');
    expect(texts).toContain('Pizza Roma to Iasonos · 2.4 km · 12 min');

    tree.unmount();
  });

  it('tapping Accept sends answerOffer accept and closes the alert screen', async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
      notification: {
        id: 'del-screen-1',
        data: validOfferData,
      },
    });

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OfferAlertScreen />);
      await Promise.resolve();
    });

    const root = tree.root;
    const acceptBtn = root.findAll(
      node =>
        typeof node.props?.onPress === 'function' &&
        node
          .findAllByType('Text' as any)
          .some(t => t.props?.children === 'Accept'),
    )[0];
    expect(acceptBtn).toBeDefined();

    await act(async () => {
      acceptBtn.props.onPress();
      await Promise.resolve();
    });

    expect(answerOffer).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: 'del-screen-1' }),
      'accept',
    );
    expect(closeAlertScreen).toHaveBeenCalledTimes(1);

    tree.unmount();
  });

  it('tapping Decline sends answerOffer decline and closes the alert screen', async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
      notification: {
        id: 'del-screen-1',
        data: validOfferData,
      },
    });

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OfferAlertScreen />);
      await Promise.resolve();
    });

    const root = tree.root;
    const declineBtn = root.findAll(
      node =>
        typeof node.props?.onPress === 'function' &&
        node
          .findAllByType('Text' as any)
          .some(t => t.props?.children === 'Decline'),
    )[0];
    expect(declineBtn).toBeDefined();

    await act(async () => {
      declineBtn.props.onPress();
      await Promise.resolve();
    });

    expect(answerOffer).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: 'del-screen-1' }),
      'decline',
    );
    expect(closeAlertScreen).toHaveBeenCalledTimes(1);

    tree.unmount();
  });

  it('tapping "Open the app" calls openAppFromAlert', async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
      notification: {
        id: 'del-screen-1',
        data: validOfferData,
      },
    });

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OfferAlertScreen />);
      await Promise.resolve();
    });

    const root = tree.root;
    const openAppBtn = root.findAll(
      node =>
        typeof node.props?.onPress === 'function' &&
        node
          .findAllByType('Text' as any)
          .some(t => t.props?.children === 'Open the app'),
    )[0];
    expect(openAppBtn).toBeDefined();

    await act(async () => {
      openAppBtn.props.onPress();
      await Promise.resolve();
    });

    expect(openAppFromAlert).toHaveBeenCalledTimes(1);

    tree.unmount();
  });

  it('shows "This offer has ended" when offer is not found', async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue(null);
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([]);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OfferAlertScreen />);
      await Promise.resolve();
    });

    const root = tree.root;
    const texts = root.findAllByType('Text' as any).map(t => t.props.children);
    expect(texts).toContain('This offer has ended');

    tree.unmount();
  });
});
