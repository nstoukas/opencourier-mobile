import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import { JobFooter } from './JobFooter';

jest.mock('@app/hooks/useOrder', () => () => ({
  imHere: jest.fn().mockResolvedValue(true),
  pickedUp: jest.fn().mockResolvedValue(true),
  delivered: jest.fn().mockResolvedValue(true),
}));

describe('JobFooter chat action (spec 0034, AC-12)', () => {
  const activeOrder: Order = {
    id: 'del-job-1',
    status: OrderStatus.dispatched,
    pickupBusinessName: 'Acropolis Grill',
  } as unknown as Order;

  it('shows Chat action beside Call dispatch when onOpenChat is given, EVEN with no onCallDispatch (no dispatch number)', () => {
    const onOpenChat = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <JobFooter
        order={activeOrder}
        onReportIssue={jest.fn()}
        onOpenChat={onOpenChat}
        // No onCallDispatch provided
      />,
    );

    // Call dispatch action is not shown because onCallDispatch is omitted
    expect(queryByTestId('job-action-dispatch')).toBeNull();

    // Chat action is still shown with testID job-action-chat
    const chatButton = getByTestId('job-action-chat');
    expect(chatButton).toBeTruthy();

    fireEvent.press(chatButton);
    expect(onOpenChat).toHaveBeenCalledTimes(1);
    expect(onOpenChat).toHaveBeenCalledWith(activeOrder);
  });

  it('shows both Call dispatch and Chat actions when both onCallDispatch and onOpenChat are given', () => {
    const onCallDispatch = jest.fn();
    const onOpenChat = jest.fn();
    const { getByTestId } = render(
      <JobFooter
        order={activeOrder}
        onReportIssue={jest.fn()}
        onCallDispatch={onCallDispatch}
        onOpenChat={onOpenChat}
      />,
    );

    expect(getByTestId('job-action-dispatch')).toBeTruthy();
    expect(getByTestId('job-action-chat')).toBeTruthy();
  });

  it('hides Chat action once the job is over (e.g. dropped_off)', () => {
    const onOpenChat = jest.fn();
    const finishedOrder: Order = {
      ...activeOrder,
      status: OrderStatus.dropped_off,
    };

    const { queryByTestId } = render(
      <JobFooter
        order={finishedOrder}
        onReportIssue={jest.fn()}
        onOpenChat={onOpenChat}
      />,
    );

    expect(queryByTestId('job-action-chat')).toBeNull();
  });

  it('draws the unread dot (job-action-chat-dot) only when chatUnseen is true', () => {
    const onOpenChat = jest.fn();

    // When chatUnseen is true -> dot is present
    const { getByTestId: getUnseen } = render(
      <JobFooter
        order={activeOrder}
        onReportIssue={jest.fn()}
        onOpenChat={onOpenChat}
        chatUnseen={true}
      />,
    );
    expect(getUnseen('job-action-chat-dot')).toBeTruthy();

    // When chatUnseen is false or undefined -> dot is absent
    const { queryByTestId: querySeen } = render(
      <JobFooter
        order={activeOrder}
        onReportIssue={jest.fn()}
        onOpenChat={onOpenChat}
        chatUnseen={false}
      />,
    );
    expect(querySeen('job-action-chat-dot')).toBeNull();
  });
});
