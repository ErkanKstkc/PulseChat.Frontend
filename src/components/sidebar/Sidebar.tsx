'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat, Room } from '@/context/ChatContext';
import { FriendsTab } from './FriendsTab';
import { NewRoomModal } from './NewRoomModal';
import {
  MessageSquare,
  Users,
  Search,
  Plus,
  LogOut,
  Radio,
  Hash,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { rooms, activeRoomId, setActiveRoomId, onlineUsers } = useChat();

  const [activeTab, setActiveTab] = useState<'chats' | 'friends'>('chats');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNewRoomModalOpen, setIsNewRoomModalOpen] = useState<boolean>(false);

  const filteredRooms = rooms.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-80 h-full flex flex-col glass-panel border-r border-white/10 select-none">
      {/* 1. Header & User Profile */}
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30 uppercase">
              {user?.username.slice(0, 2) || 'PC'}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0e131b]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white tracking-tight">
                {user?.username}
              </span>
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            </div>
            <span className="text-[11px] text-gray-400 block truncate max-w-[120px]">
              {user?.email}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          title="Çıkış Yap"
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Search & Action Bar */}
      <div className="p-3 space-y-2 border-b border-white/5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sohbet veya kişi ara..."
            className="w-full py-2 pl-9 pr-3 text-xs rounded-xl glass-input placeholder-gray-500"
          />
        </div>

        {/* Tab Buttons */}
        <div className="flex p-1 rounded-xl bg-black/40 border border-white/5">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'chats'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Sohbetler</span>
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'friends'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Arkadaşlar</span>
          </button>
        </div>
      </div>

      {/* 3. Main Content: Chats List or Friends Tab */}
      {activeTab === 'chats' ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-3 py-1 flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            <span>Odalar ({filteredRooms.length})</span>
            <button
              onClick={() => setIsNewRoomModalOpen(true)}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 normal-case font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Oda</span>
            </button>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              Henüz bir sohbet odası yok. Yukarıdaki &quot;Yeni Oda&quot; butonundan arkadaşlarınla bir oda kurabilirsin.
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isActive = activeRoomId === room.id;
              const otherMembers = room.members.filter((m) => m.userId !== user?.id);
              const isOtherOnline = otherMembers.some((m) => onlineUsers.has(m.userId));

              return (
                <div
                  key={room.id}
                  onClick={() => setActiveRoomId(room.id)}
                  className={`relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    isActive
                      ? 'bg-indigo-600/15 border border-indigo-500/30 text-white'
                      : 'hover:bg-white/5 border border-transparent text-gray-300'
                  }`}
                >
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-r-full shadow-lg shadow-indigo-500/50" />
                  )}

                  {/* Room Avatar */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-gray-800 to-gray-700 flex items-center justify-center text-sm font-semibold text-gray-200">
                      {room.type === 2 || room.type === 'Group' ? (
                        <Hash className="w-5 h-5 text-indigo-400" />
                      ) : (
                        room.title.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    {isOtherOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0e131b]" />
                    )}
                  </div>

                  {/* Room Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold truncate text-gray-100">
                        {room.title}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(room.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 truncate mt-0.5">
                      {room.lastMessage || 'Henüz mesaj yok...'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <FriendsTab />
      )}

      {/* New Room Modal */}
      <NewRoomModal
        isOpen={isNewRoomModalOpen}
        onClose={() => setIsNewRoomModalOpen(false)}
      />
    </aside>
  );
};
