import React from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import notifee from '@notifee/react-native';
import '@app/localization/i18n';
import { OfferAlertScreen } from './OfferAlertScreen';
import {
  displayedOfferAlerts,
  offerAlertLineList,
  payText,
} from '@app/services/offerPush/offerAlert';
import { answerOffer } from '@app/services/offerPush/answerOffer';
import {
  closeAlertScreen,
  openAppFromAlert,
} from '@app/services/offerPush/phone';
import {
  OfferAlertData,
  toNotificationData,
} from '@app/services/offerPush/offerMessage';
import { NewOrderCell } from '@app/components/NewOrderCell/NewOrderCell';
import { Order } from '@app/types/types';
import { OfferTrip } from '@app/utilities/offerTrip';

// The alert's lines are the real ones (row 100): what the screen shows is
// what the card shows, so they are not mocked.
jest.mock('@app/services/offerPush/offerAlert', () => ({
  displayedOfferAlerts: jest.fn(),
  offerAlertLines: jest.requireActual('@app/services/offerPush/offerAlert')
    .offerAlertLines,
  // A jest.fn around the real list, so one test can hand the screen its own
  // list and check the screen draws exactly that (row 100 review).
  offerAlertLineList: jest.fn(
    jest.requireActual('@app/services/offerPush/offerAlert').offerAlertLineList,
  ),
  payText: jest.fn(() => '€6.50'),
}));

jest.mock('@app/services/offerPush/answerOffer', () => ({
  answerOffer: jest.fn(() => Promise.resolve('sent')),
}));

let mockReopenListener: ((notificationId: string | null) => void) | null = null;

