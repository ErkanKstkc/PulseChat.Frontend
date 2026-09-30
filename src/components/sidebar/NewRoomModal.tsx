'use client';

import React, { useState, useEffect } from 'react';
import { getApiFriendship } from '@/api/generated/friendship/friendship';
import { postApiChatRooms } from '@/api/generated/chat/chat';
import type { FriendDto } from '@/api/model';
import { RoomType } from '@/api/model/roomType';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useToast } from '@/context/ToastContext';
import { X, Users, MessageSquare, Loader2, Check } from 'lucide-react';

interface Friend {
  friendshipId: string;
  friendId: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
}

interface NewRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewRoomModal: React.FC<NewRoomModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { refreshRooms, setActiveRoomId } = useChat();
  const { toast } = useToast();

  const [title, setTitle] = useState<string>('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoadingFriends(true);
    setError(null);
    getApiFriendship()
      .then((res) => {
        if (res?.isSuccess && res?.data) {
          setFriends(
            res.data.map((f: FriendDto) => ({
              friendshipId: f.friendshipId || '',
              friendId: f.userId || '',
              username: f.username || 'Kullanıcı',
              email: '',
              avatarUrl: f.avatarUrl || null,
            }))
          );
        }
      })
      .catch((e) => {
        console.error('Failed to load friends for new room:', e);
      })
      .finally(() => {
        setIsLoadingFriends(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelectFriend = (friendId: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Lütfen oda başlığı belirleyin.');
      toast.warning('Lütfen bir oda başlığı belirleyin.', 'Eksik Bilgi');
      return;
    }

    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    const memberIds = Array.from(new Set([user.id, ...selectedFriendIds]));
    const roomType = memberIds.length > 2 ? RoomType.NUMBER_1 : RoomType.NUMBER_0; // 0 = Direct, 1 = Group

    try {
      const response = await postApiChatRooms({
        title: title.trim(),
        type: roomType,
        avatarUrl: null,
        memberIds,
      });

      if (response?.isSuccess && response?.data?.id) {
        const newRoom = response.data;
        toast.success(`"${title.trim()}" odası başarıyla oluşturuldu!`, 'Oda Hazır');
        await refreshRooms();
        setActiveRoomId(newRoom.id as string);
        onClose();
      } else {
        const errorMsg = response?.message || 'Oda oluşturulamadı.';
        toast.error(errorMsg, 'Hata');
        setError(errorMsg);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const msg =
        axiosErr.response?.data?.message || axiosErr.message || 'Oda oluşturulurken hata meydana geldi.';
      toast.error(msg, 'Oda Oluşturulamadı');
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md p-6 overflow-hidden rounded-2xl glass-card border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">Yeni Sohbet Başlat</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-300">
              Sohbet / Oda Başlığı
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Proje Sohbeti veya Ahmet"
              className="w-full py-2.5 px-3.5 text-sm rounded-xl glass-input placeholder-gray-500"
              required
            />
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-300">
              Üye Seç (Arkadaşların)
            </label>
            {isLoadingFriends ? (
              <div className="flex items-center justify-center p-4 text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Arkadaşlar yükleniyor...
              </div>
            ) : friends.length === 0 ? (
              <div className="p-4 text-xs text-center text-gray-400 rounded-xl bg-black/20 border border-white/5">
                Henüz ekli arkadaşın yok. Önce Arkadaşlar sekmesinden istek gönderip kabul ettirmelisin.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {friends.map((friend) => {
                  const isSelected = selectedFriendIds.includes(friend.friendId);
                  return (
                    <div
                      key={friend.friendId}
                      onClick={() => toggleSelectFriend(friend.friendId)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                          : 'bg-black/20 border-white/5 hover:bg-white/5 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white uppercase">
                          {friend.username.slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-xs font-semibold">{friend.username}</div>
                          <div className="text-[10px] text-gray-400">{friend.email}</div>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'border-white/20'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 text-xs font-medium text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2.5 px-5 flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>Oda Oluştur</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
