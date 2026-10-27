import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
  },
  containerOutUntoggled: {
    width: 40,
    height: 40,
    backgroundColor: Colors.white,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray9,
  },
});
