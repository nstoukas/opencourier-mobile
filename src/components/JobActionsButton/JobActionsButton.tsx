import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DotsThreeIcon } from 'phosphor-react-native/src/icons/DotsThree';
import { Icon } from '@app/components/Icon/Icon';
import { Button, ButtonType } from '@app/components/Button/Button';
import { JobSheet } from '@app/components/JobSheet/JobSheet';
import {
  JobActionProps,
  useJobActions,
} from '@app/components/JobFooter/useJobActions';
import { color, control, radius, space } from '@app/styles/theme';

// Row 138 (operator, 23 Nov, like the efood rider app): the job's small actions
// (Έφτασα, Chat, Request removal, Report a problem and the rest) sit behind one
// round ⋯ button at the right of the current stop's address, instead of a row
// of links above the swipe. Tapping it opens a sheet with one full width button
// per action. A dot on the button says something needs the rider now: a timed
// action is open (the free hand back, leaving a late order) or the chat has
// something unread, so neither hides behind the button.
export const JobActionsButton = (props: JobActionProps) => {
  const { t } = useTranslation();
  const { actions, attention } = useJobActions(props);
  // Whether the sheet is open. `useState` keeps it across redraws.
  const [open, setOpen] = useState(false);

  if (actions.length === 0) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          attention
            ? t('translations:job_actions_button_attention')
            : t('translations:job_actions_button')
        }
        testID="job-actions-button">
        <Icon icon={DotsThreeIcon} size={24} weight="bold" />
        {attention ? (
          <View style={styles.dot} testID="job-actions-button-dot" />
        ) : null}
      </TouchableOpacity>
      <JobSheet
        visible={open}
        title={t('translations:job_actions_title')}
        onClose={() => setOpen(false)}
        testID="job-actions-sheet">
        <View style={styles.list}>
          {actions.map(action => (
            <View key={action.key} testID={`job-action-${action.key}`}>
              <Button
                title={action.label}
                type={
                  action.tone === 'destructive'
                    ? ButtonType.redBGRedText
                    : ButtonType.white
                }
                disabled={action.disabled}
                onPress={() => {
                  // Close first, so a screen or a question the action opens is not under the sheet.
                  setOpen(false);
                  action.onPress();
                }}
              />
              {action.dot ? (
                <View
                  style={styles.rowDot}
                  testID={`job-action-${action.key}-dot`}
                  accessibilityLabel={t('translations:chat_unread')}
                />
              ) : null}
            </View>
          ))}
        </View>
      </JobSheet>
    </>
  );
};

const styles = StyleSheet.create({
  // As big as the call and navigate buttons on the card (48, spec 0007).
  button: {
    width: control.xl,
    height: control.xl,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: color.destructive,
  },
  list: {
    gap: space['2'],
  },
  rowDot: {
    position: 'absolute',
    top: space['2'],
    right: space['3'],
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: color.destructive,
  },
});
