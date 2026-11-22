import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  forgetPickedPhoto,
  clearPickedPhotoFiles,
  tidyPickedPhotos,
} from './complaintPhotoFiles';

// Spec 0052, review ruling of 2026-11-22 (row 83): picker copies of complaint photos leave the phone.
// Android writes two files per pick into cache (raw gallery copy + resized copy).
// iOS stores resized copies in temp directory.
describe('complaintPhotoFiles cleanup (spec 0052, row 83 review)', () => {
  const blob = jest.mocked(ReactNativeBlobUtil);
  const mockLs = blob.fs.ls as jest.Mock;
  const mockUnlink = blob.fs.unlink as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLs.mockResolvedValue([]);
    mockUnlink.mockResolvedValue(undefined);
  });

  describe('forgetPickedPhoto', () => {
    it('does nothing when uri is null, undefined, or empty', async () => {
      await forgetPickedPhoto(null);
      await forgetPickedPhoto(undefined);
      await forgetPickedPhoto('');

      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('does not delete gallery photos or non-file URIs', async () => {
      // Content URI (Android system photo picker)
      await forgetPickedPhoto('content://media/external/images/media/1234');
      // Regular gallery file path without picker prefix or tmp directory
      await forgetPickedPhoto('file:///storage/emulated/0/DCIM/Camera/IMG_20261122.jpg');

      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('unlinks picker temporary copy starting with rn_image_picker_lib_temp_', async () => {
      const pickerUri = 'file:///cache/rn_image_picker_lib_temp_abc123.jpg';
      await forgetPickedPhoto(pickerUri);

      expect(mockUnlink).toHaveBeenCalledWith('/cache/rn_image_picker_lib_temp_abc123.jpg');
    });

    it('unlinks picker temporary copy in iOS tmp directory', async () => {
      const iosTmpUri = 'file:///var/mobile/Containers/Data/Application/tmp/picked.jpg';
      await forgetPickedPhoto(iosTmpUri);

      expect(mockUnlink).toHaveBeenCalledWith('/var/mobile/Containers/Data/Application/tmp/picked.jpg');
    });

    it('decodes encoded characters in URI before unlinking', async () => {
      const encodedUri = 'file:///cache/rn_image_picker_lib_temp_%20spaced.jpg';
      await forgetPickedPhoto(encodedUri);

      expect(mockUnlink).toHaveBeenCalledWith('/cache/rn_image_picker_lib_temp_ spaced.jpg');
    });

    it('swallows unlink errors without throwing', async () => {
      mockUnlink.mockRejectedValueOnce(new Error('ENOENT: file not found'));

      await expect(
        forgetPickedPhoto('file:///cache/rn_image_picker_lib_temp_missing.jpg'),
      ).resolves.toBeUndefined();
    });
  });

  describe('clearPickedPhotoFiles', () => {
    it('deletes every picker file in cache directory while ignoring other cache files', async () => {
      mockLs.mockResolvedValueOnce([
        'rn_image_picker_lib_temp_photo1.jpg',
        'rn_image_picker_lib_temp_photo2.png',
        'statement-2026-10.pdf',
        'http-cache-001',
      ]);

      await clearPickedPhotoFiles();

      expect(mockLs).toHaveBeenCalledWith('/cache');
      expect(mockUnlink).toHaveBeenCalledTimes(2);
      expect(mockUnlink).toHaveBeenCalledWith('/cache/rn_image_picker_lib_temp_photo1.jpg');
      expect(mockUnlink).toHaveBeenCalledWith('/cache/rn_image_picker_lib_temp_photo2.png');
    });

    it('preserves the file matching keepUri', async () => {
      mockLs.mockResolvedValueOnce([
        'rn_image_picker_lib_temp_first_copy.jpg',
        'rn_image_picker_lib_temp_kept.jpg',
      ]);

      // keepUri matches rn_image_picker_lib_temp_kept.jpg
      await clearPickedPhotoFiles('file:///cache/rn_image_picker_lib_temp_kept.jpg');

      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith('/cache/rn_image_picker_lib_temp_first_copy.jpg');
      expect(mockUnlink).not.toHaveBeenCalledWith('/cache/rn_image_picker_lib_temp_kept.jpg');
    });

    it('swallows ls errors without throwing', async () => {
      mockLs.mockRejectedValueOnce(new Error('EACCES: permission denied'));

      await expect(clearPickedPhotoFiles()).resolves.toBeUndefined();
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('swallows individual unlink errors without throwing', async () => {
      mockLs.mockResolvedValueOnce(['rn_image_picker_lib_temp_busy.jpg']);
      mockUnlink.mockRejectedValueOnce(new Error('EBUSY'));

      await expect(clearPickedPhotoFiles()).resolves.toBeUndefined();
    });
  });

  describe('tidyPickedPhotos', () => {
    it('drops dropUri and clears other picker cache copies except keepUri', async () => {
      mockLs.mockResolvedValueOnce([
        'rn_image_picker_lib_temp_intermediate.jpg',
        'rn_image_picker_lib_temp_keep.jpg',
      ]);

      const dropUri = 'file:///var/mobile/Containers/tmp/dropped.jpg';
      const keepUri = 'file:///cache/rn_image_picker_lib_temp_keep.jpg';

      await tidyPickedPhotos(dropUri, keepUri);

      // Drops the dropUri
      expect(mockUnlink).toHaveBeenCalledWith('/var/mobile/Containers/tmp/dropped.jpg');
      // Cleans cache except keepUri
      expect(mockUnlink).toHaveBeenCalledWith('/cache/rn_image_picker_lib_temp_intermediate.jpg');
      expect(mockUnlink).not.toHaveBeenCalledWith('/cache/rn_image_picker_lib_temp_keep.jpg');
    });
  });
});
