import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  ScrollView,
  TextInput,
  Pressable,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, H2, Label, Body, Button } from '../ui';
import { Person } from '../../db/schema';
import {
  DEFAULT_MEMORY_TEMPLATE,
  getPersonMemory,
  savePersonMemory,
  mergeMemoryInsightIntoText,
} from '../../services/persons/personMemoryService';
import { useTheme } from '../../theme';

const QUICK_SECTIONS = [
  'Preferred Styles & Silhouettes',
  'Favorite Colors & Palettes',
  'Fabrics & Textures That Make Me Tingle',
  'Fit, Mood & Sensual Preferences',
  'Custom Notes & Observations',
];

export interface PersonalityMemoryModalProps {
  visible: boolean;
  person: Person | null;
  onClose: () => void;
  onSaved?: () => void;
  onJumpToChat?: (personId: string) => void;
}

export const PersonalityMemoryModal: React.FC<PersonalityMemoryModalProps> = ({
  visible,
  person,
  onClose,
  onSaved,
  onJumpToChat,
}) => {
  const { theme } = useTheme();
  const [memoryText, setMemoryText] = useState(DEFAULT_MEMORY_TEMPLATE);
  const [selectedSection, setSelectedSection] = useState(QUICK_SECTIONS[2]);
  const [quickTrait, setQuickTrait] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible && person) {
      getPersonMemory(person.id)
        .then((text) => setMemoryText(text))
        .catch(() => setMemoryText(person.memoryText || DEFAULT_MEMORY_TEMPLATE));
    }
  }, [visible, person]);

  const handleQuickAddTrait = () => {
    if (!quickTrait.trim()) return;
    Haptics.selectionAsync().catch(() => {});
    setMemoryText((prev) => mergeMemoryInsightIntoText(prev, selectedSection, quickTrait));
    setQuickTrait('');
  };

  const handleSave = async () => {
    if (!person) return;
    setIsSaving(true);
    try {
      await savePersonMemory(person.id, memoryText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved?.();
      onClose();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save memory');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          backgroundColor: theme.isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <Card className="w-full max-h-[88%] p-5">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-1 pr-2">
                <Label>DISTINCT PERSONALITY MEMORY</Label>
                <H2 className="text-base">{person?.name ?? 'Stylist'}</H2>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  backgroundColor: theme.colors.badgeBg,
                  borderColor: theme.colors.cardBorder,
                  borderWidth: 1,
                  borderRadius: theme.borderRadius ? 8 : 0,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.accent,
                    fontFamily: theme.isMono ? 'Courier' : undefined,
                    fontWeight: '600',
                    fontSize: 12,
                  }}
                >
                  {theme.isUppercase ? 'CLOSE' : 'Close'}
                </Text>
              </Pressable>
            </View>

            <Body className="text-xs mb-3">
              Plain-text memory unique to {person?.name}. Add styles, colors, or fabrics that make
              you feel special and tingle. You can add any `## Section` freely.
            </Body>

            {/* Quick-Add Trait Row */}
            <Label className="mb-1.5">QUICK-ADD TRAIT</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
              <View className="flex-row gap-1.5">
                {QUICK_SECTIONS.map((sec) => {
                  const isSelected = selectedSection === sec;
                  return (
                    <Pressable
                      key={sec}
                      onPress={() => setSelectedSection(sec)}
                      style={{
                        borderRadius: theme.borderRadius ? 12 : 0,
                        borderWidth: 1,
                        borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                        backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.card,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                      }}
                    >
                      <Text
                        style={{
                          color: isSelected ? theme.colors.accent : theme.colors.textMuted,
                          fontSize: 11,
                          fontWeight: isSelected ? '700' : '500',
                          fontFamily: theme.isMono ? 'Courier' : undefined,
                        }}
                      >
                        {sec.split(' ')[0]} {sec.split(' ')[1] ?? ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View className="flex-row gap-2 mb-4">
              <TextInput
                value={quickTrait}
                onChangeText={setQuickTrait}
                onSubmitEditing={handleQuickAddTrait}
                placeholder="e.g. Sheer black Chantilly lace..."
                placeholderTextColor={theme.colors.inputPlaceholder}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.inputBg,
                  borderColor: theme.colors.inputBorder,
                  borderWidth: 1,
                  borderRadius: theme.borderRadius ? 8 : 0,
                  color: theme.colors.inputText,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  fontSize: 12,
                }}
              />
              <Button variant="secondary" className="h-10 px-3" onPress={handleQuickAddTrait}>
                + Add
              </Button>
            </View>

            {/* Raw Plain-Text Markdown Editor */}
            <Label className="mb-1.5">PLAIN-TEXT MEMORY LOG</Label>
            <TextInput
              value={memoryText}
              onChangeText={setMemoryText}
              multiline
              numberOfLines={10}
              style={{
                minHeight: 200,
                textAlignVertical: 'top',
                backgroundColor: theme.colors.inputBg,
                borderColor: theme.colors.inputBorder,
                borderWidth: 1,
                borderRadius: theme.borderRadius ? 8 : 0,
                color: theme.colors.inputText,
                fontFamily: theme.isMono ? 'Courier' : undefined,
                padding: 12,
                fontSize: 12,
                marginBottom: 14,
              }}
            />

            <View className="flex-row gap-2 mb-2">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() => setMemoryText(DEFAULT_MEMORY_TEMPLATE)}
              >
                Reset
              </Button>
              <Button variant="primary" className="flex-1" loading={isSaving} onPress={handleSave}>
                Save Memory
              </Button>
            </View>

            {person && onJumpToChat && (
              <Button
                variant="secondary"
                className="mt-1"
                onPress={() => {
                  onClose();
                  onJumpToChat(person.id);
                }}
              >
                {`Jump to Chat with ${person.name} →`}
              </Button>
            )}
          </ScrollView>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
};
