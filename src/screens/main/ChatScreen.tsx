import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatHeader } from './chat/ChatHeader';
import { ChatBody } from './chat/ChatBody';
import { MessageComposerDock } from './chat/MessageComposerDock';
import { MessageThreadList } from './chat/MessageThreadList';
import { useChatThreadController } from './chat/useChatThreadController';
import { useKeyboardInsetAnimation } from './chat/useKeyboardInsetAnimation';

interface Props {
    chat: api.Chat;
    onBack: () => void;
}

export function ChatScreen({ chat, onBack }: Props) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [draft, setDraft] = useState('');
    const threadBottomSlack = useSharedValue(0);
    const displayName = chat.is_group
        ? (chat.name ?? 'Group')
        : formatUsername(chat.username);
    const recipientLabel = chat.is_group
        ? (chat.name ?? 'Group')
        : formatUsername(chat.username);
    const currentUser = useMemo(() => (user ? {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
    } : undefined), [user]);

    const {
        messages,
        loading,
        loadingOlder,
        hasMore,
        sending,
        mutation,
        sendMessage,
        loadOlderMessages,
    } = useChatThreadController({
        chatId: chat.id,
        currentUser,
    });

    const {
        threadAnimatedStyle,
        composerAnimatedStyle,
        composerBottomPadding,
    } = useKeyboardInsetAnimation(insets.bottom, threadBottomSlack);

    useEffect(() => {
        setDraft('');
        threadBottomSlack.value = 0;
    }, [chat.id]);

    const handleBottomSlackChange = useCallback((slack: number) => {
        threadBottomSlack.value = slack;
    }, []);

    const handleSend = useCallback(async () => {
        const body = draft.trim();
        if (!body || sending) return;
        setDraft('');
        await sendMessage(body);
    }, [draft, sendMessage, sending]);

    return (
        <View style={styles.container}>
            <ChatHeader
                chat={chat}
                displayName={displayName}
                onBack={onBack}
            />

            <ChatBody
                threadAnimatedStyle={threadAnimatedStyle}
                composerAnimatedStyle={composerAnimatedStyle}
                thread={loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={Colors.primary} />
                    </View>
                ) : (
                    <MessageThreadList
                        messages={messages}
                        hasMore={hasMore}
                        loadingOlder={loadingOlder}
                        onLoadOlder={loadOlderMessages}
                        onBottomSlackChange={handleBottomSlackChange}
                        mutation={mutation}
                        currentUser={currentUser}
                        chat={chat}
                    />
                )}
                composer={(
                    <MessageComposerDock
                        draft={draft}
                        sending={sending}
                        recipientLabel={recipientLabel}
                        bottomPadding={composerBottomPadding}
                        onChangeDraft={setDraft}
                        onSend={handleSend}
                    />
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
