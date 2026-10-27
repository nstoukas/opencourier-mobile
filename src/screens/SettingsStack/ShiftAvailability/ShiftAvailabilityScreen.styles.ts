import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

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
  },
  list: {
    paddingHorizontal: 16,
  },
  org: {
    backgroundColor: Colors.gray24,
    borderRadius: radius.xl,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  iconOrg: {
    width: 26,
    height: 26,
  },
  textOrg: {
    fontSize: typeScale.h2.fontSize,
    fontWeight: '700',
    color: Colors.black1,
    marginLeft: 6,
    flex: 1,
  },
});
