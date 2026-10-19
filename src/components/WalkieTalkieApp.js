/* eslint-disable react/jsx-one-expression-per-line, react/prop-types */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { requestRecordingPermissionsAsync } from 'expo-audio';

const WalkieTalkieApp = ({ theaterMode }) => {
  const [microphoneReady, setMicrophoneReady] = useState(false);
  const [message, setMessage] = useState('');

  const prepare = async () => {
    const permission = await requestRecordingPermissionsAsync();
    setMicrophoneReady(permission.granted);
    setMessage(
      permission.granted
        ? 'Micrófono listo. Falta conectar un segundo dispositivo.'
        : 'Permiso de micrófono no concedido.',
    );
  };

  return (
    <View style={styles.root}>
      <Ionicons name="radio" size={70} color="#ffd60a" />
      <Text style={styles.title}>Walkie-Talkie</Text>
      {theaterMode ? (
        <Text style={styles.warning}>
          No disponible mientras Modo Cine está activo.
        </Text>
      ) : (
        <>
          <Pressable onPress={prepare} style={styles.prepare}>
            <Text style={styles.prepareText}>Preparar micrófono</Text>
          </Pressable>
          <Pressable
            disabled
            style={[styles.talk, !microphoneReady && styles.disabled]}
          >
            <Text style={styles.talkText}>MANTENER PARA HABLAR</Text>
          </Pressable>
          <Text style={styles.detail}>
            La transmisión permanece desactivada: una comunicación real exige
            otro cliente, señalización y un canal de audio en tiempo real.
          </Text>
          {!!message && <Text style={styles.status}>{message}</Text>}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: '100%', alignItems: 'center' },
  title: { color: '#fff', fontSize: 19, fontWeight: '800', marginTop: 8 },
  warning: { color: '#ffd60a', textAlign: 'center', marginTop: 14 },
  prepare: {
    backgroundColor: '#2c2c2e',
    borderRadius: 18,
    padding: 10,
    marginTop: 14,
  },
  prepareText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  talk: {
    width: 170,
    height: 82,
    borderRadius: 25,
    backgroundColor: '#ffd60a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  disabled: { opacity: 0.5 },
  talkText: { color: '#000', fontWeight: '900', fontSize: 11 },
  detail: {
    color: '#8e8e93',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  status: { color: '#64d2ff', fontSize: 10, textAlign: 'center', marginTop: 8 },
});

export default WalkieTalkieApp;
