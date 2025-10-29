# Phase 4: Mobile App

**React Native app para iOS y Android**

---

## 🎯 Overview

Mobile app nativa con:
- Core features (Timeline, Filters, Details)
- Photo upload con OCR
- Quick entry
- Offline mode
- Push notifications
- Sync con desktop

**LOC estimate**: ~1,000 LOC (separate repo)

---

## 📱 Tech Stack

```json
{
  "framework": "React Native",
  "state": "Redux + Redux Toolkit",
  "navigation": "React Navigation",
  "storage": "AsyncStorage",
  "api": "Axios",
  "camera": "react-native-vision-camera",
  "ocr": "react-native-ml-kit",
  "notifications": "react-native-push-notification"
}
```

---

## 🏗️ Project Structure

```
finance-app-mobile/
├── src/
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── TimelineScreen.js
│   │   ├── TransactionDetailScreen.js
│   │   ├── AddTransactionScreen.js
│   │   ├── BudgetsScreen.js
│   │   └── SettingsScreen.js
│   │
│   ├── components/
│   │   ├── TransactionRow.js
│   │   ├── FilterBar.js
│   │   ├── BudgetCard.js
│   │   └── PhotoCapture.js
│   │
│   ├── redux/
│   │   ├── slices/
│   │   │   ├── transactionsSlice.js
│   │   │   ├── accountsSlice.js
│   │   │   ├── budgetsSlice.js
│   │   │   └── authSlice.js
│   │   └── store.js
│   │
│   ├── services/
│   │   ├── api.js
│   │   ├── storage.js
│   │   ├── sync.js
│   │   └── ocr.js
│   │
│   └── utils/
│       ├── formatters.js
│       ├── validators.js
│       └── constants.js
│
├── android/
├── ios/
└── package.json
```

---

## 🔐 Authentication

```javascript
// src/screens/LoginScreen.js

import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { login } from '../redux/slices/authSlice';
import api from '../services/api';

function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();

  const handleLogin = async () => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { sessionId, user } = response.data;

      // Store session
      await AsyncStorage.setItem('sessionId', sessionId);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      // Update Redux
      dispatch(login({ sessionId, user }));

      // Navigate to main app
      navigation.replace('Home');
    } catch (error) {
      Alert.alert('Error', 'Invalid credentials');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5
  }
});
```

---

## 📋 Timeline Screen

```javascript
// src/screens/TimelineScreen.js

import React, { useEffect, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { fetchTransactions } from '../redux/slices/transactionsSlice';
import TransactionRow from '../components/TransactionRow';
import FilterBar from '../components/FilterBar';

function TimelineScreen({ navigation }) {
  const dispatch = useDispatch();
  const { transactions, loading } = useSelector(state => state.transactions);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    await dispatch(fetchTransactions({ limit: 100, offset: 0 }));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const handleTransactionPress = (txn) => {
    navigation.navigate('TransactionDetail', { transactionId: txn.id });
  };

  return (
    <View style={{ flex: 1 }}>
      <FilterBar />
      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TransactionRow
            transaction={item}
            onPress={() => handleTransactionPress(item)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={() => {
          // Load more (pagination)
          dispatch(fetchTransactions({ limit: 100, offset: transactions.length }));
        }}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}
```

---

## 💳 Transaction Row Component

```javascript
// src/components/TransactionRow.js

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

function TransactionRow({ transaction, onPress }) {
  const { merchant, amount, currency, date, type } = transaction;

  const amountColor = amount < 0 ? '#FF6B6B' : '#51CF66';
  const icon = getIcon(merchant, type);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.content}>
        <Text style={styles.merchant}>{merchant}</Text>
        <Text style={styles.date}>{formatDate(date)}</Text>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>
        {formatAmount(amount, currency)}
      </Text>
    </TouchableOpacity>
  );
}

function getIcon(merchant, type) {
  if (type === 'transfer') return '↔️';

  const iconMap = {
    'Starbucks': '☕',
    'Amazon': '📦',
    'Netflix': '🎬',
    'Uber': '🚗',
    'Target': '🛒'
  };

  return iconMap[merchant] || '💳';
}

function formatAmount(amount, currency) {
  const symbols = { USD: '$', MXN: '$', EUR: '€' };
  const symbol = symbols[currency] || currency;
  const formatted = Math.abs(amount).toFixed(2);
  const sign = amount < 0 ? '-' : '+';

  return `${sign}${symbol}${formatted}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  icon: {
    fontSize: 24,
    marginRight: 12
  },
  content: {
    flex: 1
  },
  merchant: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginTop: 2
  },
  amount: {
    fontSize: 16,
    fontWeight: '700'
  }
});