jest.mock('@app/services/offerPush/phone', () => ({
  closeAlertScreen: jest.fn(),
  openAppFromAlert: jest.fn(),
  onAlertScreenReopened: jest.fn(cb => {
    mockReopenListener = cb;
    return () => {
      mockReopenListener = null;
    };
  }),
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
    toPickupMetres: '1834',
    toDropoffMetres: '1012',
    minutes: '6',
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
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([
      {
        notificationId: 'del-screen-1',
        data: validOfferData,
      },
    ]);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OfferAlertScreen />);
      await Promise.resolve();
    });

    const root = tree.root;
    // Check that pay and summary are rendered
    const texts = root.findAllByType('Text' as any).map(t => t.props.children);
    expect(texts).toContain('€6.50');
    expect(texts).toContain('Pizza Roma to Iasonos');
    expect(texts).toContain('Accept');
    expect(texts).toContain('Decline');

    tree.unmount();
  });

  it('finds offer from displayed alerts and skips Android group summary notification (commit 50f9d9c)', async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue(null);

    // Android adds a group summary notification on the same channel with no offer data
    // Placed last so it is the newest item; without the null filter, findOffer would pick it
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([
      {
        notificationId: 'del-screen-1',
        data: validOfferData, // Real offer
      },
      {
        notificationId: 'group-summary-notif',
        data: undefined, // Group summary has no offer data, newest/last
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
    expect(texts).toContain('Pizza Roma to Iasonos');

    tree.unmount();
  });

  it('reopens to show that alert offer and enables buttons again, or shows ended if not displayed (AC-4)', async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValueOnce({
      notification: {
        id: 'del-screen-1',
        data: validOfferData,
      },
    });

    const secondOfferData = {
      ...validOfferData,
      deliveryId: 'del-screen-2',
      restaurantName: 'Burger Queen',
      dropoffArea: 'Ermou',
      payTotal: '850',
    };

    (displayedOfferAlerts as jest.Mock).mockResolvedValue([
      { notificationId: 'del-screen-1', data: validOfferData },
      { notificationId: 'del-screen-2', data: secondOfferData },
    ]);

    (payText as jest.Mock).mockImplementation((data: any) =>
      data?.deliveryId === 'del-screen-2' ? '€8.50' : '€6.50',
    );

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OfferAlertScreen />);
      await Promise.resolve();
    });

    // Initially shows first offer
    let texts = tree.root
      .findAllByType('Text' as any)
      .map(t => t.props.children);
    expect(texts).toContain('€6.50');

    // Reopen event arrives with notification id for offer 2
    await act(async () => {
      mockReopenListener?.('del-screen-2');
      await Promise.resolve();
    });

    // Screen now shows that alert's offer (offer 2, not offer 1)
    texts = tree.root.findAllByType('Text' as any).map(t => t.props.children);
    expect(texts).toContain('€8.50');
    expect(texts).toContain('Burger Queen to Ermou');
    expect(texts).not.toContain('€6.50');

    // Buttons work again for offer 2
    const acceptBtn = tree.root.findAll(
      node =>
        typeof node.props?.onPress === 'function' &&
        node
          .findAllByType('Text' as any)
          .some(t => t.props?.children === 'Accept'),
    )[0];
    await act(async () => {
      acceptBtn.props.onPress();
      await Promise.resolve();
    });

    expect(answerOffer).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: 'del-screen-2' }),
      'accept',
    );

    // With an id whose alert is no longer displayed, it shows "This offer has ended"
    await act(async () => {
      mockReopenListener?.('del-screen-missing');
      await Promise.resolve();
    });

    texts = tree.root.findAllByType('Text' as any).map(t => t.props.children);
    expect(texts).toContain('This offer has ended');

    tree.unmount();
  });

  it('does not switch to "This offer has ended" on 1s tick while an answer is in flight even if alert is no longer displayed', async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
      notification: {
        id: 'del-screen-1',
        data: validOfferData,
      },
    });
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([
      {
        notificationId: 'del-screen-1',
        data: validOfferData,
      },
    ]);

    let resolveAnswer!: (outcome: any) => void;
    (answerOffer as jest.Mock).mockReturnValue(
      new Promise(resolve => {
        resolveAnswer = resolve;
      }),
    );

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OfferAlertScreen />);
      await Promise.resolve();
    });

    // Alert was displayed, but once tapped, answerOffer cancels the alert immediately
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([]);

    const acceptBtn = tree.root.findAll(
      node =>
        typeof node.props?.onPress === 'function' &&
        node
          .findAllByType('Text' as any)
          .some(t => t.props?.children === 'Accept'),
    )[0];

    // Tap accept; answer is in flight (sending is true)
    act(() => {
      acceptBtn.props.onPress();
    });

    // Advance 1s tick
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    // Screen does not switch to "This offer has ended" because sending is in flight
    let texts = tree.root
      .findAllByType('Text' as any)
      .map(t => t.props.children);
    expect(texts).not.toContain('This offer has ended');
    expect(texts).toContain('€6.50');

    // Once sending finishes, alert screen closes
    await act(async () => {
      resolveAnswer('sent');
      await Promise.resolve();
    });
    expect(closeAlertScreen).toHaveBeenCalledTimes(1);

    tree.unmount();
  });

  it('tapping Accept sends answerOffer accept and closes the alert screen', async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
      notification: {
        id: 'del-screen-1',
        data: validOfferData,
      },
    });
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([
      {
        notificationId: 'del-screen-1',
        data: validOfferData,
      },
    ]);

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
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([
      {
        notificationId: 'del-screen-1',
        data: validOfferData,
      },
    ]);

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
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([
      {
        notificationId: 'del-screen-1',
        data: validOfferData,
      },
    ]);

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

  it('shows offer A when stale initial notification is for offer B whose alert is no longer displayed (commit 690f047)', async () => {
    const offerA = {
      ...validOfferData,
      deliveryId: 'del-screen-A',
      restaurantName: 'Pizza Roma',
      payTotal: '650',
    };
    const offerB = {
      ...validOfferData,
      deliveryId: 'del-screen-B',
      restaurantName: 'Burger Queen',
      dropoffArea: 'Ermou',
      payTotal: '850',
    };

    (payText as jest.Mock).mockImplementation((data: any) =>
      data?.deliveryId === 'del-screen-B' ? '€8.50' : '€6.50',
    );

    // Initial notification points to B (stale, alert no longer displayed)
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
      notification: {
        id: 'del-screen-B',
        data: offerB,
      },
    });

    // Alert for offer A is currently displayed
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([
      {
        notificationId: 'del-screen-A',
        data: offerA,
      },
    ]);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OfferAlertScreen />);
      await Promise.resolve();
    });

    // Screen shows offer A, not B, and never "This offer has ended"
    let texts = tree.root
      .findAllByType('Text' as any)
      .map(t => t.props.children);
    expect(texts).toContain('€6.50');
    expect(texts).toContain('Pizza Roma to Iasonos');
    expect(texts).not.toContain('€8.50');
    expect(texts).not.toContain('This offer has ended');

    // Advance 1s tick
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    // Still shows offer A after the 1s tick
    texts = tree.root.findAllByType('Text' as any).map(t => t.props.children);
    expect(texts).toContain('€6.50');
    expect(texts).toContain('Pizza Roma to Iasonos');
    expect(texts).not.toContain('This offer has ended');

    tree.unmount();
  });

  it('prefers initial notification offer A when both A and B alerts are displayed and B is newest (commit 690f047)', async () => {
    const offerA = {
      ...validOfferData,
      deliveryId: 'del-screen-A',
      restaurantName: 'Pizza Roma',
      payTotal: '650',
    };
    const offerB = {
      ...validOfferData,
      deliveryId: 'del-screen-B',
      restaurantName: 'Burger Queen',
      dropoffArea: 'Ermou',
      payTotal: '850',
    };

    (payText as jest.Mock).mockImplementation((data: any) =>
      data?.deliveryId === 'del-screen-B' ? '€8.50' : '€6.50',
    );

    // Initial notification is for offer A (the tapped one)
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
      notification: {
        id: 'del-screen-A',
        data: offerA,
      },
    });

    // Both A and B are displayed, with B being newest (last)
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([
      {
        notificationId: 'del-screen-A',
        data: offerA,
      },
      {
        notificationId: 'del-screen-B',
        data: offerB,
      },
    ]);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OfferAlertScreen />);
      await Promise.resolve();
    });

    // Screen shows A (the tapped one), winning over newest B
    const texts = tree.root
      .findAllByType('Text' as any)
      .map(t => t.props.children);
    expect(texts).toContain('€6.50');
    expect(texts).toContain('Pizza Roma to Iasonos');
    expect(texts).not.toContain('€8.50');
    expect(texts).not.toContain('Burger Queen to Ermou');

    tree.unmount();
  });

  it('shows "This offer has ended" when initial notification is for offer B but nothing is displayed (commit 690f047)', async () => {
    const offerB = {
      ...validOfferData,
      deliveryId: 'del-screen-B',
      restaurantName: 'Burger Queen',
      dropoffArea: 'Ermou',
      payTotal: '850',
    };

    (payText as jest.Mock).mockImplementation((data: any) =>
      data?.deliveryId === 'del-screen-B' ? '€8.50' : '€6.50',
    );

    // Initial notification has stale offer B
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
      notification: {
        id: 'del-screen-B',
        data: offerB,
      },
    });

    // Nothing displayed
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([]);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<OfferAlertScreen />);
      await Promise.resolve();
    });

    // Screen shows "This offer has ended" and not offer B
    const texts = tree.root
      .findAllByType('Text' as any)
      .map(t => t.props.children);
    expect(texts).toContain('This offer has ended');
    expect(texts).not.toContain('€8.50');
    expect(texts).not.toContain('Accept');

    tree.unmount();
  });

  it('renders Accept and Decline buttons with height 100 (control.offer, spec 0007 AC-5)', async () => {
    (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
      notification: {
        id: 'del-screen-1',
        data: validOfferData,
      },
    });
    (displayedOfferAlerts as jest.Mock).mockResolvedValue([
      {
        notificationId: 'del-screen-1',
        data: validOfferData,
      },
    ]);

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
    const declineBtn = root.findAll(
      node =>
        typeof node.props?.onPress === 'function' &&
        node
          .findAllByType('Text' as any)
          .some(t => t.props?.children === 'Decline'),
    )[0];

    const acceptStyle = StyleSheet.flatten(acceptBtn.props.style);
    expect(acceptStyle.height).toBe(100);

    const declineStyle = StyleSheet.flatten(declineBtn.props.style);
    expect(declineStyle.height).toBe(100);

    tree.unmount();
  });

  // Row 100 (decision 100.2, spec 0019 AC-3): the full screen alert shows the
  // card's total, then the card's lines in the card's order, and nothing else
  // about the offer.
  describe('says what the offer card says (row 100)', () => {
    const DISTANCES = '1.8 km to the restaurant · 1.0 km to the customer';
    const MINUTES = 'About 6 min';
    const PLACE = 'Pizza Roma to Iasonos';

    const offer: OfferAlertData = {
      deliveryId: 'del-card-1',
      offeredAt: '2026-10-26T10:00:00.000Z',
      msLeftAtSend: null,
      payTotal: 650,
      currencyCode: 'EUR',
      restaurantName: 'Pizza Roma',
      dropoffArea: 'Iasonos',
      trip: { toPickupMetres: 1834, toDropoffMetres: 1012, minutes: 6 },
      insistent: false,
    };

    beforeEach(() => {
      // The real total, as the card formats it.
      (payText as jest.Mock).mockImplementation(
        jest.requireActual('@app/services/offerPush/offerAlert').payText,
      );
    });

    // Every Text on the alert screen, top to bottom.
    const screenTexts = async (
      data: Record<string, string>,
    ): Promise<string[]> => {
      (notifee.getInitialNotification as jest.Mock).mockResolvedValue({
        notification: { id: data.deliveryId, data },
      });
      (displayedOfferAlerts as jest.Mock).mockResolvedValue([
        { notificationId: data.deliveryId, data },
      ]);
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(<OfferAlertScreen />);
        await Promise.resolve();
      });
      const texts = tree.root
        .findAllByType('Text' as any)
        .map(node => node.props.children)
        .filter((child): child is string => typeof child === 'string');
      tree.unmount();
      return texts;
    };

    it('shows the total, then the distances, the minutes and the place, in that order', async () => {
      const texts = await screenTexts(toNotificationData(offer, null));

      expect(texts.slice(0, 4)).toEqual(['€6.50', DISTANCES, MINUTES, PLACE]);
      // Then the time line; the offer's facts stop there.
      expect(texts[4]).toBe('Waiting for your answer');
    });

    it('draws exactly the lines offerAlertLineList gives, in its order (the one source)', async () => {
      const realLineList = jest.requireActual(
        '@app/services/offerPush/offerAlert',
      ).offerAlertLineList;
      // A list no other code could produce: if the screen drew the lines from
      // anywhere else, or reordered them, these would not appear as given.
      (offerAlertLineList as jest.Mock).mockImplementation(() => [
        'Third written first',
        'First written second',
      ]);
      try {
        const texts = await screenTexts(toNotificationData(offer, null));

        expect(offerAlertLineList).toHaveBeenCalled();
        expect(texts.slice(0, 4)).toEqual([
          '€6.50',
          'Third written first',
          'First written second',
          'Waiting for your answer',
        ]);
        expect(texts).not.toContain(DISTANCES);
        expect(texts).not.toContain(PLACE);
      } finally {
        (offerAlertLineList as jest.Mock).mockImplementation(realLineList);
      }
    });

    it('draws the real offerAlertLineList of the offer, line for line', async () => {
      const texts = await screenTexts(toNotificationData(offer, null));
      const lines = jest
        .requireActual('@app/services/offerPush/offerAlert')
        .offerAlertLineList(offer);

      expect(lines).toHaveLength(3);
      expect(texts.slice(1, 1 + lines.length)).toEqual(lines);
      expect(texts[1 + lines.length]).toBe('Waiting for your answer');
    });

    it('with routing down shows the total and the place only, like the card', async () => {
      const texts = await screenTexts(
        toNotificationData(
          {
            ...offer,
            trip: {
              toPickupMetres: null,
              toDropoffMetres: null,
              minutes: null,
            },
          },
          null,
        ),
      );

      expect(texts.slice(0, 3)).toEqual([
        '€6.50',
        PLACE,
        'Waiting for your answer',
      ]);
      expect(texts.some(text => /km/.test(text))).toBe(false);
      expect(texts.some(text => /About/.test(text))).toBe(false);
    });

    it('with one leg unknown shows only the known leg, and no minutes line when minutes is null', async () => {
      const texts = await screenTexts(
        toNotificationData(
          {
            ...offer,
            trip: {
              toPickupMetres: 1834,
              toDropoffMetres: null,
              minutes: null,
            },
          },
          null,
        ),
      );

      expect(texts.slice(0, 4)).toEqual([
        '€6.50',
        '1.8 km to the restaurant',
        PLACE,
        'Waiting for your answer',
      ]);
    });

    it("never shows €/km, items, the customer's name or the quote's km", async () => {
      const texts = await screenTexts({
        ...toNotificationData(offer, null),
        // Things the card never shows, even if they reached the alert's data.
        distanceKm: '3.7',
        customerName: 'Secret Customer',
        orderItems: '2x Souvlaki',
        items: '2x Souvlaki',
        customerNotes: 'Door code 1234',
      });

      const all = texts.join('\n');
      expect(all).not.toMatch(/\/\s*km/);
      expect(all).not.toContain('3.7');
      expect(all).not.toContain('Secret Customer');
      expect(all).not.toContain('Souvlaki');
      expect(all).not.toContain('Door code');
      // The total is the only money on the screen.
      expect(texts.filter(text => text.includes('€'))).toEqual(['€6.50']);
    });

    it("with routing down never falls back to the quote's km", async () => {
      const texts = await screenTexts({
        ...toNotificationData(
          {
            ...offer,
            trip: {
              toPickupMetres: null,
              toDropoffMetres: null,
              minutes: null,
            },
          },
          null,
        ),
        distanceKm: '3.7',
      });

      expect(texts.slice(0, 3)).toEqual([
        '€6.50',
        PLACE,
        'Waiting for your answer',
      ]);
      expect(texts.some(text => /km/.test(text))).toBe(false);
    });

    // The card (NewOrderCell) for the same trip: its total and its two trip
    // lines, by testID, in the order it draws them.
    const cardTexts = (trip: OfferTrip) => {
      const order = {
        id: 'order-card-1',
        currencyCode: 'EUR',
        totalCompensation: 650,
        pickupBusinessName: 'Pizza Roma',
        dropoffArea: 'Iasonos',
        offerTrip: trip,
      } as unknown as Order;
      let tree!: renderer.ReactTestRenderer;
      act(() => {
        tree = renderer.create(
          <NewOrderCell
            order={order}
            autoAcceptOrders={false}
            onAccept={jest.fn()}
            onDecline={jest.fn()}
            millisRemaining={null}
            totalMillis={null}
            millisWaited={null}
          />,
        );
      });
      const total = tree.root.findAllByType('Text' as any)[0].props.children;
      const lines = ['offer-trip-distances', 'offer-trip-minutes'].flatMap(
        testID =>
          tree.root
            .findAllByType('Text' as any)
            .filter(node => node.props.testID === testID)
            .map(node => node.props.children as string),
      );
      act(() => tree.unmount());
      return { total, lines };
    };

    it.each<[string, OfferTrip]>([
      [
        'all known',
        { toPickupMetres: 1834, toDropoffMetres: 1012, minutes: 6 },
      ],
      [
        'halves that round up',
        { toPickupMetres: 1450, toDropoffMetres: 1850, minutes: 12 },
      ],
      ['short legs', { toPickupMetres: 49, toDropoffMetres: 50, minutes: 1 }],
      [
        'routing down',
        { toPickupMetres: null, toDropoffMetres: null, minutes: null },
      ],
      [
        'the restaurant leg only',
        { toPickupMetres: 1450, toDropoffMetres: null, minutes: null },
      ],
      [
        'the customer leg and minutes',
        { toPickupMetres: null, toDropoffMetres: 2850, minutes: 9 },
      ],
    ])(
      'uses the same words as the card for the same trip: %s',
      async (_name, trip) => {
        const card = cardTexts(trip);
        // The card really drew its lines (one per known group), so the
        // comparison below is not two empty lists.
        expect(card.lines).toHaveLength(
          (trip.toPickupMetres !== null || trip.toDropoffMetres !== null
            ? 1
            : 0) + (trip.minutes !== null ? 1 : 0),
        );
        expect(card.total).toBe('€6.50');
        const texts = await screenTexts(
          toNotificationData({ ...offer, trip }, null),
        );

        // The total first, as on the card.
        expect(texts[0]).toBe(card.total);
        // Then exactly the card's trip lines, in the card's order, then the place.
        const placeAt = texts.indexOf(PLACE);
        expect(placeAt).toBeGreaterThan(0);
        expect(texts.slice(1, placeAt)).toEqual(card.lines);
      },
    );
  });
});
