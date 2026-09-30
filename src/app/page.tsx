'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { MessageSquare, Loader2 } from 'lucide-react';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#090c11]">
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-indigo-600/30">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -inset-2 bg-indigo-500/20 rounded-full blur-xl pointer-events-none animate-pulse" />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span>PulseChat Yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#090c11]">
      {!isAuthenticated && <AuthModal />}
      <Sidebar />
      <ChatArea />
    </div>
  );
}
