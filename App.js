import React, { useEffect, useState } from 'react';
import { Image, StatusBar, StyleSheet, View } from 'react-native';
import { StripeProvider } from '@stripe/stripe-react-native';

import Demo from './src/Demo';
import { MusicProvider } from './src/music/MusicProvider';
import { StopwatchProvider } from './src/stopwatch/StopwatchProvider';
import { initializeStructuredStorage } from './src/storage';
import { initializePrivateStorage } from './src/storageManager';

// eslint-disable-next-line global-require
const splashImage = require('./src/assets/watch-splash.png');

const stripePublishableKey =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

const App = () => {
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let active = true;
    const minimumSplash = new Promise(resolve => setTimeout(resolve, 1600));
    const initializeStorage = async () => {
      await initializePrivateStorage();
      await initializeStructuredStorage();
    };
    Promise.all([minimumSplash, initializeStorage().catch(() => null)]).then(
      () => {
        if (active) setStarting(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  if (starting) {
    return (
      <View style={styles.splash}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Image
          source={splashImage}
          resizeMode="contain"
          style={styles.splashImage}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070709" />
      <StripeProvider publishableKey={stripePublishableKey}>
        <MusicProvider>
          <StopwatchProvider>
            <Demo />
          </StopwatchProvider>
        </MusicProvider>
      </StripeProvider>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070709',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splash: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashImage: { width: '100%', height: '100%' },
});

export default App;
