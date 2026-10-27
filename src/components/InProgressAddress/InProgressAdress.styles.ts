import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  containerAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  textAddress: {
    fontSize: typeScale.body.fontSize,
    marginRight: 8,
    lineHeight: typeScale.body.lineHeight,
    flex: 1,
  },
  buttonAddress: {
    width: 32,
    height: 32,
    backgroundColor: Colors.gray7,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
