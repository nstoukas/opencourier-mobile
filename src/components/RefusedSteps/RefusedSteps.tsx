import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOutboxItems } from '@app/hooks/useJobStepOutbox';
import { dismissRefused, OutboxItem } from '@app/services/jobStepOutbox';
import { JOB_STEP_LABEL_KEY } from '@app/utilities/jobSteps';
import { touchRow } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { styles } from './RefusedSteps.styles';

type Props = {
  // The logged in rider: only their refused steps are shown.
  courierId: string | undefined;
};

// One card per delivery whose job step the server refused while it waited for
// signal (spec 0009, AC-6): it names the restaurant and the step, and tells
// the rider to call the co-op. It stays until the rider closes it.
export const RefusedSteps = ({ courierId }: Props) => {
  const { t } = useTranslation();
  const items = useOutboxItems();

  // The first refused step of each delivery: the later ones were refused with it.
  const firstRefused: OutboxItem[] = [];
  for (const item of items) {
    if (
      item.courierId === courierId &&
      item.state === 'refused' &&
      !firstRefused.some(seen => seen.deliveryId === item.deliveryId)
    ) {
      firstRefused.push(item);
    }
  }

  if (firstRefused.length === 0) {
    return null;
  }

  return (
    <View style={styles.list}>
      {firstRefused.map(item => (
        <View key={item.id} style={styles.card} accessibilityRole="alert">
          <Icon icon={WarningIcon} size={20} tone="destructive" />
          <Text style={styles.text}>
            {t('translations:step_refused_body', {
              restaurant: item.restaurantName,
              step: t(JOB_STEP_LABEL_KEY[item.step]),
            })}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={[touchRow, styles.closeButton]}
            onPress={() => dismissRefused(item.deliveryId)}>
            <Text style={styles.close}>
              {t('translations:step_refused_close')}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};
