import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xl,
    backgroundColor: Colors.white,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    marginRight: 6,
  },
  label: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '600',
    color: Colors.black1,
  },
});
