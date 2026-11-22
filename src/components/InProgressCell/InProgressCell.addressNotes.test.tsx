import React from 'react';
import { render } from '@testing-library/react-native';
import '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import { JobNotesLine } from '@app/components/JobNotesLine/JobNotesLine';
import { InProgressCell } from './InProgressCell';

// Mock JobNotesLine to inspect the props passed to it
jest.mock('@app/components/JobNotesLine/JobNotesLine', () => ({
  JobNotesLine: jest.fn(() => null),
}));

// Spec 0053 (AC-2):
// Address notes can be added, upvoted, flagged, edited and deleted only while the rider holds the job.
// Once the job is over (dropped off, cancelled), addressNotesFor is not passed to JobNotesLine,
// keeping notes plain text.
describe('InProgressCell address notes integration (spec 0053, AC-2)', () => {
  const baseOrder: Order = {
    id: 'del-addr-1',
    status: OrderStatus.dispatched,
    pickupBusinessName: 'Test Kitchen',
    pickupPhoneNumber: '+302421011111',
    dropoffName: 'Customer Test',
    dropoffPhoneNumber: '+306912345678',
    orderItems: [{ name: 'Item', quantity: 1 }],
  } as unknown as Order;

  const noopProps = {
    onCallRestaurant: jest.fn(),
    onCallCustomer: jest.fn(),
    onTextCustomer: jest.fn(),
    onNavigate: jest.fn(),
    onMovePin: jest.fn(),
  };

  const mockAddressNotesFor = jest.fn(() => ({
    onAdd: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onUpvote: jest.fn(),
    onFlag: jest.fn(),
    retentionDays: 182,
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes addressNotes actions to JobNotesLine while job is active', () => {
    const activeStatuses = [
      OrderStatus.accepted,
      OrderStatus.dispatched,
      OrderStatus.courier_arrived_at_pickup_location,
      OrderStatus.picked_up,
      OrderStatus.on_the_way,
      OrderStatus.courier_arrived_at_dropoff_location,
    ];

    for (const status of activeStatuses) {
      jest.clearAllMocks();
      render(
        <InProgressCell
          order={{ ...baseOrder, status } as unknown as Order}
          addressNotesFor={mockAddressNotesFor}
          {...noopProps}
        />,
      );

      expect(JobNotesLine).toHaveBeenCalled();
      const lastCallProps = (JobNotesLine as jest.Mock).mock.calls[0][0];
      expect(lastCallProps.addressNotes).toBeDefined();
    }
  });

  it('withholds addressNotes actions from JobNotesLine when job is over (dropped off or cancelled)', () => {
    const overStatuses = [OrderStatus.dropped_off, OrderStatus.canceled];

    for (const status of overStatuses) {
      jest.clearAllMocks();
      render(
        <InProgressCell
          order={{ ...baseOrder, status } as unknown as Order}
          addressNotesFor={mockAddressNotesFor}
          {...noopProps}
        />,
      );

      expect(JobNotesLine).toHaveBeenCalled();
      const lastCallProps = (JobNotesLine as jest.Mock).mock.calls[0][0];
      expect(lastCallProps.addressNotes).toBeUndefined();
    }
  });
});
