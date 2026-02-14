import { supabase } from './supabase';

const NOTIFIED_MESSAGES_KEY = 'notified_message_ids';
const NOTIFICATION_PERMISSION_REQUESTED = 'notification_permission_requested';

interface UnreadMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar: string | null;
  content: string;
  created_at: string;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return false;
  }

  const alreadyRequested = localStorage.getItem(NOTIFICATION_PERMISSION_REQUESTED);

  if (Notification.permission === 'granted') {
    localStorage.setItem(NOTIFICATION_PERMISSION_REQUESTED, 'true');
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  if (!alreadyRequested) {
    const permission = await Notification.requestPermission();
    localStorage.setItem(NOTIFICATION_PERMISSION_REQUESTED, 'true');
    return permission === 'granted';
  }

  return false;
}

function getNotifiedMessageIds(): Set<string> {
  const stored = localStorage.getItem(NOTIFIED_MESSAGES_KEY);
  if (!stored) return new Set();

  try {
    return new Set(JSON.parse(stored));
  } catch {
    return new Set();
  }
}

function markMessageAsNotified(messageId: string) {
  const notified = getNotifiedMessageIds();
  notified.add(messageId);

  const array = Array.from(notified);
  if (array.length > 100) {
    array.splice(0, array.length - 100);
  }

  localStorage.setItem(NOTIFIED_MESSAGES_KEY, JSON.stringify(array));
}

async function fetchUnreadMessages(userId: string): Promise<UnreadMessage[]> {
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

  if (!conversations || conversations.length === 0) {
    return [];
  }

  const conversationIds = conversations.map(c => c.id);

  const { data: messages } = await supabase
    .from('messages')
    .select(`
      id,
      content,
      created_at,
      sender_id,
      read,
      sender:profiles!messages_sender_id_fkey(
        username,
        avatar_url
      )
    `)
    .in('conversation_id', conversationIds)
    .neq('sender_id', userId)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!messages || messages.length === 0) {
    return [];
  }

  return messages.map(msg => ({
    id: msg.id,
    sender_id: msg.sender_id,
    sender_username: (msg.sender as any)?.username || 'Unknown',
    sender_avatar: (msg.sender as any)?.avatar_url || null,
    content: msg.content,
    created_at: msg.created_at
  }));
}

function showNotification(message: UnreadMessage) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const notified = getNotifiedMessageIds();
  if (notified.has(message.id)) {
    return;
  }

  const title = `New message from @${message.sender_username}`;
  const body = message.content.length > 100
    ? message.content.substring(0, 97) + '...'
    : message.content;

  const notification = new Notification(title, {
    body,
    icon: message.sender_avatar || '/icon-192x192.png',
    badge: '/icon-96x96.png',
    tag: `message-${message.id}`,
    requireInteraction: false,
    silent: false
  });

  notification.onclick = () => {
    window.focus();
    window.location.href = '/inbox';
    notification.close();
  };

  markMessageAsNotified(message.id);
}

export async function checkAndNotifyNewMessages(userId: string): Promise<number> {
  if (!userId) return 0;

  if (Notification.permission !== 'granted') {
    return 0;
  }

  const unreadMessages = await fetchUnreadMessages(userId);

  if (unreadMessages.length === 0) {
    return 0;
  }

  const notified = getNotifiedMessageIds();
  const newMessages = unreadMessages.filter(msg => !notified.has(msg.id));

  if (newMessages.length === 0) {
    return 0;
  }

  const messagesToNotify = newMessages.slice(0, 3);

  messagesToNotify.forEach((message, index) => {
    setTimeout(() => {
      showNotification(message);
    }, index * 500);
  });

  return newMessages.length;
}

export function hasNotificationPermission(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

export function clearNotifiedMessages() {
  localStorage.removeItem(NOTIFIED_MESSAGES_KEY);
}
