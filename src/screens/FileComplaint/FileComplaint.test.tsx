import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { FileComplaint } from './FileComplaint';
import { useFileComplaint } from '@app/hooks/useComplaints';
import { COMPLAINT_PHOTO_MAX_BYTES } from '@app/services/complaintService';
import { tidyPickedPhotos } from '@app/services/complaintPhotoFiles';

jest.mock('@app/services/complaintPhotoFiles', () => ({
  tidyPickedPhotos: jest.fn(),
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

jest.mock('@app/hooks/useComplaints', () => ({
  useFileComplaint: jest.fn(),
}));

// Spec 0052 (AC-2, AC-9): FileComplaint screen tests.
describe('FileComplaint screen (spec 0052, AC-2, AC-9)', () => {
  const mockNavigation: any = {
    goBack: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
    route: {
      params: {
        deliveryId: 'del-comp-100',
        deliveryLabel: 'Souvlaki Express, 19 Nov',
      },
    },
  };

  let mockMutate: jest.Mock;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockMutate = jest.fn();
    (useFileComplaint as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  describe('Form rendering and intro', () => {
    it('renders intro naming the delivery, both party choices, and disabled Send button', () => {
      render(<FileComplaint {...defaultProps} />);

      expect(
        screen.getByText(
          i18n.t('translations:complaint_intro', {
            delivery: 'Souvlaki Express, 19 Nov',
          }),
        ),
      ).toBeTruthy();

      expect(screen.getByTestId('complaint-about-RESTAURANT')).toBeTruthy();
      expect(screen.getByTestId('complaint-about-CUSTOMER')).toBeTruthy();

      // Send button initially disabled
      const sendButton = screen.getByText(i18n.t('translations:complaint_send'));
      expect(sendButton).toBeTruthy();
      fireEvent.press(sendButton);
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('navigates back when back button pressed', () => {
      render(<FileComplaint {...defaultProps} />);

      const backNav = screen.getByTestId(
        'phosphor-react-native-arrow-left-bold',
      );
      fireEvent.press(backNav);

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Party selection and dynamic categories (AC-1, AC-2)', () => {
    it('selecting The restaurant displays restaurant categories and coop-only restaurant explanation', () => {
      render(<FileComplaint {...defaultProps} />);

      const restChoice = screen.getByTestId('complaint-about-RESTAURANT');
      fireEvent.press(restChoice);

      expect(restChoice.props.accessibilityState.selected).toBe(true);

      // Restaurant categories are shown
      expect(screen.getByTestId('complaint-category-LONG_WAIT')).toBeTruthy();
      expect(screen.getByTestId('complaint-category-FOOD_NOT_READY')).toBeTruthy();
      expect(screen.getByTestId('complaint-category-UNSAFE_PACKAGING')).toBeTruthy();
      expect(screen.getByTestId('complaint-category-RUDE_STAFF')).toBeTruthy();
      expect(screen.getByTestId('complaint-category-OTHER')).toBeTruthy();

      // Customer categories not shown
      expect(screen.queryByTestId('complaint-category-ABUSE_OR_THREAT')).toBeNull();

      // Coop only hint for restaurant
      expect(
        screen.getByText(i18n.t('translations:complaint_only_coop_restaurant')),
      ).toBeTruthy();
    });

    it('selecting The customer displays customer categories and coop-only customer explanation', () => {
      render(<FileComplaint {...defaultProps} />);

      const custChoice = screen.getByTestId('complaint-about-CUSTOMER');
      fireEvent.press(custChoice);

      expect(custChoice.props.accessibilityState.selected).toBe(true);

      // Customer categories shown
      expect(screen.getByTestId('complaint-category-ABUSE_OR_THREAT')).toBeTruthy();
      expect(screen.getByTestId('complaint-category-UNSAFE_ADDRESS')).toBeTruthy();
      expect(screen.getByTestId('complaint-category-NOT_ANSWERING')).toBeTruthy();
      expect(screen.getByTestId('complaint-category-OTHER')).toBeTruthy();

      // Restaurant categories not shown
      expect(screen.queryByTestId('complaint-category-LONG_WAIT')).toBeNull();

      // Coop only hint for customer
      expect(
        screen.getByText(i18n.t('translations:complaint_only_coop_customer')),
      ).toBeTruthy();
    });

    it('changing party selection resets the previously selected category', () => {
      render(<FileComplaint {...defaultProps} />);

      // Select restaurant and LONG_WAIT category
      fireEvent.press(screen.getByTestId('complaint-about-RESTAURANT'));
      const longWait = screen.getByTestId('complaint-category-LONG_WAIT');
      fireEvent.press(longWait);
      expect(longWait.props.accessibilityState.selected).toBe(true);

      // Switch to customer
      fireEvent.press(screen.getByTestId('complaint-about-CUSTOMER'));

      // Switch back to restaurant; category should be cleared
      fireEvent.press(screen.getByTestId('complaint-about-RESTAURANT'));
      const newLongWait = screen.getByTestId('complaint-category-LONG_WAIT');
      expect(newLongWait.props.accessibilityState.selected).toBe(false);
    });
  });

  describe('Text input and validation', () => {
    it('enforces 1000 max character length and updates counter', () => {
      render(<FileComplaint {...defaultProps} />);

      const textInput = screen.getByTestId('complaint-text');
      expect(textInput.props.maxLength).toBe(1000);

      fireEvent.changeText(textInput, 'Short note about the issue');
      expect(screen.getByText('26/1000')).toBeTruthy();
    });

    it('whitespace-only text keeps Send disabled', () => {
      render(<FileComplaint {...defaultProps} />);

      fireEvent.press(screen.getByTestId('complaint-about-RESTAURANT'));
      fireEvent.press(screen.getByTestId('complaint-category-LONG_WAIT'));
      fireEvent.changeText(screen.getByTestId('complaint-text'), '     ');

      const sendButton = screen.getByText(i18n.t('translations:complaint_send'));
      fireEvent.press(sendButton);

      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe('Photo picker (AC-2, AC-9, slice 2)', () => {
    it('launches image library with quality 0.8, maxWidth/maxHeight 1600, photo only and selection limit 1', async () => {
      (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
        didCancel: true,
      });

      render(<FileComplaint {...defaultProps} />);

      const addPhotoButton = screen.getByText(
        i18n.t('translations:complaint_add_photo'),
      );
      await act(async () => {
        fireEvent.press(addPhotoButton);
      });

      expect(launchImageLibrary).toHaveBeenCalledWith({
        mediaType: 'photo',
        selectionLimit: 1,
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
        includeBase64: false,
        includeExtra: false,
      });
    });

    it('cancelling photo picker keeps current state without alerting', async () => {
      (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
        didCancel: true,
      });

      render(<FileComplaint {...defaultProps} />);

      const addPhotoButton = screen.getByText(
        i18n.t('translations:complaint_add_photo'),
      );
      await act(async () => {
        fireEvent.press(addPhotoButton);
      });

      expect(alertSpy).not.toHaveBeenCalled();
      expect(screen.queryByTestId('complaint-photo-thumb')).toBeNull();
    });

    it('shows complaint_photo_failed alert when picker returns errorCode', async () => {
      (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
        errorCode: 'permission',
      });

      render(<FileComplaint {...defaultProps} />);

      const addPhotoButton = screen.getByText(
        i18n.t('translations:complaint_add_photo'),
      );
      await act(async () => {
        fireEvent.press(addPhotoButton);
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:complaint_photo_failed'),
      );
      expect(screen.queryByTestId('complaint-photo-thumb')).toBeNull();
    });

    it('catches picker rejection and shows complaint_photo_failed alert (row 83 review)', async () => {
      (launchImageLibrary as jest.Mock).mockRejectedValueOnce(
        new Error('Native picker error'),
      );

      render(<FileComplaint {...defaultProps} />);

      const addPhotoButton = screen.getByText(
        i18n.t('translations:complaint_add_photo'),
      );
      await act(async () => {
        fireEvent.press(addPhotoButton);
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:complaint_photo_failed'),
      );
      expect(screen.queryByTestId('complaint-photo-thumb')).toBeNull();
    });

    it('shows complaint_photo_too_big alert when photo fileSize exceeds 5 MB and tidies photo (AC-2, AC-9, row 83 review)', async () => {
      (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            uri: 'file:///path/to/big.jpg',
            fileSize: COMPLAINT_PHOTO_MAX_BYTES + 1, // 5MB + 1 byte
            type: 'image/jpeg',
          },
        ],
      });

      render(<FileComplaint {...defaultProps} />);

      const addPhotoButton = screen.getByText(
        i18n.t('translations:complaint_add_photo'),
      );
      await act(async () => {
        fireEvent.press(addPhotoButton);
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:complaint_photo_too_big'),
      );
      expect(tidyPickedPhotos).toHaveBeenCalledWith(
        'file:///path/to/big.jpg',
        undefined,
      );
      expect(screen.queryByTestId('complaint-photo-thumb')).toBeNull();
    });

    it('attaches valid photo, displays thumbnail, tidies on removal, and tidies on replacement (row 83 review)', async () => {
      (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            uri: 'file:///data/user/0/cache/picked.jpg',
            fileSize: 2 * 1024 * 1024,
            type: 'image/jpeg',
          },
        ],
      });

      render(<FileComplaint {...defaultProps} />);

      const addPhotoButton = screen.getByText(
        i18n.t('translations:complaint_add_photo'),
      );
      await act(async () => {
        fireEvent.press(addPhotoButton);
      });

      // Thumbnail displayed
      const thumb = screen.getByTestId('complaint-photo-thumb');
      expect(thumb).toBeTruthy();
      expect(thumb.props.source).toEqual({
        uri: 'file:///data/user/0/cache/picked.jpg',
      });
      expect(tidyPickedPhotos).toHaveBeenCalledWith(
        undefined,
        'file:///data/user/0/cache/picked.jpg',
      );

      // Replace photo with another photo
      (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            uri: 'file:///data/user/0/cache/replacement.jpg',
            fileSize: 1024 * 1024,
            type: 'image/jpeg',
          },
        ],
      });

      const changePhotoButton = screen.getByText(
        i18n.t('translations:complaint_change_photo'),
      );
      await act(async () => {
        fireEvent.press(changePhotoButton);
      });

      // The old photo is tidied
      expect(tidyPickedPhotos).toHaveBeenCalledWith(
        'file:///data/user/0/cache/picked.jpg',
        'file:///data/user/0/cache/replacement.jpg',
      );

      // Remove photo button
      const removeButton = screen.getByTestId('complaint-photo-remove');
      expect(removeButton).toBeTruthy();

      fireEvent.press(removeButton);

      // Removed photo is tidied
      expect(tidyPickedPhotos).toHaveBeenCalledWith(
        'file:///data/user/0/cache/replacement.jpg',
      );

      // Photo removed; Add photo button returns
      expect(screen.queryByTestId('complaint-photo-thumb')).toBeNull();
      expect(
        screen.getByText(i18n.t('translations:complaint_add_photo')),
      ).toBeTruthy();
    });

    it('cleans up picked photo on unmount when leaving form unsent (row 83 review)', async () => {
      (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            uri: 'file:///cache/rn_image_picker_lib_temp_unsent.jpg',
            fileSize: 1024 * 1024,
            type: 'image/jpeg',
          },
        ],
      });

      const { unmount } = render(<FileComplaint {...defaultProps} />);

      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:complaint_add_photo')),
        );
      });

      (tidyPickedPhotos as jest.Mock).mockClear();

      // Rider leaves form without submitting
      unmount();

      expect(tidyPickedPhotos).toHaveBeenCalledWith(
        'file:///cache/rn_image_picker_lib_temp_unsent.jpg',
      );
    });

    it('does not clean up photo on unmount when mutation is in flight (handled by hook)', async () => {
      (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            uri: 'file:///cache/rn_image_picker_lib_temp_uploading.jpg',
            fileSize: 1024 * 1024,
            type: 'image/jpeg',
          },
        ],
      });

      const { rerender, unmount } = render(<FileComplaint {...defaultProps} />);

      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:complaint_add_photo')),
        );
      });

      (tidyPickedPhotos as jest.Mock).mockClear();

      // Mutation starts in flight
      (useFileComplaint as jest.Mock).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      });
      rerender(<FileComplaint {...defaultProps} />);

      // Screen unmounts during active upload
      unmount();

      expect(tidyPickedPhotos).not.toHaveBeenCalled();

      // Restore mock for subsequent tests
      (useFileComplaint as jest.Mock).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });
    });

    it('correctly sets PNG mime type and name when image is PNG', async () => {
      (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            uri: 'file:///cache/screenshot.png',
            fileSize: 1024,
            type: 'image/png',
          },
        ],
      });

      render(<FileComplaint {...defaultProps} />);

      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:complaint_add_photo')),
        );
      });

      expect(screen.getByTestId('complaint-photo-thumb')).toBeTruthy();

      // Fill remaining fields and submit to verify payload
      fireEvent.press(screen.getByTestId('complaint-about-CUSTOMER'));
      fireEvent.press(screen.getByTestId('complaint-category-NOT_ANSWERING'));
      fireEvent.changeText(screen.getByTestId('complaint-text'), 'No answer');

      fireEvent.press(screen.getByText(i18n.t('translations:complaint_send')));

      expect(mockMutate).toHaveBeenCalledWith(
        {
          deliveryId: 'del-comp-100',
          about: 'CUSTOMER',
          category: 'NOT_ANSWERING',
          text: 'No answer',
          photo: {
            uri: 'file:///cache/screenshot.png',
            type: 'image/png',
            name: 'photo.png',
          },
        },
        expect.any(Object),
      );
    });
  });

  describe('Form submission and success flow (AC-2)', () => {
    it('submits complaint with trimmed text and navigates back on success (alert shown by hook)', () => {
      render(<FileComplaint {...defaultProps} />);

      fireEvent.press(screen.getByTestId('complaint-about-RESTAURANT'));
      fireEvent.press(screen.getByTestId('complaint-category-LONG_WAIT'));
      fireEvent.changeText(
        screen.getByTestId('complaint-text'),
        '   Waited for 25 minutes after arrived   ',
      );

      const sendButton = screen.getByText(i18n.t('translations:complaint_send'));
      fireEvent.press(sendButton);

      expect(mockMutate).toHaveBeenCalledWith(
        {
          deliveryId: 'del-comp-100',
          about: 'RESTAURANT',
          category: 'LONG_WAIT',
          text: 'Waited for 25 minutes after arrived',
          photo: null,
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );

      // Trigger onSuccess callback: the hook handles the alert, screen only navigates back
      const { onSuccess } = mockMutate.mock.calls[0][1];
      act(() => {
        onSuccess();
      });

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });
});
