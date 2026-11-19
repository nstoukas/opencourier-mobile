import React, { useEffect, useState } from 'react';
import { View, Image } from 'react-native';
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
      navigation.navigate(RootScreen.Auth);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={Images.Logo} />
    </View>
  );
};
