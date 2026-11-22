import { client } from '@app/services/Client';
import { currentLanguage, type AppLanguage } from './appLanguage';

// Spec 0054 (AC-1): `PUT courier/v1/courier/language` with { language }, stored as the rider's
// `User.language`, which the server words mails in. The phone's own choice always wins: it is sent
// when the rider picks one in Settings and again after every login (decision 47.33).
export const putCourierLanguage = async (
  language: AppLanguage,
): Promise<void> => {
  await client.put('courier/language', { language });
};

/** After a login: tell the server the language this phone shows. Never fails the login. */
export const sendLanguageToServer = (): void => {
  putCourierLanguage(currentLanguage()).catch(error =>
    console.log('Could not send the language to the server', error),
  );
};
