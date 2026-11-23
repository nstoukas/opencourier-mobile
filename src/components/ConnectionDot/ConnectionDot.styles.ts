import { StyleSheet } from 'react-native';
import { radius } from '@app/styles/theme';

export const styles = StyleSheet.create({
  // A square the size of a fingertip's target around the dot, so it sits
  // centred in whatever holds it.
  container: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
  },
  // Every status but a live connection: a hollow ring in the status colour.
  ring: {
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
});
