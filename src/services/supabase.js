/* global process */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

let client = null;

export const isSupabaseConfigured = () =>
  /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(supabaseUrl) &&
  supabasePublishableKey.length > 20;

export const getSupabaseClient = () => {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Falta configurar la conexión pública de Supabase para Wallet.',
    );
  }
  if (!client) {
    client = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }
  return client;
};
