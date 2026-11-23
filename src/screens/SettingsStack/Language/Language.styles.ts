import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
  },
  safe: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    marginBottom: 22,
  },
  title: {
    fontSize: typeScale.h1.fontSize,
    fontWeight: '700',
    color: Colors.black1,
    marginLeft: 16,
    // Wraps to a second line rather than running off the screen (long Greek titles).
    flexShrink: 1,
  },
  list: {
    paddingHorizontal: 16,
  },
  explained: {
    fontSize: typeScale.body.fontSize,
    color: Colors.black1,
    marginBottom: 16,
  },
  cell: {
    marginBottom: 16,
  },
});
