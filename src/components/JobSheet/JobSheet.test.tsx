import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { JobSheet } from './JobSheet';

describe('JobSheet (spec 0021)', () => {
  it('renders modal content when visible is true', () => {
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <JobSheet
        visible={true}
        title="Test Sheet"
        onClose={onClose}
        testID="job-sheet">
        <Text>Sheet Child Content</Text>
      </JobSheet>,
    );

    expect(getByTestId('job-sheet')).toBeTruthy();
    expect(getByText('Test Sheet')).toBeTruthy();
    expect(getByText('Sheet Child Content')).toBeTruthy();
  });

  it('calls onClose when close button or backdrop is pressed', () => {
    const onClose = jest.fn();
    const { getAllByLabelText } = render(
      <JobSheet
        visible={true}
        title="Test Sheet"
        onClose={onClose}
        testID="job-sheet">
        <Text>Content</Text>
      </JobSheet>,
    );

    const closeElements = getAllByLabelText(i18n.t('translations:close'));
    expect(closeElements.length).toBeGreaterThanOrEqual(2);

    // Press backdrop
    fireEvent.press(closeElements[0]);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Press close button
    fireEvent.press(closeElements[1]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
