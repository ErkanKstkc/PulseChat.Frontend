'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AXIOS_INSTANCE } from '@/api/axios-instance';
import { signalRService, ChatMessageDto } from '@/lib/signalr';
import { useAuth } from './AuthContext';

export interface RoomMember {
  userId: string;
  role: string;
  joinedAt: string;
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
      const response = await AXIOS_INSTANCE.get('/api/Chat/rooms');
      if (response.data?.isSuccess && response.data?.data) {
        setRooms(response.data.data);
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

    // Fetch history from MongoDB via API
    AXIOS_INSTANCE.get(`/api/Chat/rooms/${activeRoomId}/messages`)
      .then((response) => {
        if (isMounted && response.data?.isSuccess && response.data?.data) {
          const fetchedMessages: DisplayMessage[] = response.data.data.map((m: ChatMessageDto) => ({
            ...m,
            isDelivered: true,
            isPending: false,
          }));
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
  }, [activeRoomId, isAuthenticated]);

  // 3. Register SignalR listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    // A. Receive incoming message
    const unsubReceive = signalRService.onReceiveMessage((newMsg) => {
      if (newMsg.roomId === activeRoomId) {
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

      // Update room last message preview
      setRooms((prev) =>
        prev.map((r) =>
          r.id === newMsg.roomId
            ? { ...r, lastMessage: newMsg.content }
            : r
        )
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
        if (notification.isOnline) {
          next.add(notification.userId);
        } else {
          next.delete(notification.userId);
        }
        return next;
      });
    });

    return () => {
      unsubReceive();
      unsubAck();
      unsubTyping();
      unsubPresence();
    };
  }, [isAuthenticated, activeRoomId, user?.id]);

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
      isPending: true,
    };

    // Optimistic UI update
    setMessages((prev) => [...prev, optimisticMessage]);

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
