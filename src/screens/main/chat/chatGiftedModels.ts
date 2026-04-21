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

export function toGiftedChatMessages(messages: api.Message[]): ChatGiftedMessage[] {
    return [...messages].reverse().map((message): ChatGiftedMessage => {
        const pending = message.id.startsWith('optimistic-');

        return {
            _id: message.id,
            text: message.body,
            createdAt: new Date(message.sent_at),
            user: {
                _id: message.sender_id,
                name: formatUsername(message.username),
                avatar: message.avatar_url,
            },
            sent: !pending,
            received: !pending,
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
