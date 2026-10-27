import React from 'react';
import { render } from '@testing-library/react-native';
import { InProgressNotes } from './InProgressNotes';
import { Order, Note } from '@app/types/types';
import '@app/localization/i18n';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('@app/hooks/useUser', () => () => ({
  user: { id: 'courier-1' },
}));

jest.mock('@app/hooks/useComment', () => () => ({
  createComment: jest.fn(),
}));

describe('InProgressNotes (Row 66, Clause 6)', () => {
  const dummyOrder = { id: 'order-1' } as Order;

  it('renders string notes with React keys and logs no key warning', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <InProgressNotes
        order={dummyOrder}
        notes={['Ring buzzer 4B', 'Gate code 1234', 'Leave at door']}
        headerTitle="Delivery instructions"
        expanded={true}
        noteCreationDisabled={true}
      />,
    );

    const keyWarnings = errorSpy.mock.calls.filter(call =>
      call.some(
        arg => typeof arg === 'string' && arg.includes('unique "key" prop'),
      ),
    );
    expect(keyWarnings).toHaveLength(0);

    errorSpy.mockRestore();
  });

  it('renders Note objects with id keys and logs no key warning', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const objectNotes: Note[] = [
      { id: 'note-1', text: 'Call on arrival' } as any,
      { id: 'note-2', text: 'Side entrance' } as any,
    ];

    render(
      <InProgressNotes
        order={dummyOrder}
        notes={objectNotes}
        headerTitle="Building notes"
        expanded={true}
        noteCreationDisabled={true}
      />,
    );

    const keyWarnings = errorSpy.mock.calls.filter(call =>
      call.some(
        arg => typeof arg === 'string' && arg.includes('unique "key" prop'),
      ),
    );
    expect(keyWarnings).toHaveLength(0);

    errorSpy.mockRestore();
  });
});
