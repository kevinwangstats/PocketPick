import React, { useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Button, Input, H2, Label, ErrorText } from '../ui';
import { TicketPayload } from '../../services/tickets/ticketService';
import { useTheme } from '../../theme';

export interface TicketEditorModalProps {
  visible: boolean;
  initialData?: TicketPayload;
  onClose: () => void;
  onSubmit: (payload: TicketPayload) => Promise<void>;
}

export const TicketEditorModal: React.FC<TicketEditorModalProps> = ({
  visible,
  initialData,
  onClose,
  onSubmit,
}) => {
  const { theme } = useTheme();
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [weight, setWeight] = useState(String(initialData?.weight ?? 1));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    const parsedWeight = parseInt(weight, 10);
    if (isNaN(parsedWeight) || parsedWeight < 1 || parsedWeight > 100) {
      setError('Weight must be an integer between 1 and 100');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        weight: parsedWeight,
      });
      setTitle('');
      setContent('');
      setWeight('1');
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to save ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          backgroundColor: theme.isDark ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          paddingHorizontal: 20,
        }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 14 : 0,
              padding: 24,
              marginVertical: 'auto',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 5,
            }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <H2>
                {initialData
                  ? theme.isUppercase
                    ? 'EDIT TICKET'
                    : 'Edit Ticket'
                  : theme.isUppercase
                    ? 'NEW TICKET'
                    : 'New Ticket'}
              </H2>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text
                  style={{
                    color: theme.colors.accent,
                    fontFamily: theme.isMono ? 'Courier' : undefined,
                    fontWeight: '600',
                    fontSize: 14,
                  }}
                >
                  {theme.isUppercase ? '[CLOSE]' : 'Close'}
                </Text>
              </Pressable>
            </View>

            <Label className="mb-4">Encrypted payload stored in SQLite.</Label>

            <Input
              label="Ticket Title / Prompt"
              placeholder="e.g. Read Chapter 4, Call Dentist..."
              value={title}
              onChangeText={setTitle}
            />

            <Input
              label="Details & Content"
              placeholder="Optional text details..."
              multiline
              numberOfLines={3}
              value={content}
              onChangeText={setContent}
            />

            <Input
              label="Selection Weight (1 - 100)"
              placeholder="1"
              keyboardType="number-pad"
              isMono
              value={weight}
              onChangeText={setWeight}
            />

            {error && <ErrorText className="mb-3">{error}</ErrorText>}

            <Button
              variant="primary"
              loading={isSubmitting}
              onPress={handleSubmit}
              className="mt-2"
            >
              {theme.isUppercase ? 'ENCRYPT & SAVE' : 'Encrypt & Save'}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};
