import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { formatDateTimeKa } from '@lokacia/contracts';
import { AuthGate } from '../../components/auth-gate';
import { Screen } from '../../components/screen';
import { EmptyState, ErrorBox, IconButton, Loading, Txt } from '../../components/ui';
import { endpoints, type MessageDto } from '../../lib/api';
import { errorMessage } from '../../lib/api-client';
import { t } from '../../lib/i18n';
import { useRealtime } from '../../lib/realtime';
import { useSession } from '../../lib/session';
import { useAsync } from '../../lib/use-async';
import { useAppTheme } from '../../theme/theme';
import { fonts, radius, space } from '../../theme/tokens';

function Thread({ id }: { id: string }) {
  const { colors } = useAppTheme();
  const { user } = useSession();
  const conv = useAsync(() => endpoints.conversation(id), [id]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { connected } = useRealtime(true, {
    message: (p) => {
      const m = p as MessageDto;
      if (m.conversationId !== id) return;
      msgs.setData((prev) => (prev?.some((x) => x.id === m.id) ? prev : [...(prev ?? []), m]));
      if (m.senderId !== user?.id) void endpoints.markRead(id).catch(() => undefined);
    },
  });
  // REST polling is the fallback when the socket is down (slower when live)
  const msgs = useAsync(async () => (await endpoints.messages(id)).items, [id], { pollMs: connected ? 60_000 : 5_000 });

  const markRead = useCallback(() => void endpoints.markRead(id).catch(() => undefined), [id]);
  useEffect(markRead, [markRead]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      const m = await endpoints.sendMessage(id, text);
      setBody('');
      msgs.setData((prev) => (prev?.some((x) => x.id === m.id) ? prev : [...(prev ?? []), m]));
    } catch (e) {
      setError(errorMessage(e, t('common.networkError')));
    } finally {
      setSending(false);
    }
  };

  const data = [...(msgs.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: conv.data?.other?.name ?? t('messages.title') }} />
      <Screen edges={['bottom']}>
        {conv.data?.listing ? (
          <View style={{ paddingHorizontal: space(2), paddingVertical: space(1), borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', gap: space(1) }}>
            <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>
              {conv.data.listing.title}
            </Txt>
            <Txt variant="small" color={connected ? 'success' : 'textMuted'}>
              {connected ? t('messages.live') : t('messages.polling')}
            </Txt>
          </View>
        ) : null}
        {msgs.error && !msgs.data ? <ErrorBox message={errorMessage(msgs.error, t('common.networkError'))} onRetry={() => void msgs.reload()} /> : null}
        <FlatList
          inverted={data.length > 0}
          data={data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space(2), gap: space(1) }}
          ListEmptyComponent={msgs.loading ? <Loading /> : <EmptyState title={t('messages.threadEmpty')} />}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id;
            return (
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: mine ? colors.primary : colors.surface, borderColor: colors.border, borderWidth: mine ? 0 : 1, borderRadius: radius.card, paddingHorizontal: space(1.5), paddingVertical: space(1) }}>
                <Txt style={{ color: mine ? colors.primaryContrast : colors.text }}>{item.body}</Txt>
                <Txt variant="small" style={{ color: mine ? colors.primaryContrast : colors.textMuted, opacity: 0.8 }}>
                  {formatDateTimeKa(item.createdAt)}
                </Txt>
              </View>
            );
          }}
        />
        {error ? (
          <Txt variant="small" color="danger" style={{ paddingHorizontal: space(2) }}>
            {error}
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space(1), padding: space(1.5), borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={t('messages.placeholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('messages.placeholder')}
            multiline
            maxLength={4000}
            style={{ flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: colors.border, borderRadius: radius.button, paddingHorizontal: space(1.5), paddingVertical: space(1), color: colors.text, fontFamily: fonts.regular, fontSize: 16, backgroundColor: colors.bg }}
          />
          <IconButton icon={Send} label={t('messages.send')} onPress={sending ? undefined : () => void send()} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <AuthGate>
      <Thread id={id} />
    </AuthGate>
  );
}
