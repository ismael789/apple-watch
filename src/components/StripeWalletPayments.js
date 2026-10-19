/* eslint-disable react/jsx-one-expression-per-line, react/prop-types */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import * as Linking from 'expo-linking';

import { readStored, writeStored } from '../storage';
import { getSupabaseClient } from '../services/supabase';
import {
  getWalletAccessToken,
  isValidWalletAccessToken,
  removeWalletAccessToken,
  saveWalletAccessToken,
} from '../services/walletAccess';

const PRODUCTS = [
  {
    id: 'school_material',
    name: 'Material escolar',
    displayAmount: '$10.00 MXN',
  },
  {
    id: 'watch_accessory',
    name: 'Accesorio educativo',
    displayAmount: '$12.99 MXN',
  },
];

const RETURN_URL = Linking.createURL('stripe-redirect');

const createAttemptKey = () =>
  `watch-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;

const wait = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const errorMessage = async error => {
  if (error && error.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json();
      if (body && body.error) return body.error;
    } catch (_error) {
      // Supabase can return a response without a JSON body.
    }
  }
  return error && error.message
    ? error.message
    : 'No se pudo conectar con el servicio de pagos.';
};

const invokeFunction = async (name, body, accessToken, retries = 0) => {
  try {
    const { data, error } = await getSupabaseClient().functions.invoke(name, {
      body,
      headers: { 'x-wallet-access-token': accessToken },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    if (retries > 0) {
      await wait(350);
      return invokeFunction(name, body, accessToken, retries - 1);
    }
    throw new Error(await errorMessage(error));
  }
};

const statusText = status => {
  if (status === 'processing') return 'Stripe sigue procesando el pago.';
  if (status === 'canceled') {
    return 'Stripe confirma que el pago fue cancelado.';
  }
  if (status === 'requires_payment_method') {
    return 'El pago no se completó; puedes intentar con otro método.';
  }
  if (status === 'requires_action') {
    return 'Stripe solicita una verificación adicional.';
  }
  return `Stripe informa: ${status}`;
};

const StripeWalletPayments = ({ sideButtonSignal }) => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [selected, setSelected] = useState(null);
  const [armed, setArmed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [pending, setPending] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [accessDraft, setAccessDraft] = useState('');
  const [accessReady, setAccessReady] = useState(false);
  const seenSignal = useRef(sideButtonSignal);

  useEffect(() => {
    Promise.all([
      readStored('stripeTransactions', []),
      readStored('stripePendingAttempt', null),
      getWalletAccessToken(),
    ])
      .then(([savedTransactions, savedPending, savedAccessToken]) => {
        setTransactions(savedTransactions);
        setPending(savedPending);
        setAccessToken(savedAccessToken);
      })
      .catch(() => setMessage('No se pudo abrir la configuración segura.'))
      .finally(() => setAccessReady(true));
  }, []);

  const verifyPayment = async paymentIntentId => {
    if (!accessToken) throw new Error('Configura la clave personal de Wallet.');
    const result = await invokeFunction(
      'verify-payment-intent',
      { paymentIntentId },
      accessToken,
      1,
    );
    if (result.status !== 'succeeded') {
      if (result.status === 'canceled') {
        setPending(null);
        await writeStored('stripePendingAttempt', null);
      }
      setMessage(statusText(result.status));
      return false;
    }
    const transaction = {
      id: result.paymentIntentId,
      amount: result.amount,
      currency: result.currency,
      description: result.description,
      status: result.status,
      paymentMethod: result.paymentMethod,
      date: new Date(result.created * 1000).toISOString(),
    };
    const current = await readStored('stripeTransactions', []);
    const next = [
      transaction,
      ...current.filter(item => item.id !== transaction.id),
    ].slice(0, 30);
    setTransactions(next);
    setPending(null);
    await Promise.all([
      writeStored('stripeTransactions', next),
      writeStored('stripePendingAttempt', null),
    ]);
    setMessage('Pago de prueba confirmado directamente por Stripe');
    return true;
  };

  const performPayment = async () => {
    if (!selected || processing) return;
    if (!accessToken) {
      setMessage('Configura la clave personal de Wallet.');
      return;
    }
    setProcessing(true);
    setMessage('Conectando con Stripe…');
    let attempt = pending;
    try {
      if (!attempt || attempt.productId !== selected.id) {
        const operationId = createAttemptKey();
        const result = await invokeFunction(
          'create-payment-intent',
          { operationId, productId: selected.id },
          accessToken,
          1,
        );
        attempt = { ...result, productId: selected.id };
        setPending(attempt);
        await writeStored('stripePendingAttempt', attempt);
      }

      const initialized = await initPaymentSheet({
        merchantDisplayName: 'Watch Home · Pruebas',
        paymentIntentClientSecret: attempt.clientSecret,
        allowsDelayedPaymentMethods: false,
        returnURL: RETURN_URL,
      });
      if (initialized.error) throw new Error(initialized.error.message);
      const presented = await presentPaymentSheet();
      if (presented.error) {
        if (presented.error.code === 'Canceled') {
          setMessage('Pago cancelado en el teléfono');
        } else {
          await verifyPayment(attempt.paymentIntentId);
        }
        return;
      }
      await verifyPayment(attempt.paymentIntentId);
    } catch (error) {
      setMessage(error && error.message ? error.message : 'Error de conexión.');
    } finally {
      setProcessing(false);
      setArmed(false);
    }
  };

  useEffect(() => {
    if (sideButtonSignal === seenSignal.current) return;
    seenSignal.current = sideButtonSignal;
    if (!armed || !selected || processing) return;
    Alert.alert(
      'Confirmar pago de prueba',
      `${selected.name} · ${selected.displayAmount}`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => setArmed(false) },
        { text: 'Continuar', onPress: performPayment },
      ],
    );
  }, [armed, processing, selected, sideButtonSignal]);

  const saveAccess = async () => {
    try {
      const saved = await saveWalletAccessToken(accessDraft);
      setAccessToken(saved);
      setAccessDraft('');
      setMessage('Acceso personal de Wallet guardado en este dispositivo.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const forgetAccess = async () => {
    await removeWalletAccessToken();
    setAccessToken('');
    setAccessDraft('');
    setArmed(false);
    setMessage('Acceso personal eliminado de este dispositivo.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>STRIPE TEST MODE</Text>
      {accessReady && !accessToken && (
        <View style={styles.accessPanel}>
          <Text style={styles.accessTitle}>Acceso personal de Wallet</Text>
          <Text style={styles.detail}>
            Introduce la misma clave privada configurada en Supabase.
          </Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setAccessDraft}
            placeholder="Clave personal"
            placeholderTextColor="#636366"
            secureTextEntry
            style={styles.input}
            value={accessDraft}
          />
          <Pressable
            disabled={!isValidWalletAccessToken(accessDraft)}
            onPress={saveAccess}
            style={[
              styles.accessButton,
              !isValidWalletAccessToken(accessDraft) && styles.disabled,
            ]}
          >
            <Text style={styles.accessButtonText}>Guardar en el teléfono</Text>
          </Pressable>
        </View>
      )}
      {accessReady && !!accessToken && (
        <View style={styles.accessStatus}>
          <Ionicons name="lock-closed" size={14} color="#30d158" />
          <Text style={styles.accessStatusText}>Acceso personal protegido</Text>
          <Pressable onPress={forgetAccess}>
            <Text style={styles.changeAccess}>Cambiar</Text>
          </Pressable>
        </View>
      )}
      {PRODUCTS.map(product => (
        <Pressable
          key={product.id}
          disabled={processing || !accessToken}
          onPress={() => {
            setSelected(product);
            setArmed(true);
            setMessage('Pulsa el botón lateral para confirmar');
          }}
          style={[
            styles.product,
            selected && selected.id === product.id && styles.productSelected,
            !accessToken && styles.disabled,
          ]}
        >
          <Ionicons name="card" size={20} color="#ffffff" />
          <View style={styles.flex}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.detail}>{product.displayAmount}</Text>
          </View>
        </Pressable>
      ))}
      {!!message && <Text style={styles.message}>{message}</Text>}
      {pending && !processing && !!accessToken && (
        <Pressable
          style={styles.verifyButton}
          onPress={() => {
            setProcessing(true);
            verifyPayment(pending.paymentIntentId)
              .catch(error => setMessage(error.message))
              .finally(() => setProcessing(false));
          }}
        >
          <Text style={styles.verifyText}>Verificar pago pendiente</Text>
        </Pressable>
      )}
      {transactions.length > 0 && (
        <>
          <Text style={styles.heading}>HISTORIAL VERIFICADO</Text>
          {transactions.slice(0, 5).map(transaction => (
            <View key={transaction.id} style={styles.transaction}>
              <Ionicons name="checkmark-circle" size={19} color="#30d158" />
              <View style={styles.flex}>
                <Text style={styles.productName}>
                  {transaction.description}
                </Text>
                <Text style={styles.detail}>
                  {(transaction.amount / 100).toFixed(2)}{' '}
                  {transaction.currency.toUpperCase()} · {transaction.status}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
      <Text style={styles.footnote}>
        Solo pruebas · El resultado se confirma con Stripe antes de guardarse.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 14 },
  flex: { flex: 1 },
  heading: { color: '#8e8e93', fontSize: 9, fontWeight: '800', marginTop: 10 },
  product: {
    width: '100%',
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginTop: 8,
    borderRadius: 17,
    backgroundColor: '#1c1c1e',
  },
  productSelected: { borderWidth: 2, borderColor: '#0a84ff' },
  productName: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  detail: { color: '#8e8e93', fontSize: 9, marginTop: 2 },
  message: {
    color: '#64d2ff',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 9,
  },
  verifyButton: { alignItems: 'center', padding: 9, marginTop: 7 },
  verifyText: { color: '#0a84ff', fontSize: 10, fontWeight: '700' },
  transaction: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2c2c2e',
  },
  accessPanel: {
    marginTop: 8,
    padding: 11,
    borderRadius: 17,
    backgroundColor: '#1c1c1e',
  },
  accessTitle: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  input: {
    color: '#ffffff',
    minHeight: 38,
    marginTop: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#2c2c2e',
    fontSize: 10,
  },
  accessButton: {
    alignItems: 'center',
    marginTop: 8,
    padding: 9,
    borderRadius: 10,
    backgroundColor: '#0a84ff',
  },
  accessButtonText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  accessStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 9,
    borderRadius: 12,
    backgroundColor: '#1c1c1e',
  },
  accessStatusText: { color: '#d1d1d6', fontSize: 9, flex: 1 },
  changeAccess: { color: '#0a84ff', fontSize: 9, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  footnote: {
    color: '#636366',
    fontSize: 8,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default StripeWalletPayments;
