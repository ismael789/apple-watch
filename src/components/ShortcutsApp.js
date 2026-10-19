/* eslint-disable react/jsx-one-expression-per-line, react/prop-types */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { readStored, writeStored } from '../storage';
import { actionById, SHORTCUT_ACTIONS } from '../shortcuts/actions';

const DEFAULT_SHORTCUTS = [
  { id: 'shortcut-music', name: 'Mi música', actionId: 'music' },
  { id: 'shortcut-workout', name: 'Entrenar', actionId: 'workout' },
];

const ShortcutsApp = ({ onExecute }) => {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [actionId, setActionId] = useState(SHORTCUT_ACTIONS[0].id);

  useEffect(() => {
    readStored('shortcuts', DEFAULT_SHORTCUTS).then(saved =>
      setItems(saved.length ? saved : DEFAULT_SHORTCUTS),
    );
  }, []);

  const persist = next => {
    setItems(next);
    writeStored('shortcuts', next);
  };

  const add = () => {
    const action = actionById(actionId);
    if (!action) return;
    persist([
      ...items,
      {
        id: `shortcut-${Date.now()}`,
        name: name.trim() || action.name,
        actionId,
      },
    ]);
    setName('');
  };

  return (
    <View style={styles.root}>
      {items.map(item => {
        const action = actionById(item.actionId);
        if (!action) return null;
        return (
          <View key={item.id} style={styles.card}>
            <Pressable
              style={styles.launch}
              onPress={() => onExecute(action.id)}
            >
              <View style={styles.icon}>
                <Ionicons name={action.icon} size={22} color="#fff" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.title}>{item.name}</Text>
                <Text style={styles.detail}>{action.name}</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => persist(items.filter(x => x.id !== item.id))}
            >
              <Ionicons name="trash" size={18} color="#8e8e93" />
            </Pressable>
          </View>
        );
      })}
      <Text style={styles.section}>CREAR ATAJO</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Nombre opcional"
        placeholderTextColor="#77777d"
        style={styles.input}
      />
      <View style={styles.actions}>
        {SHORTCUT_ACTIONS.map(action => (
          <Pressable
            key={action.id}
            onPress={() => setActionId(action.id)}
            style={[styles.choice, actionId === action.id && styles.selected]}
          >
            <Ionicons name={action.icon} size={17} color="#fff" />
            <Text style={styles.choiceText}>{action.name}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={add} style={styles.add}>
        <Text style={styles.addText}>Guardar atajo</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: '100%' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
  },
  launch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5e5ce6',
  },
  flex: { flex: 1 },
  title: { color: '#fff', fontSize: 12, fontWeight: '800' },
  detail: { color: '#8e8e93', fontSize: 9, marginTop: 2 },
  section: { color: '#8e8e93', fontSize: 9, fontWeight: '800', marginTop: 10 },
  input: {
    color: '#fff',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  actions: { marginTop: 8, gap: 6 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 8,
  },
  selected: { backgroundColor: '#5e5ce6' },
  choiceText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  add: {
    backgroundColor: '#0a84ff',
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  addText: { color: '#fff', fontWeight: '800', fontSize: 11 },
});

export default ShortcutsApp;
