import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius } from '@app/styles/theme';

export const styles = StyleSheet.create({
  containerWhite: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderColor: Colors.gray1,
    borderWidth: 1,
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },
  containerBlack: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.black,
    borderColor: Colors.white,
    borderWidth: 1,
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },
  iconBlack: {
    tintColor: Colors.black,
  },
  iconWhite: {
    tintColor: Colors.white,
  },
});
