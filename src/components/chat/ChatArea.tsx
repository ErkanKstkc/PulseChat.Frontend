'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat, DisplayMessage } from '@/context/ChatContext';
import { AXIOS_INSTANCE } from '@/api/axios-instance';
import {
  Send,
  Paperclip,
  Check,
  CheckCheck,
  Clock,
  MessageSquare,
  Users,
  Image as ImageIcon,
  Loader2,
  X,
} from 'lucide-react';

export const ChatArea: React.FC = () => {
  const { user } = useAuth();
  const { activeRoom, messages, sendMessage, sendTyping, typingUsers } = useChat();

  const [inputContent, setInputContent] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputContent(e.target.value);
    sendTyping();
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(file));
      } else {
        setFilePreview(null);
      }
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputContent.trim() && !selectedFile) || isUploading) return;

    let mediaUrl: string | null = null;
    let messageType = 'Text';

    // 1. If file attached, upload to MinIO via /api/Media/upload
    if (selectedFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('File', selectedFile);

        const uploadRes = await AXIOS_INSTANCE.post('/api/Media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (uploadRes.data?.isSuccess && uploadRes.data?.data) {
          mediaUrl = uploadRes.data.data.url;
          messageType = selectedFile.type.startsWith('image/') ? 'Image' : 'File';
        }
      } catch (err) {
        console.error('[Upload] File upload failed:', err);
        alert('Dosya yüklenirken hata oluştu.');
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const contentToSend = inputContent.trim() || (mediaUrl ? selectedFile?.name || 'Ek' : '');
    setInputContent('');
    clearSelectedFile();

    await sendMessage(contentToSend, messageType, mediaUrl);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!activeRoom) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-8 bg-[#090c11] text-center select-none">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600/30 to-cyan-500/30 flex items-center justify-center border border-white/10 shadow-2xl">
            <MessageSquare className="w-10 h-10 text-indigo-400" />
          </div>
          <div className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">PulseChat&apos;e Hoş Geldin</h2>
        <p className="max-w-md text-sm text-gray-400 leading-relaxed">
          Sohbet etmek için sol menüden mevcut bir odayı seçebilir veya &quot;Yeni Oda&quot; butonuna tıklayarak arkadaşlarınla yeni bir sohbet başlatabilirsin.
        </p>
      </div>
    );
  }

  return (
    <main className="flex-1 h-full flex flex-col bg-[#090c11] overflow-hidden">
      {/* 1. Room Header */}
      <header className="h-16 px-6 flex items-center justify-between glass-panel border-b border-white/10 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-sm">
            {activeRoom.title.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{activeRoom.title}</h2>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Users className="w-3 h-3 text-indigo-400" />
              <span>{activeRoom.members.length} üye</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-gray-500">
            Bu odada henüz mesaj yok. İlk mesajı göndererek sohbeti başlat!
          </div>
        ) : (
          messages.map((msg: DisplayMessage) => {
            const isMe = msg.senderId === user?.id;

            return (
              <div
                key={msg.clientMessageId || msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-message-enter`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-md ${
                    isMe
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-none'
                      : 'glass-card text-gray-200 rounded-bl-none border border-white/10'
                  }`}
                >
                  {/* Media attachment */}
                  {msg.mediaUrl && (
                    <div className="mb-2 overflow-hidden rounded-xl">
                      {msg.type === 'Image' ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={msg.mediaUrl}
                          alt="Paylaşılan Görsel"
                          className="max-h-60 w-auto rounded-lg object-cover hover:opacity-95 cursor-pointer transition-opacity"
                          onClick={() => window.open(msg.mediaUrl || '', '_blank')}
                        />
                      ) : (
                        <a
                          href={msg.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded-lg bg-black/30 hover:bg-black/40 text-xs text-indigo-200 transition-colors"
                        >
                          <Paperclip className="w-4 h-4" />
                          <span className="underline truncate">{msg.content || 'Dosyayı İndir'}</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Text content */}
                  {msg.content && msg.type !== 'File' && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  )}

                  {/* Timestamp & Delivery status */}
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isMe ? 'text-indigo-200' : 'text-gray-400'
                    }`}
                  >
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isMe && (
                      <span>
                        {msg.isPending ? (
                          <Clock className="w-3 h-3 text-indigo-300 animate-spin" />
                        ) : msg.isDelivered ? (
                          <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                        ) : (
                          <Check className="w-3 h-3 text-indigo-300" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Typing Indicator Banner */}
      {typingUsers.length > 0 && (
        <div className="px-6 py-1.5 flex items-center gap-2 text-xs text-cyan-400 bg-cyan-950/20 border-t border-cyan-500/10">
          <div className="flex gap-1">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
          <span>Biri yazıyor...</span>
        </div>
      )}

      {/* 4. Chat Input Bar */}
      <footer className="p-4 glass-panel border-t border-white/10">
        {/* Selected file preview */}
        {selectedFile && (
          <div className="mb-2 p-2 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <ImageIcon className="w-4 h-4 text-indigo-400" />
              <span className="truncate max-w-xs">{selectedFile.name}</span>
              <span className="text-[10px] text-gray-500">
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button
              onClick={clearSelectedFile}
              className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          {/* File Attachment Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.zip"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Dosya / Görsel Ekle"
            className="p-3 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              value={inputContent}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Bir mesaj yazın... (Göndermek için Enter)"
              rows={1}
              className="w-full py-3 px-4 text-sm rounded-xl glass-input placeholder-gray-500 resize-none max-h-32 focus:outline-none"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!inputContent.trim() && !selectedFile) || isUploading}
            className="p-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-40 disabled:hover:from-indigo-600"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </footer>
    </main>
  );
};
