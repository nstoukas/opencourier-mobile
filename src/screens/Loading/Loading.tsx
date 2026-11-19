import React, { useEffect, useState } from 'react';
import { View, Image } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { RootScreen, RootScreenProp } from '@app/navigation/types';
import { Images } from '@app/utilities/images';
import { styles } from './Loading.styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useUser from '@app/hooks/useUser';

type Props = RootScreenProp<RootScreen.Loading>;

export const LoadingScreen = ({ navigation }: Props) => {
  const [token, setToken] = useState<string>();

  const { user } = useUser(token !== undefined);

  useEffect(() => {
    checkForToken();
  }, []);

  const checkForToken = async () => {
    // The server address is fixed by the build (row 17, spec 0039), so a saved login is all that
    // is needed to go on.
    const savedToken = await AsyncStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
    } else {
      // Replaced, not navigated to: the logo screen leaves the history, so Back on Login leaves the app
      // instead of landing on this screen with no way on (review of 2026-11-19). `StackActions.replace`
      // builds that step; this screen's navigation type has no `replace` of its own.
      navigation.dispatch(StackActions.replace(RootScreen.Auth));
    }
  };

  return (
    <View style={styles.container}>
      <Image source={Images.Logo} />
    </View>
  );
};
