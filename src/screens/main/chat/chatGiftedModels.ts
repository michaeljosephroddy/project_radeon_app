import * as api from '../../../api/client';
import { formatUsername } from '../../../utils/identity';
import { GiftedChatMessage, GiftedChatUser } from '../../../vendor/giftedChat';
import { ChatThreadCurrentUser } from './useChatThreadController';

export interface ChatGiftedMessage extends GiftedChatMessage {
    _id: string;
    text: string;
    createdAt: Date;
    user: GiftedChatUser;
    sent?: boolean;
    received?: boolean;
    pending?: boolean;
    apiMessage: api.Message;
}

export function toGiftedChatMessages(
    messages: api.Message[],
    currentUserId?: string,
    otherUserLastReadMessageId?: string | null,
): ChatGiftedMessage[] {
    const orderedMessages = [...messages];
    const messageIndexes = new Map(
        orderedMessages.map((message, index) => [message.id, index]),
    );
    const lastReadIndex = otherUserLastReadMessageId
        ? (messageIndexes.get(otherUserLastReadMessageId) ?? -1)
        : -1;

    return orderedMessages.reverse().map((message): ChatGiftedMessage => {
        const pending = message.id.startsWith('optimistic-');
        const isSystem = message.kind === 'system';
        const messageIndex = messageIndexes.get(message.id) ?? -1;
        const isOutgoing = !isSystem && message.sender_id === currentUserId;
        const isSeen = isOutgoing && lastReadIndex >= 0 && messageIndex >= 0 && messageIndex <= lastReadIndex;

        return {
            _id: message.id,
            text: message.body,
            createdAt: new Date(message.sent_at),
            user: {
                _id: isSystem ? 'system' : message.sender_id,
                name: isSystem ? 'System' : formatUsername(message.username),
                avatar: message.avatar_url,
            },
            system: isSystem,
            sent: !pending,
            received: !pending && isSeen,
            pending,
            apiMessage: message,
        };
    });
}

export function toGiftedChatUser(
    currentUser?: ChatThreadCurrentUser,
): GiftedChatUser | undefined {
    if (!currentUser) return undefined;

    return {
        _id: currentUser.id,
        name: formatUsername(currentUser.username),
        avatar: currentUser.avatar_url,
    };
}
