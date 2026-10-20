import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, Label, Body } from '../ui';
import { DecryptedTicket } from '../../services/tickets/ticketService';

export interface TicketCardProps {
  ticket: DecryptedTicket;
  onPress?: () => void;
  onDelete?: () => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onPress, onDelete }) => {
  return (
    <Card className="mb-3">
      <Pressable onPress={onPress} className="active:opacity-80">
        <View className="flex-row justify-between items-center mb-1.5">
          <Label className="text-white font-bold">{ticket.title}</Label>
          <View className="px-2 py-0.5 bg-zinc-900 border border-zinc-700">
            <Text className="text-xs font-mono text-zinc-300">W: {ticket.weight}</Text>
          </View>
        </View>

        {ticket.content ? (
          <Body className="text-zinc-400 text-sm mb-3" numberOfLines={3}>
            {ticket.content}
          </Body>
        ) : (
          <Body className="text-zinc-600 text-sm mb-3">No content details.</Body>
        )}
      </Pressable>

      {onDelete && (
        <View className="border-t border-zinc-900 pt-2 flex-row justify-end">
          <Pressable
            onPress={onDelete}
            className="px-2.5 py-1 bg-zinc-950 border border-red-900 active:bg-red-950"
          >
            <Text className="text-xs font-mono text-red-400 uppercase tracking-wider">DELETE</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
};
