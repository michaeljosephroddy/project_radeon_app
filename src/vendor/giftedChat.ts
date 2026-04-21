import React from 'react';
import {
    FlatListProps,
    StyleProp,
    TextProps,
    TextStyle,
    TextInputProps,
    ViewStyle,
} from 'react-native';

export interface GiftedChatUser {
    _id: string | number;
    name?: string;
    avatar?: string | number;
}

export interface GiftedChatMessage {
    _id: string | number;
    text: string;
    createdAt: Date | number;
    user: GiftedChatUser;
    sent?: boolean;
    received?: boolean;
    pending?: boolean;
    system?: boolean;
}

export interface BubbleProps<TMessage extends GiftedChatMessage> {
    currentMessage: TMessage;
    previousMessage?: TMessage;
    nextMessage?: TMessage;
    position: 'left' | 'right';
    wrapperStyle?: {
        left?: StyleProp<ViewStyle>;
        right?: StyleProp<ViewStyle>;
    };
    textStyle?: {
        left?: StyleProp<TextStyle>;
        right?: StyleProp<TextStyle>;
    };
    renderTime?: (props: {
        currentMessage: TMessage;
        position?: 'left' | 'right';
    }) => React.ReactNode;
}

export interface DayProps {
    createdAt: Date | number;
    containerStyle?: StyleProp<ViewStyle>;
    wrapperStyle?: StyleProp<ViewStyle>;
    textProps?: Partial<TextProps>;
}

export interface ComposerProps {
    text?: string;
    textInputProps?: Partial<TextInputProps>;
}

export interface SendProps<TMessage extends GiftedChatMessage> {
    text?: string;
    isSendButtonAlwaysVisible?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
    sendButtonProps?: {
        enabled?: boolean;
        style?: StyleProp<ViewStyle>;
    };
    onSend?(
        messages: Partial<TMessage> | Partial<TMessage>[],
        shouldResetInputToolbar: boolean,
    ): void;
    children?: React.ReactNode;
}

export interface InputToolbarProps<TMessage extends GiftedChatMessage> {
    text?: string;
    containerStyle?: StyleProp<ViewStyle>;
    primaryStyle?: StyleProp<ViewStyle>;
    textInputProps?: Partial<TextInputProps>;
    renderComposer?: (props: ComposerProps) => React.ReactNode;
    renderSend?: (props: SendProps<TMessage>) => React.ReactNode;
    onSend?: (
        messages: Partial<TMessage> | Partial<TMessage>[],
        shouldResetInputToolbar: boolean,
    ) => void;
    isSendButtonAlwaysVisible?: boolean;
}

export interface LoadEarlierMessagesProps {
    isAvailable?: boolean;
    isLoading?: boolean;
    onPress: () => void | Promise<void>;
    label?: string;
}

export interface GiftedChatProps<TMessage extends GiftedChatMessage> {
    messages: TMessage[];
    user?: GiftedChatUser;
    onSend?: (messages: TMessage[]) => void;
    loadEarlierMessagesProps?: LoadEarlierMessagesProps;
    messagesContainerStyle?: StyleProp<ViewStyle>;
    isAlignedTop?: boolean;
    isInverted?: boolean;
    isUserAvatarVisible?: boolean;
    isAvatarVisibleForEveryMessage?: boolean;
    isSendButtonAlwaysVisible?: boolean;
    isScrollToBottomEnabled?: boolean;
    scrollToBottomOffset?: number;
    isDayAnimationEnabled?: boolean;
    minInputToolbarHeight?: number;
    keyboardAvoidingViewProps?: {
        keyboardVerticalOffset?: number;
    };
    listProps?: Partial<FlatListProps<TMessage>>;
    renderBubble?: (props: BubbleProps<TMessage>) => React.ReactNode;
    renderDay?: (props: DayProps) => React.ReactNode;
    renderInputToolbar?: (props: InputToolbarProps<TMessage>) => React.ReactNode;
    renderAvatar?: ((props: { currentMessage: TMessage }) => React.ReactNode) | null;
    renderLoading?: () => React.ReactNode;
    renderChatEmpty?: () => React.ReactNode;
}

type GiftedChatModule = {
    GiftedChat: React.ComponentType<GiftedChatProps<GiftedChatMessage>>;
    InputToolbar: React.ComponentType<InputToolbarProps<GiftedChatMessage>>;
    Composer: React.ComponentType<ComposerProps>;
    Send: React.ComponentType<SendProps<GiftedChatMessage>>;
    Bubble: React.ComponentType<BubbleProps<GiftedChatMessage>>;
    Day: React.ComponentType<DayProps>;
};

const giftedChatModule = require('react-native-gifted-chat') as GiftedChatModule;

export const GiftedChat = giftedChatModule.GiftedChat as unknown as <
    TMessage extends GiftedChatMessage,
>(props: GiftedChatProps<TMessage>) => React.ReactElement;

export const InputToolbar = giftedChatModule.InputToolbar as unknown as <
    TMessage extends GiftedChatMessage,
>(props: InputToolbarProps<TMessage>) => React.ReactElement;

export const Composer = giftedChatModule.Composer;

export const Send = giftedChatModule.Send as unknown as <
    TMessage extends GiftedChatMessage,
>(props: SendProps<TMessage>) => React.ReactElement;

export const Bubble = giftedChatModule.Bubble as unknown as <
    TMessage extends GiftedChatMessage,
>(props: BubbleProps<TMessage>) => React.ReactElement;

export const Day = giftedChatModule.Day;
