import ReactNativeBlobUtil from 'react-native-blob-util';

// Review fix (row 83): the photo picker writes its resized copy of a complaint photo into the app's own
// storage (Android: the cache folder, named rn_image_picker_lib_temp_...; iOS: the temp folder). These
// are photos of incidents, so they leave the phone once they are no longer needed: after a filing, when
// the photo is replaced or removed, and at logout and a session end, like a rider's statements.
// Failures are ignored: the system may have cleared the file already.

const PICKER_PREFIX = 'rn_image_picker_lib_temp_';

// Only the picker's own copies, never a photo in the rider's gallery.
const isPickerCopy = (uri: string): boolean => {
  if (!uri.startsWith('file://')) {
    return false;
  }
  const path = uri.slice('file://'.length);
  const name = path.split('/').pop() ?? '';
  return name.startsWith(PICKER_PREFIX) || path.includes('/tmp/');
};

export const forgetPickedPhoto = async (uri: string | undefined | null) => {
  if (!uri || !isPickerCopy(uri)) {
    return;
  }
  await ReactNativeBlobUtil.fs
    .unlink(decodeURI(uri.slice('file://'.length)))
    .catch(() => undefined);
};

// Every copy the picker left in the cache folder (Android), except the photo still attached (`keepUri`).
// On Android the picker writes two files per pick (its copy of the gallery photo, then the resized one it
// returns), so deleting the returned file alone leaves the first. Also used by the two clear places.
export const clearPickedPhotoFiles = async (
  keepUri?: string | null,
): Promise<void> => {
  const keep = keepUri?.split('/').pop();
  try {
    const dir = ReactNativeBlobUtil.fs.dirs.CacheDir;
    const names = await ReactNativeBlobUtil.fs.ls(dir);
    await Promise.all(
      names
        .filter(name => name.startsWith(PICKER_PREFIX) && name !== keep)
        .map(name =>
          ReactNativeBlobUtil.fs
            .unlink(`${dir}/${name}`)
            .catch(() => undefined),
        ),
    );
  } catch {
    // Nothing to clear.
  }
};

// The photo `dropUri` is no longer needed: it goes (iOS keeps it in the temp folder), and so does every
// other copy in the cache folder but `keepUri`, the photo still attached if there is one.
export const tidyPickedPhotos = async (
  dropUri: string | undefined | null,
  keepUri?: string | null,
): Promise<void> => {
  await forgetPickedPhoto(dropUri);
  await clearPickedPhotoFiles(keepUri);
};
