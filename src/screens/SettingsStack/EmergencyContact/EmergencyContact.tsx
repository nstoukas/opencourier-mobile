import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { styles } from './EmergencyContact.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useTranslation } from 'react-i18next';
import { TextField } from '@app/components/TextField/TextField';
import { validateEmail } from '@app/utilities/text';
import { Button, ButtonType } from '@app/components/Button/Button';
import { Icon } from '@app/components/Icon/Icon';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { FloppyDiskBackIcon } from 'phosphor-react-native/src/icons/FloppyDiskBack';

type Props = MainScreenProp<MainScreens.EmergencyContact>;

type TextFieldErrors = {
  email: string | undefined;
  firstname: string | undefined;
  lastname: string | undefined;
  phone: string | undefined;
  address: string | undefined;
};

export const EmergencyContact = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string>('');
  const [firstname, setFirstname] = useState<string>('');
  const [lastname, setLastname] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [errors, setErrors] = useState<TextFieldErrors>({
    email: undefined,
    firstname: undefined,
    lastname: undefined,
    phone: undefined,
    address: undefined,
  });

  const validateFields = () => {
    var oldState = errors;

    if (email.length > 0) {
      if (validateEmail(email)) {
        oldState.email = undefined;
      } else {
        oldState.email = 'Email invalid!';
      }
    }

    setErrors(oldState);
  };

  useEffect(() => {
    validateFields();
  }, [email, firstname, lastname, phone, address]);

  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>
            {t('translations:emergency_contact')}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TextField
            error={errors.firstname}
            value={firstname}
            placeholder={t('translations:first_name')}
            onChangeText={setFirstname}
            onBlur={validateFields}
            style={styles.textField}
          />
          <TextField
            error={errors.lastname}
            value={lastname}
            placeholder={t('translations:last_name')}
            onChangeText={setLastname}
            onBlur={validateFields}
            style={styles.textField}
          />
          <TextField
            error={errors.phone}
            value={phone}
            placeholder={t('translations:phone')}
            onChangeText={setPhone}
            onBlur={validateFields}
            style={[styles.textField, { marginBottom: 2 }]}
          />
          <View style={styles.containerHorizontal}>
            <Icon icon={InfoIcon} weight="fill" size={14} />
            <Text style={styles.textInfo}>
              {t('translations:include_code')}
            </Text>
          </View>
          <TextField
            error={errors.email}
            value={email}
            placeholder={t('translations:email')}
            onChangeText={setEmail}
            onBlur={validateFields}
            style={styles.textField}
          />
          <TextField
            error={errors.address}
            value={address}
            placeholder={t('translations:address')}
            onChangeText={setAddress}
            onBlur={validateFields}
            style={styles.textField}
          />
          <Button
            type={ButtonType.green}
            title={t('translations:save')}
            onPress={() => undefined}
            icon={FloppyDiskBackIcon}
            iconWeight="fill"
          />
        </ScrollView>
      </ScreenSafeArea>
    </View>
  );
};
