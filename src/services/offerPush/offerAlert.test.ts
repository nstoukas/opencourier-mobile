import notifee, {
  AndroidImportance,
  AndroidStyle,
  AndroidVisibility,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import '@app/localization/i18n';
import {
  ALERT_GRACE_AFTER_DEADLINE_MS,
  cancelAllOfferAlerts,
  cancelOfferAlert,
  displayedOfferAlerts,
  ensureOfferChannels,
  offerAlertLineList,
  offerAlertLines,
  offerSummary,
  OFFERS_CHANNEL_ID,
  OFFERS_INSISTENT_CHANNEL_ID,
  showOfferAlert,
} from './offerAlert';
import { OfferAlertData, parseOfferMessage } from './offerMessage';

describe('offerAlert (spec 0003, AC-3, AC-6, AC-7, Decisions 58.13, 58.15)', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
  });

  afterAll(() => {
    Platform.OS = originalOS;
  });

  const baseOffer: OfferAlertData = {
    deliveryId: 'del-alert-1',
    offeredAt: '2026-10-26T10:00:00.000Z',
    msLeftAtSend: 30000,
    payTotal: 550, // €5.50
    currencyCode: 'EUR',
    restaurantName: 'Pizza Roma',
    dropoffArea: 'Iasonos',
    trip: { toPickupMetres: 1834, toDropoffMetres: 1012, minutes: 6 },
    insistent: false,
  };

  it('creates channels for offers (normal), offers-insistent (longer vibration), and notices (silent)', async () => {
    await ensureOfferChannels();

    expect(notifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: OFFERS_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'offer_ring',
        vibration: true,
      }),
    );

    expect(notifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: OFFERS_INSISTENT_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'offer_ring',
        vibration: true,
        vibrationPattern: [300, 800, 300, 800, 300, 800, 300, 1500],
      }),
    );

    expect(notifee.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'offer-notices',
        importance: AndroidImportance.HIGH,
        vibration: false,
      }),
    );
  });

  it('AC-3: posts a notification with id=deliveryId, PUBLIC visibility, loopSound, ongoing, fullScreenAction, and actions', async () => {
    const receivedAt = 100000;
    jest.spyOn(Date, 'now').mockReturnValue(100000);

    await showOfferAlert(baseOffer, receivedAt, 'full-screen');

    expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'del-alert-1',
        title: expect.stringContaining('€5.50'),
        body: expect.stringContaining('Pizza Roma to Iasonos'),
        android: expect.objectContaining({
          channelId: OFFERS_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          loopSound: true,
          ongoing: true,
          autoCancel: false,
          lightUpScreen: true,
          fullScreenAction: {
            id: 'open-offer',
            launchActivity: 'com.opendeli.OfferAlertActivity',
          },
          pressAction: {
            id: 'open-offer',
            launchActivity: 'com.opendeli.OfferAlertActivity',
          },
          actions: [
            {
              title: 'Accept',
              pressAction: { id: 'accept' },
            },
            {
              title: 'Decline',
              pressAction: { id: 'decline' },
            },
          ],
        }),
      }),
    );
  });

  it('AC-3 and AC-6 local stop: sets chronometer countdown to deadline and timeoutAfter to deadline plus 5s', async () => {
    // Decision 58.11 / spec: local stop grace period must be literal 5000 ms (5s)
    expect(ALERT_GRACE_AFTER_DEADLINE_MS).toBe(5000);

    const receivedAt = 100000;
    const now = 100000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const offerWithDeadline: OfferAlertData = {
      ...baseOffer,
      msLeftAtSend: 20000, // 20s left
    };

    await showOfferAlert(offerWithDeadline, receivedAt, 'full-screen');

    const expectedDeadline = 120000; // receivedAt (100000) + 20000
    const expectedStopAfter = 25000; // deadline (120000) + literal 5000 - now (100000)

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'del-alert-1',
        android: expect.objectContaining({
          showChronometer: true,
          chronometerDirection: 'down',
          timestamp: expectedDeadline,
          timeoutAfter: expectedStopAfter,
        }),
      }),
    );
  });

  it('posts no chronometer or timeoutAfter when offer has no deadline (expiry off)', async () => {
    const offerNoDeadline: OfferAlertData = {
      ...baseOffer,
      msLeftAtSend: null,
    };

    await showOfferAlert(offerNoDeadline, Date.now(), 'full-screen');

    const call = (notifee.displayNotification as jest.Mock).mock.calls[0][0];
    expect(call.android.showChronometer).toBeUndefined();
    expect(call.android.chronometerDirection).toBeUndefined();
    expect(call.android.timestamp).toBeUndefined();
    expect(call.android.timeoutAfter).toBeUndefined();
  });

  it('drops notification immediately if deadline plus 5s grace has already passed at display time', async () => {
    const receivedAt = 100000;
    // Current time is 30s past receivedAt, while msLeft was only 20s (so 20s + 5s = 25s, already passed)
    jest.spyOn(Date, 'now').mockReturnValue(130000);

    const staleOffer: OfferAlertData = {
      ...baseOffer,
      msLeftAtSend: 20000,
    };

    await showOfferAlert(staleOffer, receivedAt, 'full-screen');

    expect(notifee.displayNotification).not.toHaveBeenCalled();
  });

  it('AC-7: uses channel offers normally, offers-insistent when message has insistent true', async () => {
    // Normal offer
    await showOfferAlert(
      { ...baseOffer, insistent: false },
      Date.now(),
      'heads-up',
    );
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        android: expect.objectContaining({
          channelId: OFFERS_CHANNEL_ID,
        }),
      }),
    );

    (notifee.displayNotification as jest.Mock).mockClear();

    // Insistent re-send (2 minutes re-send from backend)
    await showOfferAlert(
      { ...baseOffer, insistent: true },
      Date.now(),
      'heads-up',
    );
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        android: expect.objectContaining({
          channelId: OFFERS_INSISTENT_CHANNEL_ID,
        }),
      }),
    );
  });

  it('AC-12: heads-up style omits fullScreenAction', async () => {
    await showOfferAlert(baseOffer, Date.now(), 'heads-up');

    const call = (notifee.displayNotification as jest.Mock).mock.calls[0][0];
    expect(call.android.fullScreenAction).toBeUndefined();
    expect(call.android.pressAction).toEqual({
      id: 'open-offer',
      launchActivity: 'com.opendeli.OfferAlertActivity',
    });
  });

  it('cancelOfferAlert calls notifee.cancelNotification', async () => {
    await cancelOfferAlert('del-to-cancel');
    expect(notifee.cancelNotification).toHaveBeenCalledWith('del-to-cancel');
  });

  it('displayedOfferAlerts filters for notifications on offers channels and cancelAllOfferAlerts cancels each', async () => {
    (notifee.getDisplayedNotifications as jest.Mock).mockResolvedValue([
      {
        id: 'del-1',
        notification: {
          id: 'del-1',
          android: { channelId: OFFERS_CHANNEL_ID },
          data: { kind: 'offer-alert', deliveryId: 'del-1' },
        },
      },
      {
        id: 'del-2',
        notification: {
          id: 'del-2',
          android: { channelId: OFFERS_INSISTENT_CHANNEL_ID },
          data: { kind: 'offer-alert', deliveryId: 'del-2' },
        },
      },
      {
        id: 'other-notif',
        notification: {
          id: 'other-notif',
          android: { channelId: 'general' },
          data: {},
        },
      },
    ]);

    const active = await displayedOfferAlerts();
    expect(active).toHaveLength(2);
    expect(active.map(a => a.notificationId)).toEqual(['del-1', 'del-2']);

    await cancelAllOfferAlerts();
    expect(notifee.cancelNotification).toHaveBeenCalledWith('del-1');
    expect(notifee.cancelNotification).toHaveBeenCalledWith('del-2');
    expect(notifee.cancelNotification).not.toHaveBeenCalledWith('other-notif');
  });
  // Row 100 (decision 100.2, spec 0019 AC-3): the alert words the trip like
  // the offer card, in the card's order: the two km, the minutes, then where
  // from and where to. Unknown figures are left out, as on the card.
  describe('the alert says what the card says (row 100)', () => {
    const DISTANCES = '1.8 km to the restaurant · 1.0 km to the customer';
    const MINUTES = 'About 6 min';
    const PLACE = 'Pizza Roma to Iasonos';
    const noTrip = {
      toPickupMetres: null,
      toDropoffMetres: null,
      minutes: null,
    };

    it('offerAlertLines: all figures known gives the card lines', () => {
      expect(offerAlertLines(baseOffer)).toEqual({
        distances: DISTANCES,
        minutes: MINUTES,
        place: PLACE,
      });
    });

    it('offerSummary: all figures known, in the card order', () => {
      expect(offerSummary(baseOffer)).toBe(
        `${DISTANCES} · ${MINUTES} · ${PLACE}`,
      );
    });

    it('routing down (all null): only the restaurant and the area', () => {
      const offer = { ...baseOffer, trip: noTrip };
      expect(offerAlertLines(offer)).toEqual({
        distances: '',
        minutes: '',
        place: PLACE,
      });
      expect(offerSummary(offer)).toBe(PLACE);
    });

    it('one leg unknown: only the known leg, and no minutes when minutes is null', () => {
      const pickupOnly = {
        ...baseOffer,
        trip: { toPickupMetres: 1834, toDropoffMetres: null, minutes: null },
      };
      expect(offerAlertLines(pickupOnly)).toEqual({
        distances: '1.8 km to the restaurant',
        minutes: '',
        place: PLACE,
      });
      expect(offerSummary(pickupOnly)).toBe(
        `1.8 km to the restaurant · ${PLACE}`,
      );

      const dropoffOnly = {
        ...baseOffer,
        trip: { toPickupMetres: null, toDropoffMetres: 1012, minutes: 6 },
      };
      expect(offerAlertLines(dropoffOnly)).toEqual({
        distances: '1.0 km to the customer',
        minutes: MINUTES,
        place: PLACE,
      });
      expect(offerSummary(dropoffOnly)).toBe(
        `1.0 km to the customer · ${MINUTES} · ${PLACE}`,
      );
    });

    it('minutes known, both legs unknown: minutes then the place', () => {
      const offer = {
        ...baseOffer,
        trip: { toPickupMetres: null, toDropoffMetres: null, minutes: 6 },
      };
      expect(offerSummary(offer)).toBe(`${MINUTES} · ${PLACE}`);
    });

    it('an empty area gives the restaurant alone', () => {
      expect(offerAlertLines({ ...baseOffer, dropoffArea: '' }).place).toBe(
        'Pizza Roma',
      );
      expect(
        offerSummary({ ...baseOffer, dropoffArea: '', trip: noTrip }),
      ).toBe('Pizza Roma');
      expect(offerSummary({ ...baseOffer, dropoffArea: '' })).toBe(
        `${DISTANCES} · ${MINUTES} · Pizza Roma`,
      );
    });

    it('shows no €/km, items or customer name', () => {
      const summary = offerSummary(baseOffer);
      expect(summary).not.toMatch(/\/\s*km/);
      expect(summary).not.toContain('€');
      expect(summary).not.toMatch(/item/i);
      expect(summary).not.toMatch(/customer name/i);
    });

    it('showOfferAlert: the body is the card lines in order, the title carries the total', async () => {
      await showOfferAlert(baseOffer, Date.now(), 'full-screen');

      const call = (notifee.displayNotification as jest.Mock).mock.calls[0][0];
      expect(call.title).toBe('New offer: €5.50');
      expect(call.body).toBe(`${DISTANCES} · ${MINUTES} · ${PLACE}`);
    });

    it('showOfferAlert with routing down: the body is the restaurant and area only', async () => {
      await showOfferAlert(
        { ...baseOffer, trip: noTrip },
        Date.now(),
        'heads-up',
      );

      const call = (notifee.displayNotification as jest.Mock).mock.calls[0][0];
      expect(call.title).toBe('New offer: €5.50');
      expect(call.body).toBe(PLACE);
    });

    it("a push with the quote's distanceKm never shows it, with or without the trip", async () => {
      const push = {
        type: 'NEW_DELIVERY_OFFER',
        deliveryId: 'del-legacy-km',
        offeredAt: '2026-10-26T10:00:00.000Z',
        offerExpiresAt: '',
        serverNow: '',
        payTotal: '550',
        currencyCode: 'EUR',
        restaurantName: 'Pizza Roma',
        dropoffArea: 'Iasonos',
        distanceKm: '3.7',
        insistent: '0',
      };

      for (const trip of [
        { toPickupMetres: '', toDropoffMetres: '', minutes: '' },
        { toPickupMetres: '1834', toDropoffMetres: '1012', minutes: '6' },
      ]) {
        (notifee.displayNotification as jest.Mock).mockClear();
        const parsed = parseOfferMessage({ ...push, ...trip });
        if (parsed?.kind !== 'offer') {
          throw new Error('not an offer');
        }
        await showOfferAlert(parsed.offer, Date.now(), 'full-screen');

        const call = (notifee.displayNotification as jest.Mock).mock
          .calls[0][0];
        const shown = `${call.title} ${call.body}`;
        expect(shown).not.toContain('3.7');
        expect(shown).not.toContain('3700');
        expect(JSON.stringify(call.data)).not.toContain('3.7');
        expect(call.body).toBe(
          trip.minutes === '' ? PLACE : `${DISTANCES} · ${MINUTES} · ${PLACE}`,
        );
      }
    });

    // Row 100 review: one ordered list of the alert's lines, read by the
    // notification body, the expanded notification and the full screen.
    describe('offerAlertLineList, the one source of the order', () => {
      const trips = [
        { toPickupMetres: 1834, toDropoffMetres: 1012, minutes: 6 },
        { toPickupMetres: 1834, toDropoffMetres: null, minutes: null },
        { toPickupMetres: null, toDropoffMetres: 1012, minutes: 6 },
        { toPickupMetres: null, toDropoffMetres: null, minutes: 6 },
        noTrip,
      ];

      it('lists the known lines in the card order, unknown ones left out', () => {
        expect(offerAlertLineList(baseOffer)).toEqual([
          DISTANCES,
          MINUTES,
          PLACE,
        ]);
        expect(
          offerAlertLineList({
            ...baseOffer,
            trip: {
              toPickupMetres: 1834,
              toDropoffMetres: null,
              minutes: null,
            },
          }),
        ).toEqual(['1.8 km to the restaurant', PLACE]);
        expect(offerAlertLineList({ ...baseOffer, trip: noTrip })).toEqual([
          PLACE,
        ]);
      });

      it.each(trips)(
        'offerSummary is offerAlertLineList joined with " · " (%o)',
        trip => {
          for (const dropoffArea of ['Iasonos', '']) {
            const offer = { ...baseOffer, trip, dropoffArea };
            expect(offerSummary(offer)).toBe(
              offerAlertLineList(offer).join(' · '),
            );
          }
        },
      );
    });

    // Row 100 review: a collapsed notification cuts its one line body, so the
    // expanded one (Android BIGTEXT) shows each line on its own row. notifee
    // reads Android notification text as HTML: rows are split by <br>, and a
    // restaurant's name must not be able to add markup.
    describe('the expanded notification on Android (BIGTEXT, HTML)', () => {
      const escaped = (line: string) =>
        line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const shownWith = async (offer: OfferAlertData) => {
        (notifee.displayNotification as jest.Mock).mockClear();
        await showOfferAlert(offer, Date.now(), 'full-screen');
        expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
        return (notifee.displayNotification as jest.Mock).mock.calls[0][0];
      };

      it('all figures known: BIGTEXT with the three lines joined by <br>, in the card order', async () => {
        const call = await shownWith(baseOffer);

        expect(call.android.style).toEqual({
          type: AndroidStyle.BIGTEXT,
          text: `${DISTANCES}<br>${MINUTES}<br>${PLACE}`,
        });
        expect(call.android.style.text).not.toContain('\n');
      });

      it('unknown lines are left out of the expanded text', async () => {
        const pickupOnly = await shownWith({
          ...baseOffer,
          trip: { toPickupMetres: 1834, toDropoffMetres: null, minutes: null },
        });
        expect(pickupOnly.android.style.text).toBe(
          `1.8 km to the restaurant<br>${PLACE}`,
        );

        const minutesOnly = await shownWith({
          ...baseOffer,
          trip: { toPickupMetres: null, toDropoffMetres: null, minutes: 6 },
        });
        expect(minutesOnly.android.style.text).toBe(`${MINUTES}<br>${PLACE}`);
      });

      it('routing down: the expanded text is the place line only', async () => {
        const call = await shownWith({ ...baseOffer, trip: noTrip });

        expect(call.android.style.type).toBe(AndroidStyle.BIGTEXT);
        expect(call.android.style.text).toBe(PLACE);
      });

      it('each line is HTML escaped (&, <, >), so a name cannot add markup', async () => {
        const offer = {
          ...baseOffer,
          restaurantName: '<b>Bold</b> & Co',
          dropoffArea: 'A>B',
        };
        const call = await shownWith(offer);

        expect(call.android.style.text).toBe(
          `${DISTANCES}<br>${MINUTES}<br>&lt;b&gt;Bold&lt;/b&gt; &amp; Co to A&gt;B`,
        );
        expect(call.android.style.text).toBe(
          offerAlertLineList(offer).map(escaped).join('<br>'),
        );
        expect(call.android.style.text).not.toContain('<b>');
      });

      it('the one line body is the summary, HTML escaped', async () => {
        const offer = {
          ...baseOffer,
          restaurantName: '<b>Bold</b> & Co',
        };
        const call = await shownWith(offer);

        expect(call.body).toBe(
          `${DISTANCES} · ${MINUTES} · &lt;b&gt;Bold&lt;/b&gt; &amp; Co to Iasonos`,
        );
        expect(call.body).toBe(escaped(offerSummary(offer)));
        expect(call.body).not.toContain('<b>');
      });

      it('a name with no markup is sent unchanged', async () => {
        const call = await shownWith(baseOffer);

        expect(call.body).toBe(`${DISTANCES} · ${MINUTES} · ${PLACE}`);
      });
    });

    describe('on iOS the body is plain text', () => {
      beforeEach(() => {
        Platform.OS = 'ios';
      });

      it('the body is the plain summary, not escaped', async () => {
        const offer = {
          ...baseOffer,
          restaurantName: '<b>Bold</b> & Co',
        };
        await showOfferAlert(offer, Date.now(), 'full-screen');

        const call = (notifee.displayNotification as jest.Mock).mock
          .calls[0][0];
        expect(call.body).toBe(
          `${DISTANCES} · ${MINUTES} · <b>Bold</b> & Co to Iasonos`,
        );
        expect(call.body).toBe(offerSummary(offer));
        expect(call.body).not.toContain('&lt;');
        expect(call.body).not.toContain('&amp;');
      });
    });
  });
});
