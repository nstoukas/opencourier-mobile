import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  containerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
  },
  textName: {
    fontWeight: '700',
    fontSize: typeScale.body.fontSize,
    flex: 1,
    marginLeft: 8,
  },
  iconGrayRestaurant: {
    marginLeft: 2,
  },
  buttonCarret: {
    alignItems: 'flex-end',
  },
  iconCaret: {},
});