export default TransactionRow;
```

---

## 📸 Photo Upload con OCR

```javascript
// src/screens/AddTransactionScreen.js

import React, { useState } from 'react';
import { View, Button, Image, ActivityIndicator } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';

function AddTransactionScreen() {
  const [photo, setPhoto] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    const camera = await Camera.getCameraDevice('back');
    const photo = await camera.takePhoto();
    setPhoto(photo);

    // Process with OCR
    await processReceipt(photo.path);
  };

  const processReceipt = async (imagePath) => {
    setLoading(true);

    try {
      // Run OCR
      const result = await TextRecognition.recognize(imagePath);

      // Extract data from text
      const extracted = extractReceiptData(result.text);
      setExtractedData(extracted);
    } catch (error) {
      console.error('OCR error:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractReceiptData = (text) => {
    // Simple extraction logic
    const lines = text.split('\n');

    // Find merchant (usually first line)
    const merchant = lines[0];

    // Find amount (look for $ pattern)
    const amountPattern = /\$\s*(\d+\.\d{2})/g;
    const matches = text.match(amountPattern);
    const amount = matches ? parseFloat(matches[0].replace('$', '')) : null;

    // Find date (look for date patterns)
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})/;
    const dateMatch = text.match(datePattern);
    const date = dateMatch ? dateMatch[1] : null;

    return {
      merchant: merchant || 'Unknown',
      amount: amount || 0,
      date: date || new Date().toISOString().split('T')[0],
      confidence: 0.7
    };
  };

  return (
    <View style={{ flex: 1 }}>
      {photo ? (
        <View>
          <Image source={{ uri: photo.path }} style={{ width: '100%', height: 300 }} />
          {loading ? (
            <ActivityIndicator />
          ) : (
            <View>
              {extractedData && (
                <TransactionForm initialData={extractedData} />
              )}
            </View>
          )}
        </View>
      ) : (
        <Button title="Take Photo" onPress={takePhoto} />
      )}
    </View>
  );
}
```

---

## ⚡ Quick Entry

```javascript
// src/components/QuickEntryModal.js

