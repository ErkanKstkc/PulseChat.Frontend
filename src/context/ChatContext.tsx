'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  getApiChatRooms,
  getApiChatRoomsRoomIdMessages,
  postApiChatRoomsRoomIdRead,
} from '@/api/generated/chat/chat';
import type { MessageDto } from '@/api/model';
import { signalRService, ChatMessageDto } from '@/lib/signalr';
import { useAuth } from './AuthContext';

export interface RoomMember {
  userId: string;
  role: string;
  joinedAt: string;
  lastReadAt?: string | null;
}

export interface Room {
  id: string;
  type: string | number;
  title: string;
  avatarUrl?: string | null;
  createdBy: string;
  createdAt: string;
  members: RoomMember[];
  lastMessage?: string;
  unreadCount?: number;
}

export interface DisplayMessage {
  id: string;
  clientMessageId: string;
  roomId: string;
  senderId: string;
  type: string;
  content: string;
  mediaUrl?: string | null;
  createdAt: string;
  isDelivered?: boolean;
  isRead?: boolean;
  isPending?: boolean;
}

interface ChatContextType {
  rooms: Room[];
  activeRoom: Room | null;
  activeRoomId: string | null;
  messages: DisplayMessage[];
  isLoadingRooms: boolean;
  isLoadingMessages: boolean;
  typingUsers: string[];
  onlineUsers: Set<string>;
  setActiveRoomId: (roomId: string) => void;
  sendMessage: (content: string, type?: string, mediaUrl?: string | null) => Promise<void>;
  sendTyping: () => void;
  refreshRooms: () => Promise<void>;
  markRoomAsRead: (roomId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const typingTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // 1. Fetch User Rooms
  const refreshRooms = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingRooms(true);
    try {
      const response = await getApiChatRooms();
      if (response?.isSuccess && response?.data) {
        setRooms(response.data as unknown as Room[]);
      }
    } catch (e) {
      console.error('[Chat] Failed to fetch rooms:', e);
    } finally {
      setIsLoadingRooms(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshRooms();
  }, [refreshRooms]);

  // Mark room as read
  const markRoomAsRead = useCallback(async (roomId: string) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r))
    );

    postApiChatRoomsRoomIdRead(roomId).catch((err) => {
      console.warn('[Chat] Failed to mark room as read via API:', err);
    });

    signalRService.markAsRead(roomId).catch((err) => {
      console.warn('[SignalR] Failed to invoke markAsRead:', err);
    });
  }, []);

  // 2. Fetch Messages when activeRoomId changes
  useEffect(() => {
    if (!activeRoomId || !isAuthenticated) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setIsLoadingMessages(true);

    // Join room in SignalR
    signalRService.joinRoom(activeRoomId).catch((err) => {
      console.warn('[SignalR] Failed to join room:', err);
    });

    // Mark room as read
    markRoomAsRead(activeRoomId);

    // Fetch history from MongoDB via Orval generated API
    getApiChatRoomsRoomIdMessages(activeRoomId)
      .then((response) => {
        if (isMounted && response?.isSuccess && response?.data) {
          const currentRoom = rooms.find((r) => r.id === activeRoomId);
          const otherMembers = currentRoom?.members?.filter((m) => m.userId !== user?.id) || [];
          const maxOtherLastRead = otherMembers.reduce((max, m) => {
            if (!m.lastReadAt) return max;
            const t = new Date(m.lastReadAt).getTime();
            return t > max ? t : max;
          }, 0);

          const fetchedMessages: DisplayMessage[] = response.data.map((m: MessageDto) => {
            const msgTime = new Date(m.createdAt || '').getTime();
            const isRead = maxOtherLastRead > 0 && msgTime <= maxOtherLastRead;
            return {
              id: m.id || '',
              clientMessageId: m.clientMessageId || '',
              roomId: m.roomId || activeRoomId,
              senderId: m.senderId || '',
              type: String(m.type ?? 'Text'),
              content: m.content || '',
              mediaUrl: m.mediaUrl || null,
              createdAt: m.createdAt || new Date().toISOString(),
              isDelivered: true,
              isRead,
              isPending: false,
            };
          });
          // Sort ascending (chronological) for chat view
          fetchedMessages.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setMessages(fetchedMessages);
        }
      })
      .catch((e) => {
        console.error('[Chat] Failed to load messages:', e);
      })
      .finally(() => {
        if (isMounted) setIsLoadingMessages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeRoomId, isAuthenticated, markRoomAsRead, rooms, user?.id]);

  // 3. Register SignalR listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    // A. Receive incoming message
    const unsubReceive = signalRService.onReceiveMessage((newMsg) => {
      const isCurrentActive = newMsg.roomId === activeRoomId;

      if (isCurrentActive) {
        if (newMsg.senderId !== user?.id) {
          markRoomAsRead(activeRoomId);
        }

        setMessages((prev) => {
          // Check if message was optimistically added
          const existingIndex = prev.findIndex(
            (m) => m.clientMessageId === newMsg.clientMessageId
          );
          if (existingIndex !== -1) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...newMsg,
              isDelivered: true,
              isPending: false,
            };
            return updated;
          }
          return [
            ...prev,
            {
              ...newMsg,
              isDelivered: true,
              isPending: false,
            },
          ];
        });
      }

      // Update room last message preview and unread counts
      setRooms((prev) =>
        prev.map((r) => {
          if (r.id === newMsg.roomId) {
            const unreadCount = isCurrentActive
              ? 0
              : newMsg.senderId === user?.id
              ? r.unreadCount || 0
              : (r.unreadCount || 0) + 1;

            return {
              ...r,
              lastMessage: newMsg.content,
              unreadCount,
            };
          }
          return r;
        })
      );
    });

    // B. Delivery Ack
    const unsubAck = signalRService.onMessageDeliveredAck((ack) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === ack.clientMessageId
            ? { ...m, isDelivered: true, isPending: false, id: ack.serverMessageId }
            : m
        )
      );
    });

    // C. Typing indicator
    const unsubTyping = signalRService.onUserTyping((notification) => {
      if (notification.roomId === activeRoomId && notification.userId !== user?.id) {
        setTypingUsers((prev) =>
          prev.includes(notification.userId) ? prev : [...prev, notification.userId]
        );

        if (typingTimeoutRef.current[notification.userId]) {
          clearTimeout(typingTimeoutRef.current[notification.userId]);
        }

        typingTimeoutRef.current[notification.userId] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((id) => id !== notification.userId));
        }, 3000);
      }
    });

    // D. Presence updates
    const unsubPresence = signalRService.onUserPresenceChanged((notification) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        const isOnline = notification.isOnline ?? (notification.status === 'online');
        if (isOnline) {
          next.add(notification.userId);
        } else {
          next.delete(notification.userId);
        }
        return next;
      });
    });

    // E. Messages Read (Receipts)
    const unsubMessagesRead = signalRService.onMessagesRead((notification) => {
      if (notification.roomId === activeRoomId && notification.userId !== user?.id) {
        const readTime = new Date(notification.readAt).getTime();
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === user?.id && new Date(m.createdAt).getTime() <= readTime
              ? { ...m, isRead: true, isDelivered: true }
              : m
          )
        );
      }
    });

    return () => {
      unsubReceive();
      unsubAck();
      unsubTyping();
      unsubPresence();
      unsubMessagesRead();
    };
  }, [isAuthenticated, activeRoomId, user?.id, markRoomAsRead]);

  // 4. Send Message
  const sendMessage = async (
    content: string,
    type: string = 'Text',
    mediaUrl?: string | null
  ) => {
    if (!activeRoomId || !user) return;

    const clientMessageId = crypto.randomUUID();
    const optimisticMessage: DisplayMessage = {
      id: clientMessageId,
      clientMessageId,
      roomId: activeRoomId,
      senderId: user.id,
      type,
      content,
      mediaUrl: mediaUrl || null,
      createdAt: new Date().toISOString(),
      isDelivered: false,
      isRead: false,
      isPending: true,
    };

    // Optimistic UI update
    setMessages((prev) => [...prev, optimisticMessage]);

    // Update room last message preview
    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId ? { ...r, lastMessage: content } : r
      )
    );

    try {
      await signalRService.sendMessage(
        activeRoomId,
        clientMessageId,
        content,
        type,
        mediaUrl
      );
    } catch (e) {
      console.error('[Chat] Failed to send message via SignalR:', e);
      // Mark as error / remove pending
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, isPending: false, isDelivered: false }
            : m
        )
      );
    }
  };

  // 5. Send Typing
  const sendTyping = () => {
    if (activeRoomId) {
      signalRService.sendTyping(activeRoomId).catch(console.error);
    }
  };

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;

  return (
    <ChatContext.Provider
      value={{
        rooms,
        activeRoom,
        activeRoomId,
        messages,
        isLoadingRooms,
        isLoadingMessages,
        typingUsers,
        onlineUsers,
        setActiveRoomId,
        sendMessage,
        sendTyping,
        refreshRooms,
        markRoomAsRead,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
