'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Lock, Mail, User as UserIcon, MessageSquare, Loader2, ArrowRight } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { login, register, isLoading } = useAuth();
  const { toast } = useToast();
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);

  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (isRegisterMode) {
        if (!username || !email || !password) {
          setError('Lütfen tüm alanları doldurun.');
          toast.warning('Lütfen tüm alanları doldurun.', 'Eksik Bilgi');
          return;
        }
        await register(username, email, password);
        toast.success('Hesabınız başarıyla oluşturuldu!', 'Hoş Geldiniz');
      } else {
        if (!email || !password) {
          setError('Lütfen e-posta/kullanıcı adı ve şifrenizi girin.');
          toast.warning('Lütfen kullanıcı adı ve şifrenizi girin.', 'Eksik Bilgi');
          return;
        }
        await login(email, password);
        toast.success('Oturum başarıyla açıldı!', 'Giriş Başarılı');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'İşlem sırasında bir hata oluştu.';
      setError(msg);
      toast.error(msg, isRegisterMode ? 'Kayıt Yapılamadı' : 'Giriş Başarısız');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md p-8 overflow-hidden rounded-2xl glass-card border border-white/10 shadow-2xl shadow-indigo-500/10">
        {/* Glowing Background Blob */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-4 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-500/30">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Pulse<span className="text-indigo-400">Chat</span>
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {isRegisterMode ? 'Yeni bir hesap oluşturun' : 'Hesabınıza giriş yapın'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="relative flex p-1 mb-6 rounded-xl bg-black/40 border border-white/5">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(false);
              setError(null);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              !isRegisterMode
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Giriş Yap
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(true);
              setError(null);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              isRegisterMode
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Kayıt Ol
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 mb-6 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="relative space-y-4">
          {isRegisterMode && (
            <div>
              <label className="block mb-1.5 text-xs font-medium text-gray-300">
                Kullanıcı Adı
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ornek_kullanici"
                  className="w-full py-2.5 pl-10 pr-4 text-sm rounded-xl glass-input placeholder-gray-500"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-300">
              {isRegisterMode ? 'E-posta Adresi' : 'E-posta veya Kullanıcı Adı'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type={isRegisterMode ? 'email' : 'text'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegisterMode ? 'ornek@pulsechat.com' : 'E-posta veya kullanıcı adı'}
                className="w-full py-2.5 pl-10 pr-4 text-sm rounded-xl glass-input placeholder-gray-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-300">
              Şifre
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-2.5 pl-10 pr-4 text-sm rounded-xl glass-input placeholder-gray-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.99] rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isRegisterMode ? 'Hesabı Oluştur' : 'Giriş Yap'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
