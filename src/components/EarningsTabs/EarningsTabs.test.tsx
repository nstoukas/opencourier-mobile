import React from 'react';
import { render } from '@testing-library/react-native';
import { EarningsTabs } from './EarningsTabs';
import { EarningsTabItem } from '@app/types/types';
import '@app/localization/i18n';

describe('EarningsTabs (Row 66, Clause 6)', () => {
  it('renders tabs with React keys and does not log key warning', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <EarningsTabs
        selectedTab={EarningsTabItem.Today}
        onTabSelected={jest.fn()}
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
