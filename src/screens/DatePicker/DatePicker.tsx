import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { styles } from './DatePicker.styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootScreen, RootScreenProp } from '@app/navigation/types';
import { useTranslation } from 'react-i18next';
import DatePicker from 'react-native-date-picker';
import { touchRow } from '@app/utilities/touch';

type Props = RootScreenProp<RootScreen.DatePickerScreen>;

export const DatePickerScreen = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const { startOrEndShift, day, onSelect } = route.params;
  const [selected, setSelected] = useState<Date>(new Date());

  const handleSelect = () => {
    if (selected !== undefined) {
      onSelect(selected, startOrEndShift, day);
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingBottom: bottom }]}>
        <TouchableOpacity style={touchRow} onPress={handleSelect}>
          <Text style={styles.textDone}>{t('translations:done')}</Text>
        </TouchableOpacity>
        <DatePicker mode={'time'} date={selected} onDateChange={setSelected} />
      </View>
    </View>
  );
};