import React, { useState } from 'react';
import { Modal, View, TextInput, Button, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { createTransaction } from '../redux/slices/transactionsSlice';

function QuickEntryModal({ visible, onClose }) {
  const dispatch = useDispatch();
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');

  const handleSave = async () => {
    const txn = {
      merchant,
      amount: -Math.abs(parseFloat(amount)),
      currency: 'USD',
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      source_type: 'mobile'
    };

    await dispatch(createTransaction(txn));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <TextInput
            placeholder="Merchant"
            value={merchant}
            onChangeText={setMerchant}
            style={styles.input}
          />
          <TextInput
            placeholder="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            style={styles.input}
          />
          <Button title="Save" onPress={handleSave} />
          <Button title="Cancel" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modal: {
    width: '80%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5
  }
});
```

---

## 💾 Offline Mode

```javascript
// src/services/storage.js

import AsyncStorage from '@react-native-async-storage/async-storage';

export async function cacheTransactions(transactions) {
  await AsyncStorage.setItem('transactions_cache', JSON.stringify(transactions));
}

export async function getCachedTransactions() {
  const cached = await AsyncStorage.getItem('transactions_cache');
  return cached ? JSON.parse(cached) : [];
}

export async function queueChange(change) {
  const queue = await getChangeQueue();
  queue.push(change);
  await AsyncStorage.setItem('change_queue', JSON.stringify(queue));
}

export async function getChangeQueue() {
  const queue = await AsyncStorage.getItem('change_queue');
  return queue ? JSON.parse(queue) : [];
}

export async function clearChangeQueue() {
  await AsyncStorage.setItem('change_queue', JSON.stringify([]));
}
```

### Offline-first Redux

```javascript
// src/redux/slices/transactionsSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { cacheTransactions, getCachedTransactions, queueChange } from '../../services/storage';
import NetInfo from '@react-native-community/netinfo';

export const fetchTransactions = createAsyncThunk(
  'transactions/fetch',
  async (filters, { rejectWithValue }) => {
    const isConnected = await NetInfo.fetch().then(state => state.isConnected);

    if (!isConnected) {
      // Return cached data
      return await getCachedTransactions();
    }

    try {
      const response = await api.get('/transactions', { params: filters });
      const transactions = response.data;

      // Cache for offline use
      await cacheTransactions(transactions);

      return transactions;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createTransaction = createAsyncThunk(
  'transactions/create',
  async (txnData, { rejectWithValue }) => {
    const isConnected = await NetInfo.fetch().then(state => state.isConnected);

    if (!isConnected) {
      // Queue change for later sync
      const tempId = `temp_${Date.now()}`;
      const txn = { ...txnData, id: tempId, _pending: true };

      await queueChange({ type: 'create', table: 'transactions', data: txn });

      return txn;
    }

    try {
      const response = await api.post('/transactions', txnData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState: {
    items: [],
    loading: false,
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      });
  }
});

export default transactionsSlice.reducer;
```

---

## 🔔 Push Notifications

```javascript
// src/services/notifications.js

import PushNotification from 'react-native-push-notification';

export function initNotifications() {
  PushNotification.configure({
    onNotification: function (notification) {
      console.log('Notification:', notification);
    },
    permissions: {
      alert: true,
      badge: true,
      sound: true
    },
    popInitialNotification: true,
    requestPermissions: true
  });
}

export function sendBudgetAlert(budgetName, percentage) {
  PushNotification.localNotification({
    title: 'Budget Alert',
    message: `You've spent ${percentage}% of your ${budgetName} budget`,
    playSound: true,
    soundName: 'default'
  });
}

export function sendRecurringReminder(merchant, amount) {
  PushNotification.localNotification({
    title: 'Recurring Payment',
    message: `${merchant} payment of $${amount} is due soon`,
    playSound: true,
    soundName: 'default'
  });
}
```

---

## 🔄 Sync Service

```javascript
// src/services/sync.js

import api from './api';
import { getChangeQueue, clearChangeQueue } from './storage';
import { store } from '../redux/store';
import { fetchTransactions } from '../redux/slices/transactionsSlice';

export async function syncWithServer() {
  const queue = await getChangeQueue();

  if (queue.length === 0) {
    // No pending changes, just fetch latest
    await store.dispatch(fetchTransactions({ limit: 100, offset: 0 }));
    return;
  }

  // Sync up (send pending changes)
  try {
    await api.post('/sync/up', { changes: queue });
    await clearChangeQueue();
  } catch (error) {
    console.error('Sync up failed:', error);
    return;
  }

  // Sync down (fetch latest)
  const lastSync = await AsyncStorage.getItem('lastSyncTime');
  const response = await api.get('/sync/down', {
    params: { since: lastSync }
  });

  const { transactions, accounts, categories, serverTime } = response.data;

  // Update local cache
  await cacheTransactions(transactions);
  await AsyncStorage.setItem('lastSyncTime', serverTime);

  // Update Redux
  store.dispatch(fetchTransactions({ limit: 100, offset: 0 }));
}

// Auto-sync every 5 minutes when online
export function startAutoSync() {
  setInterval(async () => {
    const isConnected = await NetInfo.fetch().then(state => state.isConnected);
    if (isConnected) {
      await syncWithServer();
    }
  }, 5 * 60 * 1000); // 5 minutes
}
```

---

## 📊 LOC Estimate

| Component | LOC |
|-----------|-----|
| Screens (6 screens) | ~400 |
| Components (TransactionRow, etc) | ~200 |
| Redux (slices, store) | ~150 |
| API service | ~80 |
| Storage service | ~60 |
| Sync service | ~100 |
| OCR service | ~80 |
| Notifications | ~50 |
| **Total** | **~1,120** |

---

## 🚀 Deployment

### iOS

```bash
# Build for iOS
cd ios
pod install
cd ..
npx react-native run-ios --configuration Release

# Archive for App Store
xcodebuild -workspace ios/FinanceApp.xcworkspace \
  -scheme FinanceApp \
  -archivePath build/FinanceApp.xcarchive \
  archive
```

### Android

```bash
# Build for Android
cd android
./gradlew assembleRelease

# APK will be at: android/app/build/outputs/apk/release/app-release.apk
```

---

**Próximo**: Update README y existing docs con nueva arquitectura
