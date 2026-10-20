import React from 'react';
import { View, StyleSheet } from 'react-native';
import { H1, Label } from '../ui';

export interface PrivacyShieldProps {
  visible: boolean;
}

/**
 * PrivacyShield is an absolute full-screen opaque overlay (solid #000000).
 * Prevents the iOS App Switcher from caching or snapshotting decrypted tickets,
 * photos, or keys when PocketPick is sent to the background.
 */
export const PrivacyShield: React.FC<PrivacyShieldProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      className="bg-black z-50 items-center justify-center px-6"
    >
      <Label className="text-zinc-600 mb-2">POCKETPICK // ZERO LEAK</Label>
      <H1 className="text-center font-mono text-lg text-white mb-2">SESSION SECURED</H1>
      <View className="px-3 py-1 border border-zinc-800">
        <Label className="text-zinc-500">[ PRIVACY SHIELD ACTIVE ]</Label>
      </View>
    </View>
  );
};
