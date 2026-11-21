import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform, Share } from 'react-native';
import { client } from '@app/services/Client';
import { apiUrl } from '@app/utilities/config';

// Spec 0050 (row 76): the rider's monthly statements. The server makes the files (the same sums as the
// Earnings screen); the app downloads one into its cache folder and opens the phone's own viewer or share
// sheet (cross check 1). Nothing is kept: the cache folder is the system's to clear.

export type StatementFormat = 'pdf' | 'csv';

// AC-1: the months offered, newest first (complete months since the rider joined).
export const fetchStatementMonths = async (): Promise<string[]> => {
  const { data } = await client.get('earnings/statements');
  return (data.result?.months ?? []) as string[];
};

const MIME: Record<StatementFormat, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
};

// The file's address on the server; `lang` is the app's language (AC-6).
export const statementUrl = (
  month: string,
  format: StatementFormat,
  lang: 'el' | 'en',
): string =>
  `${apiUrl.replace(/\/$/, '')}/earnings/statements/${encodeURIComponent(
    month,
  )}?format=${format}&lang=${lang}`;

// Downloads the statement with this session's token and hands it to the phone. The list request just
// before it went through the usual client, so an expired token has been renewed by then.
export const openStatement = async (
  month: string,
  format: StatementFormat,
  lang: 'el' | 'en',
): Promise<void> => {
  await fetchStatementMonths();
  const token = await AsyncStorage.getItem('token');
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/statement-${month}.${format}`;
  const response = await ReactNativeBlobUtil.config({ path }).fetch(
    'GET',
    statementUrl(month, format, lang),
    token ? { Authorization: `Bearer ${token}` } : {},
  );
  const status = response.info().status;
  if (status !== 200) {
    throw new Error(`Statement download answered ${status}`);
  }
  if (Platform.OS === 'android') {
    // Opens it in the phone's viewer (a PDF reader, a spreadsheet), from where the rider can share it.
    await ReactNativeBlobUtil.android.actionViewIntent(
      response.path(),
      MIME[format],
    );
  } else {
    await Share.share({ url: `file://${response.path()}` });
  }
};
