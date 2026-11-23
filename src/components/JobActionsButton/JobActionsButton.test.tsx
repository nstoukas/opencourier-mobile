import React from 'react';
import { Modal, Text, TouchableOpacity } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import en from '@app/localization/en/translations';
import el from '@app/localization/el/translations';
import { OrderStatus } from '@app/types/enums';
import { Order, SplitRequest } from '@app/types/types';
import { JobActionProps } from '@app/components/JobFooter/useJobActions';
import { JobActionsButton } from './JobActionsButton';

const mockImHere = jest.fn();

jest.mock('@app/hooks/useOrder', () => () => ({
  imHere: (...args: any[]) => mockImHere(...args),
  pickedUp: jest.fn().mockResolvedValue(true),
  delivered: jest.fn().mockResolvedValue(true),
}));

// Row 138: one round ⋯ button beside the address opens a sheet with the job's actions,
// each a full width button; a dot on the ⋯ says a timed action or an unread message waits.
describe('JobActionsButton (row 138)', () => {
  // The phone's clock in these tests.
  const NOW = 1_800_000_000_000;

  const job = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'del-button-1',
      status: OrderStatus.dispatched,
      pickupBusinessName: 'Acropolis Grill',
      removalRequest: null,
      splitRequest: null,
      ...overrides,
    } as unknown as Order);

  const draw = (order: Order, props: Partial<JobActionProps> = {}) =>
    render(
      <JobActionsButton order={order} onReportIssue={jest.fn()} {...props} />,
    );

  type View = ReturnType<typeof draw>;

  const openSheet = (view: View) =>
    fireEvent.press(view.getByTestId('job-actions-button'));

  // The keys of the buttons in the sheet, top to bottom ("here", "chat", …).
  const keysInSheet = (view: View): string[] =>
    within(view.getByTestId('job-actions-sheet'))
      .getAllByTestId(/^job-action-[a-z-]+$/)
      .map(row => String(row.props.testID).replace('job-action-', ''))
      .filter(key => !key.endsWith('-dot'));

  // Taps the words on a sheet button, as a finger would: the press goes to the button
  // around them, so a disabled button swallows it.
  const choose = (view: View, key: string) =>
    fireEvent.press(
      within(view.getByTestId(`job-action-${key}`)).UNSAFE_getByType(Text),
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    mockImHere.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('the ⋯ button', () => {
    it('is drawn when the job has actions, with the sheet closed', () => {
      const view = draw(job());
      expect(view.getByTestId('job-actions-button')).toBeTruthy();
      expect(view.queryByTestId('job-actions-sheet')).toBeNull();
      // No action is on the card itself: they are all behind the button.
      expect(view.queryByTestId(/^job-action-/)).toBeNull();
      expect(view.queryByText(i18n.t('translations:report_issue'))).toBeNull();
    });

    it.each([OrderStatus.dropped_off, OrderStatus.canceled])(
      'is not drawn at all when there are no actions (%s)',
      status => {
        const view = draw(job({ status }), {
          onCallDispatch: jest.fn(),
          onOpenChat: jest.fn(),
          chatUnseen: false,
        });
        expect(view.queryByTestId('job-actions-button')).toBeNull();
        expect(view.queryByTestId('job-actions-sheet')).toBeNull();
        expect(view.toJSON()).toBeNull();
      },
    );

    it('a screen reader hears a button named "Job actions"', () => {
      const view = draw(job());
      const button = view.getByTestId('job-actions-button');
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe('Job actions');
      expect(
        view.getByLabelText(i18n.t('translations:job_actions_button')),
      ).toBeTruthy();
    });

    // Row 138 review: with the dot, the name says which of the two it is.
    it.each([
      [
        'the hand back',
        { handBackUntilOnPhone: NOW + 45_000 },
        { onHandBack: jest.fn() },
      ],
      [
        'leaving a late restaurant',
        {
          status: OrderStatus.courier_arrived_at_pickup_location,
          leaveFromOnPhone: NOW - 1000,
        },
        { onLeaveWait: jest.fn() },
      ],
      [
        'leaving an unsplit order',
        {
          status: OrderStatus.courier_arrived_at_pickup_location,
          splitRequest: { status: 'OPEN' } as SplitRequest,
          splitLeaveFromOnPhone: NOW - 1000,
        },
        { onLeaveSplit: jest.fn() },
      ],
    ] as const)(
      'with the dot for %s, a screen reader hears that an action is open for a short time',
      (_name, overrides, props) => {
        const view = draw(job(overrides as Partial<Order>), props);
        expect(view.getByTestId('job-actions-button-dot')).toBeTruthy();
        const button = view.getByTestId('job-actions-button');
        expect(button.props.accessibilityRole).toBe('button');
        expect(button.props.accessibilityLabel).toBe(
          'Job actions, one is open for a short time',
        );
        expect(button.props.accessibilityLabel).toBe(
          i18n.t('translations:job_actions_button_timed'),
        );
      },
    );

    it('with the dot for an unread chat only, a screen reader hears that a message is unread', () => {
      const view = draw(job(), { onOpenChat: jest.fn(), chatUnseen: true });
      expect(view.getByTestId('job-actions-button-dot')).toBeTruthy();
      const button = view.getByTestId('job-actions-button');
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe(
        'Job actions, a message is unread',
      );
      expect(button.props.accessibilityLabel).toBe(
        i18n.t('translations:job_actions_button_unread'),
      );
    });

    // The timed action is the one that runs out, so it is the one named.
    it.each([
      [
        'the hand back',
        { handBackUntilOnPhone: NOW + 45_000 },
        { onHandBack: jest.fn() },
      ],
      [
        'leaving a late restaurant',
        {
          status: OrderStatus.courier_arrived_at_pickup_location,
          leaveFromOnPhone: NOW - 1000,
        },
        { onLeaveWait: jest.fn() },
      ],
      [
        'leaving an unsplit order',
        {
          status: OrderStatus.courier_arrived_at_pickup_location,
          splitRequest: { status: 'OPEN' } as SplitRequest,
          splitLeaveFromOnPhone: NOW - 1000,
        },
        { onLeaveSplit: jest.fn() },
      ],
    ] as const)(
      'with %s open and the chat unread as well, the name is the timed one',
      (_name, overrides, props) => {
        const view = draw(job(overrides as Partial<Order>), {
          ...props,
          onOpenChat: jest.fn(),
          chatUnseen: true,
        });
        expect(view.getByTestId('job-actions-button-dot')).toBeTruthy();
        expect(
          view.getByTestId('job-actions-button').props.accessibilityLabel,
        ).toBe('Job actions, one is open for a short time');
      },
    );

    it('when the hand back window closes with the chat still unread, the name turns to the unread one', () => {
      const view = draw(job({ handBackUntilOnPhone: NOW + 3000 }), {
        onHandBack: jest.fn(),
        onOpenChat: jest.fn(),
        chatUnseen: true,
      });
      expect(
        view.getByTestId('job-actions-button').props.accessibilityLabel,
      ).toBe('Job actions, one is open for a short time');

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(view.getByTestId('job-actions-button-dot')).toBeTruthy();
      expect(
        view.getByTestId('job-actions-button').props.accessibilityLabel,
      ).toBe('Job actions, a message is unread');
    });

    it('both languages have the four keys, each with its own words', () => {
      const keys = [
        'job_actions_button',
        'job_actions_button_timed',
        'job_actions_button_unread',
        'job_actions_title',
      ] as const;
      for (const key of keys) {
        expect(typeof en[key]).toBe('string');
        expect(en[key].trim()).not.toBe('');
        expect(typeof el[key]).toBe('string');
        expect(el[key].trim()).not.toBe('');
        // Greek words, not the English ones copied over.
        expect(el[key]).not.toBe(en[key]);
        expect(el[key]).toMatch(/[Ͱ-Ͽ]/);
      }
      // Plain, timed and unread must not sound the same, in either language.
      for (const words of [en, el]) {
        expect(
          new Set([
            words.job_actions_button,
            words.job_actions_button_timed,
            words.job_actions_button_unread,
          ]).size,
        ).toBe(3);
        // Each longer name starts with the plain one, so the button is named first.
        expect(
          words.job_actions_button_timed.startsWith(words.job_actions_button),
        ).toBe(true);
        expect(
          words.job_actions_button_unread.startsWith(words.job_actions_button),
        ).toBe(true);
      }
    });

    it('the one sentence for both cases is gone from both languages', () => {
      expect(Object.keys(en)).not.toContain('job_actions_button_attention');
      expect(Object.keys(el)).not.toContain('job_actions_button_attention');
    });
  });

  describe('the dot on the ⋯ button', () => {
    it('shows while the hand back is available, and goes when its window closes', () => {
      const view = draw(job({ handBackUntilOnPhone: NOW + 3000 }), {
        onHandBack: jest.fn(),
      });
      expect(view.getByTestId('job-actions-button-dot')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(view.queryByTestId('job-actions-button-dot')).toBeNull();
      expect(
        view.getByTestId('job-actions-button').props.accessibilityLabel,
      ).toBe('Job actions');
    });

    it('shows while leaving a late restaurant is available', () => {
      const view = draw(
        job({
          status: OrderStatus.courier_arrived_at_pickup_location,
          leaveFromOnPhone: NOW - 1000,
        }),
        { onLeaveWait: jest.fn() },
      );
      expect(view.getByTestId('job-actions-button-dot')).toBeTruthy();
    });

    it('shows while leaving an unsplit order is available', () => {
      const view = draw(
        job({
          status: OrderStatus.courier_arrived_at_pickup_location,
          splitRequest: { status: 'OPEN' } as SplitRequest,
          splitLeaveFromOnPhone: NOW - 1000,
        }),
        { onLeaveSplit: jest.fn() },
      );
      expect(view.getByTestId('job-actions-button-dot')).toBeTruthy();
    });

    it('shows while the chat is unread, and not once it is read', () => {
      const unread = draw(job(), { onOpenChat: jest.fn(), chatUnseen: true });
      expect(unread.getByTestId('job-actions-button-dot')).toBeTruthy();
      unread.unmount();

      const read = draw(job(), { onOpenChat: jest.fn(), chatUnseen: false });
      expect(read.queryByTestId('job-actions-button-dot')).toBeNull();
    });

    it('does not show for the everyday actions, at any step', () => {
      for (const status of [
        OrderStatus.accepted,
        OrderStatus.dispatched,
        OrderStatus.courier_arrived_at_pickup_location,
        OrderStatus.picked_up,
        OrderStatus.on_the_way,
        OrderStatus.courier_arrived_at_dropoff_location,
      ]) {
        const view = draw(job({ status }), {
          onReportProduct: jest.fn(),
          onCallDispatch: jest.fn(),
          onHandBack: jest.fn(),
          onLeaveWait: jest.fn(),
          onRequestRemoval: jest.fn(),
          onWithdrawRemoval: jest.fn(),
          onRequestSplit: jest.fn(),
          onLeaveSplit: jest.fn(),
          onOpenChat: jest.fn(),
        });
        expect(view.getByTestId('job-actions-button')).toBeTruthy();
        expect(view.queryByTestId('job-actions-button-dot')).toBeNull();
        view.unmount();
      }
    });

    // The footer's Leave appeared by itself when the limit came (spec 0033, AC-6: the card's
    // clock ticked). Behind the button, the dot is the only thing that tells the rider.
    it('comes on by itself when the leave time of a late restaurant arrives, with no prop change', () => {
      const view = draw(
        job({
          status: OrderStatus.courier_arrived_at_pickup_location,
          arrivedAtOnPhone: NOW - 300_000,
          leaveFromOnPhone: NOW + 1000,
        }),
        { onLeaveWait: jest.fn() },
      );
      expect(view.queryByTestId('job-actions-button-dot')).toBeNull();

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(view.getByTestId('job-actions-button-dot')).toBeTruthy();
      openSheet(view);
      expect(keysInSheet(view)).toContain('leave-wait');
    });

    it('comes on by itself when the leave time of an unsplit order arrives, with no prop change', () => {
      const view = draw(
        job({
          status: OrderStatus.courier_arrived_at_pickup_location,
          splitRequest: { status: 'OPEN' } as SplitRequest,
          splitCreatedAtOnPhone: NOW - 60_000,
          splitLeaveFromOnPhone: NOW + 1000,
        }),
        { onLeaveSplit: jest.fn() },
      );
      expect(view.queryByTestId('job-actions-button-dot')).toBeNull();

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(view.getByTestId('job-actions-button-dot')).toBeTruthy();
      openSheet(view);
      expect(keysInSheet(view)).toContain('leave-split');
    });
  });

  describe('the sheet', () => {
    const everything = () => ({
      onReportIssue: jest.fn(),
      onReportProduct: jest.fn(),
      onCallDispatch: jest.fn(),
      onHandBack: jest.fn(),
      onLeaveWait: jest.fn(),
      onRequestRemoval: jest.fn(),
      onWithdrawRemoval: jest.fn(),
      onRequestSplit: jest.fn(),
      onLeaveSplit: jest.fn(),
      onOpenChat: jest.fn(),
    });

    it('opens on a tap, titled "Actions"', () => {
      const view = draw(job());
      openSheet(view);

      const sheet = view.getByTestId('job-actions-sheet');
      expect(
        within(sheet).getByText(i18n.t('translations:job_actions_title')),
      ).toBeTruthy();
      expect(en.job_actions_title).toBe('Actions');
    });

    it('lists exactly the actions of the step, as buttons with their words', () => {
      const view = draw(job({ handBackUntilOnPhone: NOW + 49_000 }), {
        ...everything(),
      });
      openSheet(view);

      expect(keysInSheet(view)).toEqual([
        'here',
        'hand-back',
        'dispatch',
        'chat',
        'report',
      ]);
      const sheet = within(view.getByTestId('job-actions-sheet'));
      expect(sheet.getByText("I'm here")).toBeTruthy();
      expect(sheet.getByText('Hand back · 49 s')).toBeTruthy();
      expect(sheet.getByText('Call dispatch')).toBeTruthy();
      expect(sheet.getByText('Chat')).toBeTruthy();
      expect(sheet.getByText('Report Issue')).toBeTruthy();
    });

    it('at the customer there is no Έφτασα in it', () => {
      for (const status of [
        OrderStatus.picked_up,
        OrderStatus.courier_arrived_at_dropoff_location,
      ]) {
        const view = draw(job({ status }), everything());
        openSheet(view);

        expect(keysInSheet(view)).not.toContain('here');
        expect(view.queryByText(i18n.t('translations:im_here'))).toBeNull();
        view.unmount();
      }
    });

    it('the hand back seconds count down while the sheet is open', () => {
      const view = draw(job({ handBackUntilOnPhone: NOW + 49_000 }), {
        onHandBack: jest.fn(),
      });
      openSheet(view);
      expect(view.getByText('Hand back · 49 s')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(view.getByText('Hand back · 47 s')).toBeTruthy();
    });

    // The pressable inside a sheet row: the thing a screen reader lands on.
    const pressableOf = (view: View, key: string) =>
      within(view.getByTestId(`job-action-${key}`)).UNSAFE_getByType(
        TouchableOpacity,
      );

    it('the chat button carries the unread dot only while the chat is unread', () => {
      const unread = draw(job(), { onOpenChat: jest.fn(), chatUnseen: true });
      openSheet(unread);
      expect(unread.getByTestId('job-action-chat-dot')).toBeTruthy();
      unread.unmount();

      const read = draw(job(), { onOpenChat: jest.fn(), chatUnseen: false });
      openSheet(read);
      expect(read.getByTestId('job-action-chat')).toBeTruthy();
      expect(read.queryByTestId('job-action-chat-dot')).toBeNull();
    });

    // Row 138 review: "unread" is part of the chat button's own name, not a separate thing
    // a screen reader may or may not land on.
    it('while the chat is unread, a screen reader hears "Chat, New message" on the chat button itself', () => {
      const onOpenChat = jest.fn();
      const order = job();
      const view = draw(order, { onOpenChat, chatUnseen: true });
      openSheet(view);

      const chat = pressableOf(view, 'chat');
      expect(chat.props.accessibilityRole).toBe('button');
      expect(chat.props.accessibilityLabel).toBe('Chat, New message');
      expect(chat.props.accessibilityLabel).toBe(
        `${i18n.t('translations:chat')}, ${i18n.t('translations:chat_unread')}`,
      );
      // The dot is only a mark: the unread words are said once, by the button.
      expect(
        view.getByTestId('job-action-chat-dot').props.accessibilityLabel,
      ).toBeUndefined();
      expect(
        view.queryAllByLabelText(i18n.t('translations:chat_unread')),
      ).toHaveLength(0);

      // The thing with that name is the thing that opens the chat.
      fireEvent.press(view.getByLabelText('Chat, New message'));
      expect(onOpenChat).toHaveBeenCalledTimes(1);
      expect(onOpenChat).toHaveBeenCalledWith(order);
    });

    it('with the chat read, the chat button is named by its word alone', () => {
      const view = draw(job(), { onOpenChat: jest.fn(), chatUnseen: false });
      openSheet(view);

      const chat = pressableOf(view, 'chat');
      expect(chat.props.accessibilityRole).toBe('button');
      expect(chat.props.accessibilityLabel).toBeUndefined();
      expect(view.queryByLabelText(/New message/)).toBeNull();
      expect(view.getByRole('button', { name: 'Chat' })).toBeTruthy();
    });

    it('every choice in the sheet is a button named by its own words, the unread chat included', () => {
      const view = draw(job({ handBackUntilOnPhone: NOW + 49_000 }), {
        ...everything(),
        chatUnseen: true,
      });
      openSheet(view);

      const keys = keysInSheet(view);
      expect(keys).toEqual(['here', 'hand-back', 'dispatch', 'chat', 'report']);
      for (const key of keys) {
        const pressable = pressableOf(view, key);
        expect(pressable.props.accessibilityRole).toBe('button');
        if (key !== 'chat') {
          // No other name than the words drawn on it.
          expect(pressable.props.accessibilityLabel).toBeUndefined();
        }
      }
      for (const name of [
        "I'm here",
        'Hand back · 49 s',
        'Call dispatch',
        'Chat, New message',
        'Report Issue',
      ]) {
        expect(view.getByRole('button', { name })).toBeTruthy();
      }
    });

    it.each([
      ['dispatch', 'onCallDispatch', OrderStatus.dispatched, false],
      ['chat', 'onOpenChat', OrderStatus.dispatched, true],
      ['hand-back', 'onHandBack', OrderStatus.dispatched, true],
      ['request-removal', 'onRequestRemoval', OrderStatus.picked_up, true],
      [
        'request-split',
        'onRequestSplit',
        OrderStatus.courier_arrived_at_pickup_location,
        true,
      ],
      [
        'leave-wait',
        'onLeaveWait',
        OrderStatus.courier_arrived_at_pickup_location,
        true,
      ],
      [
        'report-product',
        'onReportProduct',
        OrderStatus.courier_arrived_at_dropoff_location,
        true,
      ],
      ['report', 'onReportIssue', OrderStatus.on_the_way, true],
    ] as const)(
      'choosing %s runs %s once and closes the sheet',
      (key, handler, status, withOrder) => {
        const handlers = everything();
        const order = job({
          status,
          handBackUntilOnPhone:
            status === OrderStatus.dispatched && key === 'hand-back'
              ? NOW + 45_000
              : NOW - 60_000,
          leaveFromOnPhone: NOW - 1000,
        });
        const view = draw(order, handlers);
        openSheet(view);

        choose(view, key);

        expect(handlers[handler]).toHaveBeenCalledTimes(1);
        if (withOrder) {
          expect(handlers[handler]).toHaveBeenCalledWith(order);
        }
        // Only the chosen action ran.
        for (const [name, other] of Object.entries(handlers)) {
          if (name !== handler) {
            expect(other).not.toHaveBeenCalled();
          }
        }
        expect(view.queryByTestId('job-actions-sheet')).toBeNull();
        // The button is still there to open it again.
        expect(view.getByTestId('job-actions-button')).toBeTruthy();
      },
    );

    it('choosing Έφτασα records the arrival for this order and closes the sheet', () => {
      const order = job();
      const view = draw(order);
      openSheet(view);

      choose(view, 'here');

      expect(mockImHere).toHaveBeenCalledTimes(1);
      expect(mockImHere).toHaveBeenCalledWith(order);
      expect(view.queryByTestId('job-actions-sheet')).toBeNull();
    });

    it('choosing Withdraw takes back the open request and closes the sheet', () => {
      const handlers = everything();
      const order = job({
        removalRequest: { id: 'req-1', status: 'OPEN' },
      } as Partial<Order>);
      const view = draw(order, handlers);
      openSheet(view);
      expect(keysInSheet(view)).not.toContain('request-removal');

      choose(view, 'withdraw-removal');

      expect(handlers.onWithdrawRemoval).toHaveBeenCalledTimes(1);
      expect(handlers.onWithdrawRemoval).toHaveBeenCalledWith(order);
      expect(handlers.onRequestRemoval).not.toHaveBeenCalled();
      expect(view.queryByTestId('job-actions-sheet')).toBeNull();
    });

    it('choosing Leave on an unsplit order runs it and closes the sheet', () => {
      const handlers = everything();
      const order = job({
        status: OrderStatus.courier_arrived_at_pickup_location,
        splitRequest: { status: 'OPEN' } as SplitRequest,
        splitLeaveFromOnPhone: NOW - 1000,
      });
      const view = draw(order, handlers);
      openSheet(view);

      choose(view, 'leave-split');

      expect(handlers.onLeaveSplit).toHaveBeenCalledTimes(1);
      expect(handlers.onLeaveSplit).toHaveBeenCalledWith(order);
      expect(handlers.onLeaveWait).not.toHaveBeenCalled();
      expect(view.queryByTestId('job-actions-sheet')).toBeNull();
    });

    it('a hand back on its way cannot be sent again: its button ignores the tap', () => {
      const onHandBack = jest.fn();
      const view = draw(job({ handBackUntilOnPhone: NOW + 45_000 }), {
        onHandBack,
        handingBack: true,
      });
      openSheet(view);

      choose(view, 'hand-back');

      expect(onHandBack).not.toHaveBeenCalled();
    });

    it('a leave on its way cannot be sent again: its button ignores the tap', () => {
      const onLeaveWait = jest.fn();
      const view = draw(
        job({
          status: OrderStatus.courier_arrived_at_pickup_location,
          leaveFromOnPhone: NOW - 1000,
        }),
        { onLeaveWait, leavingWait: true },
      );
      openSheet(view);

      choose(view, 'leave-wait');

      expect(onLeaveWait).not.toHaveBeenCalled();
    });

    it('closes on Android’s Back without running anything', () => {
      const handlers = everything();
      const view = draw(job(), handlers);
      openSheet(view);

      act(() => {
        // Android's Back reaches a Modal as onRequestClose.
        view.UNSAFE_getByType(Modal).props.onRequestClose();
      });

      expect(view.queryByTestId('job-actions-sheet')).toBeNull();
      for (const handler of Object.values(handlers)) {
        expect(handler).not.toHaveBeenCalled();
      }
      expect(mockImHere).not.toHaveBeenCalled();
    });

    it('closes on the ✕ and on a tap outside, without running anything', () => {
      const handlers = everything();
      const view = draw(job(), handlers);

      // Two things are named "Close": the dimmed area behind the sheet, then the ✕.
      for (const index of [0, 1]) {
        openSheet(view);
        const closers = view.getAllByLabelText(i18n.t('translations:close'));
        expect(closers).toHaveLength(2);
        fireEvent.press(closers[index]);
        expect(view.queryByTestId('job-actions-sheet')).toBeNull();
      }

      for (const handler of Object.values(handlers)) {
        expect(handler).not.toHaveBeenCalled();
      }
    });

    it('opens again after a choice, with the same list', () => {
      const view = draw(job(), everything());
      openSheet(view);
      const first = keysInSheet(view);
      choose(view, 'chat');
      expect(view.queryByTestId('job-actions-sheet')).toBeNull();

      openSheet(view);
      expect(keysInSheet(view)).toEqual(first);
    });

    // Row 138 review: the job can end under an open sheet. If its actions come back for the
    // same card (the server refused the step), the sheet must wait for a tap.
    describe('when the actions run out under an open sheet', () => {
      // The same mounted button, drawn again for the job as it is now.
      const drawAgain = (
        view: View,
        order: Order,
        handlers: ReturnType<typeof everything>,
      ) => view.rerender(<JobActionsButton order={order} {...handlers} />);

      it.each([OrderStatus.dropped_off, OrderStatus.canceled])(
        'it goes with the button (%s), and does not open by itself when the actions return',
        status => {
          const handlers = everything();
          const view = draw(job(), handlers);
          openSheet(view);
          expect(view.getByTestId('job-actions-sheet')).toBeTruthy();

          drawAgain(view, job({ status }), handlers);
          expect(view.queryByTestId('job-actions-button')).toBeNull();
          expect(view.queryByTestId('job-actions-sheet')).toBeNull();

          drawAgain(view, job({ status: OrderStatus.on_the_way }), handlers);
          expect(view.getByTestId('job-actions-button')).toBeTruthy();
          expect(view.queryByTestId('job-actions-sheet')).toBeNull();
          expect(view.queryByTestId(/^job-action-[a-z-]+$/)).toBeNull();

          // A tap still opens it, with the returned step's actions.
          openSheet(view);
          expect(keysInSheet(view)).toEqual([
            'dispatch',
            'chat',
            'request-removal',
            'report',
          ]);
          for (const handler of Object.values(handlers)) {
            expect(handler).not.toHaveBeenCalled();
          }
        },
      );

      it('a sheet that was closed stays closed through the same round trip', () => {
        const handlers = everything();
        const view = draw(job(), handlers);

        drawAgain(view, job({ status: OrderStatus.dropped_off }), handlers);
        drawAgain(view, job(), handlers);

        expect(view.getByTestId('job-actions-button')).toBeTruthy();
        expect(view.queryByTestId('job-actions-sheet')).toBeNull();
      });

      it('a change of step that keeps some actions leaves the open sheet open', () => {
        const handlers = everything();
        const view = draw(job(), handlers);
        openSheet(view);

        drawAgain(view, job({ status: OrderStatus.picked_up }), handlers);

        expect(view.getByTestId('job-actions-sheet')).toBeTruthy();
        expect(keysInSheet(view)).not.toContain('here');
        expect(keysInSheet(view)).toContain('report');
      });
    });
  });
});
