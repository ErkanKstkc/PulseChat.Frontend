'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AXIOS_INSTANCE } from '@/api/axios-instance';
import { useChat } from '@/context/ChatContext';
import { UserPlus, Check, X, Loader2, MessageCircle, Clock, Users } from 'lucide-react';

interface Friend {
  friendshipId: string;
  friendId: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
}

interface PendingRequest {
  friendshipId: string;
  requesterId: string;
  requesterUsername: string;
  requesterEmail: string;
  createdAt: string;
}

export const FriendsTab: React.FC = () => {
  const { onlineUsers, refreshRooms, setActiveRoomId, rooms } = useChat();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [targetUsername, setTargetUsername] = useState<string>('');
  const [isSendingRequest, setIsSendingRequest] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchFriendshipData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        AXIOS_INSTANCE.get('/api/Friendship'),
        AXIOS_INSTANCE.get('/api/Friendship/pending'),
      ]);

      if (friendsRes.data?.isSuccess) {
        setFriends(friendsRes.data.data || []);
      }
      if (pendingRes.data?.isSuccess) {
        setPendingRequests(pendingRes.data.data || []);
      }
    } catch (e) {
      console.error('Failed to load friends/pending:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriendshipData();
  }, [fetchFriendshipData]);

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;

    setIsSendingRequest(true);
    setActionMessage(null);

    try {
      const res = await AXIOS_INSTANCE.post('/api/Friendship/request', {
        targetUsername: targetUsername.trim(),
      });

      if (res.data?.isSuccess) {
        setActionMessage({ text: 'İstek başarıyla gönderildi!', isError: false });
        setTargetUsername('');
      } else {
        setActionMessage({ text: res.data?.message || 'İstek gönderilemedi.', isError: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'İstek gönderilirken hata oluştu.';
      setActionMessage({ text: msg, isError: true });
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleRespondRequest = async (friendshipId: string, accept: boolean) => {
    try {
      const res = await AXIOS_INSTANCE.post('/api/Friendship/respond', {
        friendshipId,
        accept,
      });

      if (res.data?.isSuccess) {
        await fetchFriendshipData();
      }
    } catch (e) {
      console.error('Failed to respond to friend request:', e);
    }
  };

  const handleStartDirectChat = async (friend: Friend) => {
    // Check if a direct room already exists with this friend
    const existingRoom = rooms.find((r) =>
      r.members.some((m) => m.userId === friend.friendId) && r.members.length === 2
    );

    if (existingRoom) {
      setActiveRoomId(existingRoom.id);
      return;
    }

    // Create a new direct room
    try {
      const res = await AXIOS_INSTANCE.post('/api/Chat/rooms', {
        title: friend.username,
        type: 1, // Direct
        avatarUrl: null,
        memberIds: [friend.friendId],
      });

      if (res.data?.isSuccess && res.data?.data) {
        await refreshRooms();
        setActiveRoomId(res.data.data.id);
      }
    } catch (e) {
      console.error('Failed to create direct room:', e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {/* Send Friend Request Form */}
      <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
        <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
          <span>Arkadaş Ekle</span>
        </div>
        <form onSubmit={handleSendFriendRequest} className="flex gap-2">
          <input
            type="text"
            value={targetUsername}
            onChange={(e) => setTargetUsername(e.target.value)}
            placeholder="Kullanıcı adı girin..."
            className="flex-1 py-1.5 px-3 text-xs rounded-lg glass-input placeholder-gray-500"
            required
          />
          <button
            type="submit"
            disabled={isSendingRequest}
            className="py-1.5 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {isSendingRequest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Gönder'}
          </button>
        </form>
        {actionMessage && (
          <div
            className={`text-[11px] p-2 rounded-lg ${
              actionMessage.isError
                ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
            }`}
          >
            {actionMessage.text}
          </div>
        )}
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-400 px-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Bekleyen İstekler</span>
            </div>
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-600/30 text-indigo-300">
              {pendingRequests.length}
            </span>
          </div>

          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.friendshipId}
                className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white uppercase">
                    {req.requesterUsername.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">{req.requesterUsername}</div>
                    <div className="text-[10px] text-gray-400">{req.requesterEmail}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRespondRequest(req.friendshipId, true)}
                    title="Kabul Et"
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRespondRequest(req.friendshipId, false)}
                    title="Reddet"
                    className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-400 px-1">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>Arkadaşlarım</span>
          </div>
          <span className="text-[11px] text-gray-500">{friends.length}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-6 text-xs text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Yükleniyor...
          </div>
        ) : friends.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500 rounded-xl bg-black/10 border border-white/5">
            Henüz ekli arkadaşın bulunmuyor.
          </div>
        ) : (
          <div className="space-y-1.5">
            {friends.map((friend) => {
              const isOnline = onlineUsers.has(friend.friendId);
              return (
                <div
                  key={friend.friendId}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white uppercase">
                        {friend.username.slice(0, 2)}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0e131b] ${
                          isOnline ? 'bg-emerald-500' : 'bg-gray-500'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-200">{friend.username}</div>
                      <div className="text-[10px] text-gray-500">
                        {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartDirectChat(friend)}
                    className="p-1.5 text-gray-400 hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition-all opacity-0 group-hover:opacity-100"
                    title="Mesaj Gönder"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
