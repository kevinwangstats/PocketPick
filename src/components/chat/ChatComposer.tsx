import React from 'react';
import { View, Text, TextInput, Pressable, Image, ScrollView } from 'react-native';
import { Photo } from '../../db/schema';
import { useTheme } from '../../theme';

export interface StagedAttachmentPreview {
  uri?: string;
  existingPhoto?: Photo;
  label: string;
}

export interface ChatComposerProps {
  text: string;
  onChangeText: (val: string) => void;
  stagedAttachment: StagedAttachmentPreview | null;
  onClearAttachment: () => void;
  onOpenAttachmentMenu: () => void;
  onOpenQuickBuilder: () => void;
  onQuickCommand: (commandText: string) => void;
  onSend: () => void;
  isSending: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  text,
  onChangeText,
  stagedAttachment,
  onClearAttachment,
  onOpenAttachmentMenu,
  onOpenQuickBuilder,
  onQuickCommand,
  onSend,
  isSending,
}) => {
  const { theme } = useTheme();
  const canSend = (text.trim().length > 0 || Boolean(stagedAttachment)) && !isSending;

  return (
    <View
      style={{
        backgroundColor: theme.colors.headerBg,
        borderTopWidth: 1,
        borderTopColor: theme.colors.divider,
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: 14,
      }}
    >
      {/* Quick Command Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
        <View className="flex-row gap-2">
          <Pressable
            onPress={onOpenQuickBuilder}
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: theme.borderRadius ? 12 : 0,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text style={{ color: theme.colors.accentText, fontSize: 11, fontWeight: '700' }}>
              ✨ OOTD
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onQuickCommand('/ootd with no top and no pants')}
            style={{
              backgroundColor: theme.colors.badgeBg,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 12 : 0,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text style={{ color: theme.colors.badgeText, fontSize: 11, fontWeight: '600' }}>
              Bra & Panties
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onQuickCommand('/secret')}
            style={{
              backgroundColor: theme.colors.badgeBg,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 12 : 0,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text style={{ color: theme.colors.badgeText, fontSize: 11, fontWeight: '600' }}>
              /secret
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onQuickCommand('/style')}
            style={{
              backgroundColor: theme.colors.badgeBg,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 12 : 0,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text style={{ color: theme.colors.badgeText, fontSize: 11, fontWeight: '600' }}>
              /style
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Staged Photo Preview */}
      {stagedAttachment && (
        <View
          style={{
            backgroundColor: theme.colors.badgeBg,
            borderColor: theme.colors.cardBorder,
            borderWidth: 1,
            borderRadius: theme.borderRadius ? 10 : 0,
            padding: 8,
            marginBottom: 8,
          }}
          className="flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-2.5 flex-1">
            {stagedAttachment.uri ? (
              <Image
                source={{ uri: stagedAttachment.uri }}
                style={{ width: 40, height: 40, borderRadius: 6 }}
                resizeMode="cover"
              />
            ) : null}
            <Text
              style={{ color: theme.colors.textPrimary, fontSize: 12, fontWeight: '600' }}
              numberOfLines={1}
            >
              {stagedAttachment.label}
            </Text>
          </View>
          <Pressable onPress={onClearAttachment} hitSlop={8}>
            <Text
              style={{ color: theme.colors.destructiveButtonText, fontSize: 11, fontWeight: '700' }}
            >
              Remove
            </Text>
          </Pressable>
        </View>
      )}

      {/* Composer Row */}
      <View className="flex-row items-end gap-2">
        <Pressable
          onPress={onOpenAttachmentMenu}
          accessibilityLabel="Attach photo"
          style={{
            width: 38,
            height: 38,
            borderRadius: theme.borderRadius ? 19 : 0,
            backgroundColor: theme.colors.badgeBg,
            borderColor: theme.colors.cardBorder,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.colors.accent, fontSize: 20, fontWeight: '600' }}>+</Text>
        </Pressable>

        <TextInput
          value={text}
          onChangeText={onChangeText}
          placeholder="Message or type /ootd..."
          placeholderTextColor={theme.colors.inputPlaceholder}
          multiline
          style={{
            flex: 1,
            maxHeight: 110,
            minHeight: 38,
            backgroundColor: theme.colors.inputBg,
            borderColor: theme.colors.inputBorder,
            borderWidth: 1,
            borderRadius: theme.borderRadius ? 18 : 0,
            color: theme.colors.inputText,
            paddingHorizontal: 14,
            paddingVertical: 8,
            fontSize: 14,
          }}
        />

        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityLabel="Send message"
          style={{
            height: 38,
            paddingHorizontal: 14,
            borderRadius: theme.borderRadius ? 19 : 0,
            backgroundColor: canSend ? theme.colors.accent : theme.colors.secondaryButtonBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: canSend ? theme.colors.accentText : theme.colors.textMuted,
              fontWeight: '700',
              fontSize: 13,
            }}
          >
            {isSending ? '...' : 'Send'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
