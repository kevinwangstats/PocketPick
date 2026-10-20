import React, { useState } from 'react';
import { View, Modal, Pressable, Text } from 'react-native';
import { Button, Input, H2, Label, ErrorText } from '../ui';
import { TicketPayload } from '../../services/tickets/ticketService';

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
      <View className="flex-1 bg-black/90 justify-center px-5">
        <View className="bg-black border border-zinc-700 p-6">
          <View className="flex-row justify-between items-center mb-4">
            <H2>{initialData ? 'EDIT TICKET' : 'NEW TICKET'}</H2>
            <Pressable onPress={onClose}>
              <Text className="text-zinc-500 font-mono text-base">[CLOSE]</Text>
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

          <Button variant="primary" loading={isSubmitting} onPress={handleSubmit} className="mt-2">
            ENCRYPT & SAVE
          </Button>
        </View>
      </View>
    </Modal>
  );
};
