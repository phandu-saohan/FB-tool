import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, Bot, Shield, Laptop, AlertCircle } from 'lucide-react';
import { getSettings, updateSettings } from '../api';

export default function SettingsView() {
  const [config, setConfig] = useState({
    AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: '',
    OPENAI_API_KEY: '',
    OPENROUTER_API_KEY: '',
    POST_DELAY_MIN: 60,
    POST_DELAY_MAX: 180,
    MAX_POSTS_PER_RUN: 10,
    BROWSER_HEADLESS: false,
    CHROME_EXECUTABLE_PATH: '',
    FACEBOOK_PROFILE_PATH: './profiles/facebook'
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await getSettings();
      setConfig(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateSettings({
        AI_PROVIDER: config.AI_PROVIDER,
        GEMINI_API_KEY: config.GEMINI_API_KEY.includes('***') ? undefined : config.GEMINI_API_KEY,
        OPENAI_API_KEY: config.OPENAI_API_KEY.includes('***') ? undefined : config.OPENAI_API_KEY,
        OPENROUTER_API_KEY: config.OPENROUTER_API_KEY.includes('***') ? undefined : config.OPENROUTER_API_KEY,
        POST_DELAY_MIN: Number(config.POST_DELAY_MIN),
        POST_DELAY_MAX: Number(config.POST_DELAY_MAX),
        MAX_POSTS_PER_RUN: Number(config.MAX_POSTS_PER_RUN),
        BROWSER_HEADLESS: Boolean(config.BROWSER_HEADLESS),
        CHROME_EXECUTABLE_PATH: config.CHROME_EXECUTABLE_PATH || null
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
      await loadSettings();
    } catch (err) {
      alert('Lỗi lưu cài đặt: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Cấu hình Hệ thống & AI</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý API Keys, tốc độ đăng an toàn và tùy chọn trình duyệt.</p>
        </div>

        {saveSuccess && (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold shadow-2xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Đã lưu thành công!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* AI Configuration Box */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
            <Bot className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">Cấu hình AI Content Generator</h3>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">AI Provider mặc định</label>
              <select
                value={config.AI_PROVIDER}
                onChange={(e) => setConfig({ ...config, AI_PROVIDER: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="gemini">Google Gemini API (Khuyên dùng)</option>
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="openrouter">OpenRouter (Claude, DeepSeek, Llama...)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Gemini API Key</label>
              <input
                type="password"
                value={config.GEMINI_API_KEY}
                onChange={(e) => setConfig({ ...config, GEMINI_API_KEY: e.target.value })}
                placeholder="Nhập GEMINI_API_KEY..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">OpenAI API Key</label>
              <input
                type="password"
                value={config.OPENAI_API_KEY}
                onChange={(e) => setConfig({ ...config, OPENAI_API_KEY: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">OpenRouter API Key</label>
              <input
                type="password"
                value={config.OPENROUTER_API_KEY}
                onChange={(e) => setConfig({ ...config, OPENROUTER_API_KEY: e.target.value })}
                placeholder="sk-or-..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>
        </div>

        {/* Safety & Rate Limits */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-900">An toàn Tài khoản & Giới hạn Tốc độ (Rate Limits)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Delay tối thiểu (Giây)</label>
              <input
                type="number"
                min="10"
                max="600"
                value={config.POST_DELAY_MIN}
                onChange={(e) => setConfig({ ...config, POST_DELAY_MIN: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Delay tối đa (Giây)</label>
              <input
                type="number"
                min="20"
                max="1200"
                value={config.POST_DELAY_MAX}
                onChange={(e) => setConfig({ ...config, POST_DELAY_MAX: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Tối đa bài / phiên chạy</label>
              <input
                type="number"
                min="1"
                max="50"
                value={config.MAX_POSTS_PER_RUN}
                onChange={(e) => setConfig({ ...config, MAX_POSTS_PER_RUN: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>
        </div>

        {/* Browser Settings */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
            <Laptop className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900">Cấu hình Trình duyệt & Persistent Profile</h3>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Đường dẫn Persistent Profile</label>
              <input
                type="text"
                disabled
                value={config.FACEBOOK_PROFILE_PATH}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-500 text-sm font-mono cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-500 mt-1">Lưu trữ session cookies và đăng nhập vĩnh viễn.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Đường dẫn Chrome Executable (Tùy chọn)</label>
              <input
                type="text"
                value={config.CHROME_EXECUTABLE_PATH || ''}
                onChange={(e) => setConfig({ ...config, CHROME_EXECUTABLE_PATH: e.target.value })}
                placeholder="VD: C:\Program Files\Google\Chrome\Application\chrome.exe"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <input
                type="checkbox"
                id="headlessToggle"
                checked={config.BROWSER_HEADLESS}
                onChange={(e) => setConfig({ ...config, BROWSER_HEADLESS: e.target.checked })}
                className="rounded bg-slate-50 border-slate-300 text-blue-600 cursor-pointer focus:ring-0"
              />
              <label htmlFor="headlessToggle" className="text-sm font-medium text-slate-700 cursor-pointer">
                Chế độ chạy ngầm ẩn cửa sổ (Headless Mode)
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow transition"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Đang lưu...' : 'Lưu tất cả cài đặt'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
