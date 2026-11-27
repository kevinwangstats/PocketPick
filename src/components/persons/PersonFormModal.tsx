import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  ScrollView,
  TextInput,
  Pressable,
  Text,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Person } from '../../db/schema';
import { DESIGNER_PERSONA_PRESETS, TONE_PRESETS } from '../../services/persons/personaPresets';
import {
  createPerson,
  updatePerson,
  decryptPersonAvatarUri,
} from '../../services/persons/personService';
import { Button, Input, H2, Label, ErrorText } from '../ui';
import { useTheme } from '../../theme';

export interface PersonFormModalProps {
  visible: boolean;
  person?: Person | null;
  sessionKey: Buffer | null;
  onClose: () => void;
  onSaved: (person: Person) => void;
  onOpenMemory?: (person: Person) => void;
}

export const PersonFormModal: React.FC<PersonFormModalProps> = ({
  visible,
  person,
  sessionKey,
  onClose,
  onSaved,
  onOpenMemory,
}) => {
  const { theme } = useTheme();
  const isEditing = Boolean(person);

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [tonePreset, setTonePreset] = useState<string>(TONE_PRESETS[0].id);
  const [personalityPrompt, setPersonalityPrompt] = useState('');
  const [previewAvatarUri, setPreviewAvatarUri] = useState<string | null>(null);
  const [newAvatarLocalPath, setNewAvatarLocalPath] = useState<string | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setNewAvatarLocalPath(undefined);

    if (person) {
      setName(person.name);
      setBio(person.bio ?? '');
      setTonePreset(person.tonePreset ?? TONE_PRESETS[0].id);
      setPersonalityPrompt(person.personalityPrompt);
      if (sessionKey && person.avatarThumbPath) {
        decryptPersonAvatarUri(person, sessionKey)
          .then((uri) => setPreviewAvatarUri(uri))
          .catch(() => setPreviewAvatarUri(null));
      } else {
        setPreviewAvatarUri(null);
      }
    } else {
      setName('');
      setBio('');
      setTonePreset(TONE_PRESETS[0].id);
      setPersonalityPrompt('');
      setPreviewAvatarUri(null);
    }
  }, [visible, person, sessionKey]);

  const handlePickAvatar = async (useCamera: boolean) => {
    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera Permission', 'Camera access is needed to snap a portrait.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (!res.canceled && res.assets[0]?.uri) {
        setPreviewAvatarUri(res.assets[0].uri);
        setNewAvatarLocalPath(res.assets[0].uri);
      }
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setPreviewAvatarUri(res.assets[0].uri);
      setNewAvatarLocalPath(res.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Person name is required');
      return;
    }
    if (!personalityPrompt.trim()) {
      setError('Personality prompt is required');
      return;
    }

    setIsSaving(true);
    try {
      let saved: Person;
      if (person) {
        saved = await updatePerson(person.id, {
          name: name.trim(),
          bio: bio.trim(),
          tonePreset,
          personalityPrompt: personalityPrompt.trim(),
          avatarUri: newAvatarLocalPath,
          sessionKey: sessionKey ?? undefined,
        });
      } else {
        saved = await createPerson({
          name: name.trim(),
          bio: bio.trim(),
          tonePreset,
          personalityPrompt: personalityPrompt.trim(),
          avatarUri: typeof newAvatarLocalPath === 'string' ? newAvatarLocalPath : undefined,
          sessionKey: sessionKey ?? undefined,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save person');
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
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.cardBorder,
            borderWidth: 1,
            borderRadius: theme.borderRadius ? 16 : 0,
            maxHeight: '90%',
            padding: 18,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <H2>{isEditing ? 'Edit AI Stylist' : 'New AI Stylist'}</H2>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>Close</Text>
              </Pressable>
            </View>

            {/* Starter Designer Presets (when creating) */}
            {!isEditing && (
              <View className="mb-4">
                <Label className="mb-1.5">STARTER PERSONALITIES</Label>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {DESIGNER_PERSONA_PRESETS.map((preset) => (
                      <Pressable
                        key={preset.id}
                        onPress={() => {
                          setName(preset.name);
                          setBio(preset.bio);
                          setTonePreset(preset.tonePreset);
                          setPersonalityPrompt(preset.personalityPrompt);
                        }}
                        style={{
                          backgroundColor: theme.colors.badgeBg,
                          borderColor: theme.colors.cardBorder,
                          borderWidth: 1,
                          borderRadius: theme.borderRadius ? 10 : 0,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <Text
                          style={{ color: theme.colors.badgeText, fontSize: 12, fontWeight: '700' }}
                        >
                          {preset.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Portrait Avatar Upload */}
            <Label className="mb-2">PORTRAIT PHOTO (APP-ONLY)</Label>
            <View className="flex-row items-center gap-3 mb-4">
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: theme.borderRadius ? 30 : 0,
                  backgroundColor: theme.colors.badgeBg,
                  borderColor: theme.colors.accent,
                  borderWidth: 1.5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {previewAvatarUri ? (
                  <Image
                    source={{ uri: previewAvatarUri }}
                    style={{ width: 60, height: 60 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>No Photo</Text>
                )}
              </View>

              <View className="flex-row flex-wrap gap-2 flex-1">
                <Button
                  variant="secondary"
                  className="h-8 px-3"
                  onPress={() => handlePickAvatar(false)}
                >
                  Upload Photo
                </Button>
                <Button
                  variant="secondary"
                  className="h-8 px-3"
                  onPress={() => handlePickAvatar(true)}
                >
                  Camera
                </Button>
                {previewAvatarUri && (
                  <Pressable
                    onPress={() => {
                      setPreviewAvatarUri(null);
                      setNewAvatarLocalPath(null);
                    }}
                    className="justify-center px-2"
                  >
                    <Text style={{ color: theme.colors.destructiveButtonText, fontSize: 11 }}>
                      Remove
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            <Input
              label="Name"
              placeholder="e.g. Celeste, Valentina..."
              value={name}
              onChangeText={setName}
            />

            <Input
              label="Tagline / Role (Optional)"
              placeholder="e.g. Parisian Atelier Stylist"
              value={bio}
              onChangeText={setBio}
            />

            {/* Tone & Sensuality Chips */}
            <Label className="mb-1.5">TONE & SENSUALITY DIAL</Label>
            <View className="flex-row flex-wrap gap-1.5 mb-4">
              {TONE_PRESETS.map((tone) => {
                const isSelected = tonePreset === tone.id;
                return (
                  <Pressable
                    key={tone.id}
                    onPress={() => setTonePreset(tone.id)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: theme.borderRadius ? 12 : 0,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                      backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.inputBg,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                        fontSize: 11,
                        fontWeight: isSelected ? '700' : '500',
                      }}
                    >
                      {tone.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Personality Prompt */}
            <Label className="mb-1.5">PERSONALITY PROMPT</Label>
            <TextInput
              value={personalityPrompt}
              onChangeText={setPersonalityPrompt}
              placeholder="Describe her personality, styling eye, tone, and how she speaks with you..."
              placeholderTextColor={theme.colors.inputPlaceholder}
              multiline
              numberOfLines={5}
              style={{
                minHeight: 110,
                textAlignVertical: 'top',
                backgroundColor: theme.colors.inputBg,
                borderColor: theme.colors.inputBorder,
                borderWidth: 1,
                borderRadius: theme.borderRadius ? 10 : 0,
                color: theme.colors.inputText,
                padding: 10,
                fontSize: 13,
                marginBottom: 14,
              }}
            />

            {error && <ErrorText className="mb-3">{error}</ErrorText>}

            <Button variant="primary" loading={isSaving} onPress={handleSave}>
              {isEditing ? 'Save Changes' : 'Create Person'}
            </Button>

            {person && onOpenMemory && (
              <Button
                variant="secondary"
                className="mt-2"
                onPress={() => {
                  onClose();
                  onOpenMemory(person);
                }}
              >
                View / Edit Plain-Text Memory
              </Button>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
