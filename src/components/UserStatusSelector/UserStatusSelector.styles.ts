import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  containerLeft: {
    borderWidth: 1,
    borderColor: Colors.gray4,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  containerMiddle: {
    borderWidth: 1,
    borderColor: Colors.gray4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerRight: {
    borderWidth: 1,
    borderColor: Colors.gray4,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Each of the three takes an equal share of the menu's width (row 47).
  item: {
    flex: 1,
  },
  // The bordered box fills its share, so the three are as tall as the tallest.
  segment: {
    flex: 1,
  },
  text: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '500',
    color: Colors.gray3,
    textAlign: 'center',
    marginHorizontal: 4,
    marginVertical: 10,
  },
});
