/* eslint-disable react/jsx-one-expression-per-line */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { readStored, writeStored } from '../storage';
import {
  cancelReminder,
  REMINDER_NOTIFICATIONS_AVAILABLE,
  reminderDate,
  scheduleReminder,
} from '../notifications/reminders';

const DEFAULT_LISTS = [
  { id: 'default', name: 'Recordatorios', color: '#ff9500' },
  { id: 'school', name: 'Escuela', color: '#0a84ff' },
];
const priorities = ['ninguna', 'baja', 'media', 'alta'];

const RemindersApp = () => {
  const now = new Date(Date.now() + 60 * 60 * 1000);
  const [items, setItems] = useState([]);
  const [lists, setLists] = useState(DEFAULT_LISTS);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(now.toLocaleDateString('en-CA'));
  const [time, setTime] = useState(
    `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`,
  );
  const [listId, setListId] = useState('default');
  const [priority, setPriority] = useState('ninguna');
  const [showCompleted, setShowCompleted] = useState(false);
  const [listName, setListName] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    Promise.all([
      readStored('reminders', []),
      readStored('reminderLists', DEFAULT_LISTS),
    ]).then(([savedItems, savedLists]) => {
      setItems(savedItems);
      setLists(savedLists.length ? savedLists : DEFAULT_LISTS);
    });
  }, []);

  const persistItems = next => {
    setItems(next);
    writeStored('reminders', next);
  };

  const addReminder = async () => {
    const cleanTitle = title.trim();
    const due = reminderDate(date, time);
    if (!cleanTitle || !due) {
      setMessage('Escribe un título y una fecha/hora válidas.');
      return;
    }
    const selectedList = lists.find(list => list.id === listId) || lists[0];
    const previous = items.find(candidate => candidate.id === editingId);
    if (previous) await cancelReminder(previous.notificationId);
    const item = {
      ...(previous || {}),
      id: previous ? previous.id : `reminder-${Date.now()}`,
      title: cleanTitle,
      date,
      time,
      listId: selectedList.id,
      listName: selectedList.name,
      priority,
      completed: previous ? previous.completed : false,
      createdAt: previous ? previous.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      item.notificationId = await scheduleReminder(item);
      if (!REMINDER_NOTIFICATIONS_AVAILABLE) {
        setMessage(
          'Guardado. El aviso se activará en la APK o Development Build.',
        );
      } else if (item.notificationId) {
        setMessage('Recordatorio guardado y aviso programado.');
      } else {
        setMessage('Guardado. La fecha ya pasó; no se programó un aviso.');
      }
    } catch (error) {
      setMessage('Guardado sin aviso: permiso de notificaciones no concedido.');
    }
    persistItems(
      previous
        ? items.map(candidate => (candidate.id === item.id ? item : candidate))
        : [item, ...items],
    );
    setTitle('');
    setEditingId(null);
  };

  const toggleComplete = item => {
    if (!item.completed) cancelReminder(item.notificationId);
    persistItems(
      items.map(candidate =>
        candidate.id === item.id
          ? { ...candidate, completed: !candidate.completed }
          : candidate,
      ),
    );
  };

  const remove = item => {
    cancelReminder(item.notificationId);
    persistItems(items.filter(candidate => candidate.id !== item.id));
  };

  const edit = item => {
    setEditingId(item.id);
    setTitle(item.title);
    setDate(item.date);
    setTime(item.time);
    setListId(item.listId);
    setPriority(item.priority || 'ninguna');
    setMessage('Editando recordatorio.');
  };

  const addList = () => {
    const name = listName.trim();
    if (!name) return;
    const next = [
      ...lists,
      { id: `list-${Date.now()}`, name, color: '#bf5af2' },
    ];
    setLists(next);
    writeStored('reminderLists', next);
    setListName('');
  };

  return (
    <View style={styles.root}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Nuevo recordatorio"
        placeholderTextColor="#77777d"
        style={styles.input}
      />
      <View style={styles.row}>
        <TextInput value={date} onChangeText={setDate} style={styles.half} />
        <TextInput value={time} onChangeText={setTime} style={styles.half} />
      </View>
      <View style={styles.choices}>
        {lists.map(list => (
          <Pressable
            key={list.id}
            onPress={() => setListId(list.id)}
            style={[styles.chip, listId === list.id && styles.chipActive]}
          >
            <Text style={styles.chipText}>{list.name}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={() =>
          setPriority(value => priorities[(priorities.indexOf(value) + 1) % 4])
        }
        style={styles.option}
      >
        <Text style={styles.optionText}>
          Prioridad:
          {priority}
        </Text>
      </Pressable>
      <Pressable onPress={addReminder} style={styles.addButton}>
        <Text style={styles.addText}>
          {editingId ? 'Guardar cambios' : 'Añadir'}
        </Text>
      </Pressable>
      {!!message && <Text style={styles.message}>{message}</Text>}
      <Pressable onPress={() => setShowCompleted(value => !value)}>
        <Text style={styles.link}>
          {showCompleted ? 'Ocultar completados' : 'Mostrar completados'}
        </Text>
      </Pressable>
      {items
        .filter(item => showCompleted || !item.completed)
        .map(item => (
          <View key={item.id} style={styles.card}>
            <Pressable onPress={() => toggleComplete(item)}>
              <Ionicons
                name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={item.completed ? '#30d158' : '#ff9500'}
              />
            </Pressable>
            <View style={styles.flex}>
              <Text style={[styles.title, item.completed && styles.done]}>
                {item.title}
              </Text>
              <Text style={styles.detail}>
                {item.listName} ·{item.date} {item.time} · {item.priority}
              </Text>
            </View>
            <Pressable onPress={() => remove(item)}>
              <Ionicons name="trash" size={18} color="#8e8e93" />
            </Pressable>
            <Pressable onPress={() => edit(item)}>
              <Ionicons name="create" size={18} color="#0a84ff" />
            </Pressable>
          </View>
        ))}
      <Text style={styles.section}>NUEVA LISTA</Text>
      <View style={styles.row}>
        <TextInput
          value={listName}
          onChangeText={setListName}
          placeholder="Nombre"
          placeholderTextColor="#77777d"
          style={styles.flexInput}
        />
        <Pressable onPress={addList} style={styles.smallButton}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: '100%' },
  input: {
    backgroundColor: '#1c1c1e',
    color: '#fff',
    borderRadius: 13,
    padding: 11,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  half: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    color: '#fff',
    borderRadius: 12,
    padding: 10,
    textAlign: 'center',
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  chip: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 13,
  },
  chipActive: { backgroundColor: '#ff9500' },
  chipText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  option: { marginTop: 8, alignSelf: 'flex-start' },
  optionText: { color: '#ff9500', fontSize: 11 },
  addButton: {
    backgroundColor: '#ff9500',
    borderRadius: 20,
    padding: 10,
    alignItems: 'center',
    marginTop: 9,
  },
  addText: { color: '#fff', fontWeight: '800' },
  message: {
    color: '#8e8e93',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 7,
  },
  link: {
    color: '#0a84ff',
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 10,
    marginBottom: 7,
  },
  flex: { flex: 1 },
  title: { color: '#fff', fontWeight: '700', fontSize: 12 },
  done: { color: '#8e8e93', textDecorationLine: 'line-through' },
  detail: { color: '#8e8e93', fontSize: 9, marginTop: 3 },
  section: { color: '#8e8e93', fontSize: 9, fontWeight: '800', marginTop: 8 },
  flexInput: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    color: '#fff',
    borderRadius: 12,
    padding: 10,
  },
  smallButton: { backgroundColor: '#bf5af2', borderRadius: 18, padding: 8 },
});

export default RemindersApp;
