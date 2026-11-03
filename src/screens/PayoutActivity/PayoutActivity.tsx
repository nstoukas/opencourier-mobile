import React from 'react';
import { View, Text } from 'react-native';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { styles } from './PayoutActivity.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import LinearGradient from 'react-native-linear-gradient';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@app/styles/colors';
import { NoPayoutActivity } from '@app/components/NoPayoutActivity/NoPayoutActivity';

type Props = MainScreenProp<MainScreens.PayoutActivity>;

export const PayoutActivity = ({ navigation }: Props) => {
  const { top } = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <LinearGradient
        style={[styles.gradient, { height: top + 100 }]}
        colors={Colors.offlineGradientArray}
      />
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>Payout Activity</Text>
        </View>
        <NoPayoutActivity />
      </ScreenSafeArea>
    </View>
  );
};
