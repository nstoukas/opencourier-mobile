import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radius['2xl'],
    borderColor: Colors.gray9,
    backgroundColor: Colors.white,
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    marginTop: 16,
  },
  containerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  textReport: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
    lineHeight: typeScale.body.lineHeight,
    color: Colors.black1,
    flex: 1,
  },
  textReportDetails: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '600',
    lineHeight: typeScale['body-sm'].lineHeight,
    color: Colors.black6,
    marginBottom: 16,
  },
  iconInfo: {
    width: 24,
    height: 24,
    marginRight: 16,
  },
  containerRight: {
    flexDirection: 'row',
  },
  contentRight: { flex: 1 },
});
