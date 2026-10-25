import React, { useState } from 'react';
import {
  View,
  SafeAreaView,
  Text,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { DrawerScreenProp, DrawerScreens } from '@app/navigation/drawer/types';
import { styles } from './PaymentMethods.styles';
import LinearGradient from 'react-native-linear-gradient';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Colors } from '@app/styles/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextField } from '@app/components/TextField/TextField';
import { PaymentTabs } from '@app/components/PaymentTabs/PaymentTabs';
import { PaymentTabItem } from '@app/types/types';
import { Button } from '@app/components/Button/Button';
import { useTranslation } from 'react-i18next';

type Props = DrawerScreenProp<DrawerScreens.PaymentMethods>;

export const PaymentMethods = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const [routingNumber, setRoutingNumber] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cvv, setCvv] = useState<string>('');
  const [zip, setZip] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState<PaymentTabItem>(
    PaymentTabItem.Bank,
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        style={[styles.gradient, { height: top + 100 }]}
        colors={Colors.offlineGradientArray}
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.toggleDrawer()} />
          <Text style={styles.title}>{t('translations:payment_methods')}</Text>
        </View>
        <PaymentTabs
          style={styles.tabs}
          selectedTab={selectedTab}
          onTabSelected={setSelectedTab}
        />
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          <KeyboardAvoidingView>
            {selectedTab === PaymentTabItem.Bank && (
              <>
                <TextField
                  value={routingNumber}
                  placeholder={t('translations:routing_number')}
                  keyboardType="numeric"
                  maxLength={16}
                  onChangeText={setRoutingNumber}
                />
                <TextField
                  value={accountNumber}
                  placeholder={t('translations:account_number')}
                  keyboardType="numeric"
                  maxLength={16}
                  onChangeText={setAccountNumber}
                />
              </>
            )}
            {selectedTab === PaymentTabItem.DirectDebit && (
              <>
                <TextField
                  value={cardNumber}
                  placeholder={t('translations:card_number')}
                  keyboardType="numeric"
                  maxLength={16}
                  onChangeText={setCardNumber}
                />
                <View style={styles.containerHorizontal}>
                  <TextField
                    value={date}
                    style={{ flex: 1, marginRight: 10 }}
                    placeholder="MM/YY"
                    keyboardType="numeric"
                    maxLength={5}
                    onChangeText={setDate}
                  />
                  <TextField
                    value={cvv}
                    style={{ flex: 1 }}
                    placeholder="CVV"
                    keyboardType="numeric"
                    maxLength={3}
                    onChangeText={setCvv}
                  />
                </View>
                <TextField
                  value={zip}
                  placeholder={t('translations:zip_code')}
                  maxLength={5}
                  keyboardType="numeric"
                  onChangeText={setZip}
                />
              </>
            )}
            <Button
              style={styles.buttonSave}
              title={t('translations:save')}
              onPress={() => undefined}
            />
          </KeyboardAvoidingView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};
