import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  Flag,
  Phone,
  Mail,
  Tag,
  Clock,
  Check,
  CheckCheck,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Settings,
  AlertCircle,
  Copy,
  ExternalLink,
  ChevronRight,
  Smile,
  Image as ImageIcon,
  Zap,
  MoreVertical,
  Sliders,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Hash,
  ShieldCheck
} from 'lucide-react';
import {
  getChatStats,
  getChatChannels,
  getChatConversations,
  getChatConversationDetail,
  updateChatConversation,
  markChatConversationRead,
  sendChatMessage,
  getChatAISuggestions,
  updateChatContact,
  getChatQuickReplies,
  createChatQuickReply,
  simulateIncomingChatMessage,
  getChatSettings,
  updateChatSettings,
  getFBPersonalStatus,
  syncFBPersonalMessages,
  importFBPersonalCookies
} from '../api';

export default function ChatView() {
  // State
  const [stats, setStats] = useState(null);
  const [channels, setChannels] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [settings, setSettings] = useState(null);

  // Filters & UI
  const [selectedChannelType, setSelectedChannelType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);

  // Composer
  const [inputText, setInputText] = useState('');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);

  // Modals
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false);
  const [showFBCookieModal, setShowFBCookieModal] = useState(false);
  const [fbCookieInput, setFbCookieInput] = useState('');
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Facebook Personal Sync
  const [fbPersonalStatus, setFbPersonalStatus] = useState(null);
  const [syncingFB, setSyncingFB] = useState(false);
  const [fbSyncNotification, setFbSyncNotification] = useState(null);

  // CRM Contact editing
  const [newTagInput, setNewTagInput] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Simulation Form
  const [simForm, setSimForm] = useState({
    channel_type: 'FB_PAGE',
    sender_name: 'Nguyễn Văn Hùng',
    sender_phone: '0981234567',
    message_text: 'Em muốn hỏi về gói bọc răng sứ thẩm mỹ bảo hành bao lâu vậy shop?'
  });

  const messagesEndRef = useRef(null);

  // Scroll to bottom of message list
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial data
  useEffect(() => {
    fetchInitialData();
    fetchFBStatus();
    const interval = setInterval(() => {
      fetchConversations(false);
      if (selectedConvId) {
        fetchConversationDetail(selectedConvId, false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedChannelType, statusFilter, searchQuery]);

  const fetchFBStatus = async () => {
    try {
      const res = await getFBPersonalStatus();
      setFbPersonalStatus(res.data);
    } catch (err) {
      console.error('Lỗi lấy trạng thái FB cá nhân:', err);
    }
  };

  const handleSyncFBPersonal = async () => {
    setSyncingFB(true);
    setFbSyncNotification({ type: 'info', text: 'Đang kết nối trình duyệt & quét tin nhắn Facebook cá nhân...' });
    try {
      const res = await syncFBPersonalMessages();
      if (res.data.success) {
        setFbSyncNotification({ type: 'success', text: res.data.message });
        await fetchConversations(false);
        await fetchFBStatus();
      } else {
        setFbSyncNotification({ type: 'warning', text: res.data.message });
      }
    } catch (err) {
      setFbSyncNotification({
        type: 'error',
        text: 'Lỗi đồng bộ FB cá nhân: ' + (err.response?.data?.detail || err.message)
      });
    } finally {
      setSyncingFB(false);
      setTimeout(() => setFbSyncNotification(null), 6000);
    }
  };

  const handleImportFBCookiesSubmit = async (e) => {
    e.preventDefault();
    if (!fbCookieInput.trim()) return;
    setSyncingFB(true);
    try {
      const res = await importFBPersonalCookies(fbCookieInput.trim());
      setShowFBCookieModal(false);
      setFbCookieInput('');
      setFbSyncNotification({ type: 'success', text: res.data.message });
      await fetchConversations(false);
      await fetchFBStatus();
    } catch (err) {
      alert('Lỗi nhập cookie: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSyncingFB(false);
      setTimeout(() => setFbSyncNotification(null), 6000);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [statsRes, chRes, qrRes, setRes] = await Promise.all([
        getChatStats(),
        getChatChannels(),
        getChatQuickReplies(),
        getChatSettings()
      ]);
      setStats(statsRes.data);
      setChannels(chRes.data);
      setQuickReplies(qrRes.data);
      setSettings(setRes.data);
      await fetchConversations(true);
    } catch (err) {
      console.error('Lỗi tải dữ liệu chat:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async (autoSelect = false) => {
    try {
      const params = {};
      if (selectedChannelType !== 'ALL') params.channel_type = selectedChannelType;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await getChatConversations(params);
      setConversations(res.data);

      if (autoSelect && res.data.length > 0 && !selectedConvId) {
        selectConversation(res.data[0].id);
      }
    } catch (err) {
      console.error('Lỗi tải hội thoại:', err);
    }
  };

  const selectConversation = async (convId) => {
    setSelectedConvId(convId);
    setAiSuggestions([]);
    await fetchConversationDetail(convId, true);
  };

  const fetchConversationDetail = async (convId, markRead = true) => {
    try {
      const res = await getChatConversationDetail(convId);
      setActiveConversation(res.data);
      setMessages(res.data.messages || []);
      setContactNotes(res.data.contact?.notes || '');

      if (markRead && res.data.unread_count > 0) {
        await markChatConversationRead(convId);
        setConversations(prev =>
          prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c)
        );
      }
    } catch (err) {
      console.error('Lỗi chi tiết cuộc trò chuyện:', err);
    }
  };

  // Send message
  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputText).trim();
    if (!text && !mediaUrlInput.trim()) return;
    if (!selectedConvId) return;

    setSending(true);
    try {
      const payload = {
        content: text,
        message_type: mediaUrlInput.trim() ? 'IMAGE' : 'TEXT',
        media_url: mediaUrlInput.trim() || null,
        sender_name: 'Chuyên viên tư vấn'
      };

      const res = await sendChatMessage(selectedConvId, payload);
      setMessages(prev => [...prev, res.data]);
      setInputText('');
      setMediaUrlInput('');
      setShowMediaInput(false);
      setAiSuggestions([]);

      // Update in conversation list
      setConversations(prev =>
        prev.map(c =>
          c.id === selectedConvId
            ? { ...c, last_message_text: text, last_message_sender: 'AGENT', unread_count: 0 }
            : c
        )
      );
    } catch (err) {
      alert('Không thể gửi tin nhắn: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSending(false);
    }
  };

  // Trigger AI Copilot suggestions
  const handleGetAiSuggestions = async () => {
    if (!selectedConvId) return;
    setAiLoading(true);
    try {
      const res = await getChatAISuggestions(selectedConvId);
      setAiSuggestions(res.data.suggestions || []);
    } catch (err) {
      console.error('Lỗi AI Copilot:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Simulate Incoming Message
  const handleSimulateSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await simulateIncomingChatMessage(simForm);
      setShowSimulateModal(false);
      await fetchConversations(false);
      selectConversation(res.data.conversation_id);
    } catch (err) {
      alert('Lỗi tạo tin nhắn giả lập: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Save CRM notes
  const handleSaveNotes = async () => {
    if (!activeConversation?.contact?.id) return;
    setSavingNotes(true);
    try {
      await updateChatContact(activeConversation.contact.id, { notes: contactNotes });
      setActiveConversation(prev => ({
        ...prev,
        contact: { ...prev.contact, notes: contactNotes }
      }));
    } catch (err) {
      alert('Lỗi lưu ghi chú: ' + err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  // Add CRM Tag
  const handleAddTag = async () => {
    if (!newTagInput.trim() || !activeConversation?.contact) return;
    let tagsList = [];
    try {
      tagsList = JSON.parse(activeConversation.contact.tags || '[]');
    } catch {
      tagsList = [];
    }
    if (!tagsList.includes(newTagInput.trim())) {
      const updated = [...tagsList, newTagInput.trim()];
      await updateChatContact(activeConversation.contact.id, { tags: JSON.stringify(updated) });
      setActiveConversation(prev => ({
        ...prev,
        contact: { ...prev.contact, tags: JSON.stringify(updated) }
      }));
      setNewTagInput('');
    }
  };

  // Remove CRM Tag
  const handleRemoveTag = async (tagToRemove) => {
    if (!activeConversation?.contact) return;
    let tagsList = [];
    try {
      tagsList = JSON.parse(activeConversation.contact.tags || '[]');
    } catch {
      tagsList = [];
    }
    const updated = tagsList.filter(t => t !== tagToRemove);
    await updateChatContact(activeConversation.contact.id, { tags: JSON.stringify(updated) });
    setActiveConversation(prev => ({
      ...prev,
      contact: { ...prev.contact, tags: JSON.stringify(updated) }
    }));
  };

  // Channel helper badges
  const renderChannelBadge = (type) => {
    switch (type) {
      case 'FB_PAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
            <Flag className="w-3 h-3 text-blue-600" /> FB Fanpage
          </span>
        );
      case 'FB_PERSONAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
            <User className="w-3 h-3 text-indigo-600" /> FB Cá nhân
          </span>
        );
      case 'ZALO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700 border border-sky-200">
            <MessageCircle className="w-3 h-3 text-sky-600" /> Zalo
          </span>
        );
      case 'WHATSAPP':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <MessageSquare className="w-3 h-3 text-emerald-600" /> WhatsApp
          </span>
        );
      default:
        return null;
    }
  };

  const getPlatformIcon = (type) => {
    switch (type) {
      case 'FB_PAGE':
        return <Flag className="w-3.5 h-3.5 text-blue-600" />;
      case 'FB_PERSONAL':
        return <User className="w-3.5 h-3.5 text-indigo-600" />;
      case 'ZALO':
        return <MessageCircle className="w-3.5 h-3.5 text-sky-600" />;
      case 'WHATSAPP':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 text-slate-800">
      {/* Top Bar / Stats Banner */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-md">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Hộp Thư Đa Kênh (Omnichannel Hub)
              <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-300">
                Live Sync
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Quản lý và nhắn tin hợp nhất từ Facebook Fanpage, FB Cá nhân, Zalo & WhatsApp
            </p>
          </div>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-500">Tin nhắn hôm nay:</span>
            <span className="font-bold text-slate-800">{stats?.messages_today || 0}</span>
          </div>

          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg text-xs text-rose-700">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span>Chưa đọc:</span>
            <span className="font-bold">{stats?.unread_messages || 0}</span>
          </div>

          <button
            onClick={handleSyncFBPersonal}
            disabled={syncingFB}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition shadow-sm"
            title="Quét và đồng bộ tin nhắn Facebook cá nhân từ trình duyệt"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${syncingFB ? 'animate-spin' : ''}`} />
            {syncingFB ? 'Đang đồng bộ...' : 'Đồng bộ FB Cá nhân'}
          </button>

          <button
            onClick={() => setShowSimulateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-indigo-600" /> Giả lập tin nhắn
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-600" /> Kết nối & Cài đặt
          </button>
        </div>
      </div>

      {/* Sync Notification Banner */}
      {fbSyncNotification && (
        <div className={`px-6 py-2 text-xs flex items-center justify-between border-b transition-all ${
          fbSyncNotification.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : fbSyncNotification.type === 'error'
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : fbSyncNotification.type === 'warning'
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${syncingFB ? 'animate-spin text-blue-600' : 'text-current'}`} />
            <span className="font-medium">{fbSyncNotification.text}</span>
          </div>
          <div className="flex items-center gap-2">
            {!fbPersonalStatus?.is_logged_in && (
              <button
                onClick={() => setShowFBCookieModal(true)}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800 shadow-2xs"
              >
                Nhập Cookie FB
              </button>
            )}
            <button
              onClick={() => setFbSyncNotification(null)}
              className="text-slate-400 hover:text-slate-600 font-bold px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Channels & Conversations List */}
        <div className="w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col h-full shadow-sm">
          {/* Channel Tabs */}
          <div className="p-3 border-b border-slate-100">
            <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
              <button
                onClick={() => setSelectedChannelType('ALL')}
                className={`py-1.5 px-1 rounded-lg text-center transition ${selectedChannelType === 'ALL' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'hover:text-slate-900'}`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setSelectedChannelType('FB_PAGE')}
                className={`py-1.5 px-1 rounded-lg text-center flex items-center justify-center gap-1 transition ${selectedChannelType === 'FB_PAGE' ? 'bg-white text-blue-700 font-bold shadow-sm' : 'hover:text-slate-900'}`}
                title="Facebook Fanpage"
              >
                <Flag className="w-3 h-3 text-blue-600" /> Page
              </button>
              <button
                onClick={() => setSelectedChannelType('FB_PERSONAL')}
                className={`py-1.5 px-1 rounded-lg text-center flex items-center justify-center gap-1 transition ${selectedChannelType === 'FB_PERSONAL' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'hover:text-slate-900'}`}
                title="Facebook Cá nhân"
              >
                <User className="w-3 h-3 text-indigo-600" /> FB Cá nhân
              </button>
              <button
                onClick={() => setSelectedChannelType('ZALO')}
                className={`py-1.5 px-1 rounded-lg text-center flex items-center justify-center gap-1 transition ${selectedChannelType === 'ZALO' ? 'bg-white text-sky-700 font-bold shadow-sm' : 'hover:text-slate-900'}`}
                title="Zalo"
              >
                <MessageCircle className="w-3 h-3 text-sky-600" /> Zalo
              </button>
              <button
                onClick={() => setSelectedChannelType('WHATSAPP')}
                className={`py-1.5 px-1 rounded-lg text-center flex items-center justify-center gap-1 transition ${selectedChannelType === 'WHATSAPP' ? 'bg-white text-emerald-700 font-bold shadow-sm' : 'hover:text-slate-900'}`}
                title="WhatsApp"
              >
                <MessageSquare className="w-3 h-3 text-emerald-600" /> WA
              </button>
            </div>

            {/* Search Input */}
            <div className="mt-3 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tìm khách hàng, số điện thoại..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* FB Personal Sync Status Card (Visible when FB_PERSONAL tab selected) */}
            {selectedChannelType === 'FB_PERSONAL' && (
              <div className="mt-3 p-3 bg-indigo-50/90 border border-indigo-200 rounded-xl text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" /> Facebook Cá Nhân
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    fbPersonalStatus?.is_logged_in
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {fbPersonalStatus?.is_logged_in ? 'Đang kết nối' : 'Chưa đăng nhập'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mb-2.5 leading-relaxed">
                  {fbPersonalStatus?.is_logged_in
                    ? `Đang đồng bộ qua trình duyệt (UID: ${fbPersonalStatus.facebook_uid || 'Profile chính'}).`
                    : 'Đăng nhập trên trình duyệt hoặc dán Cookie Facebook cá nhân để đồng bộ tin nhắn.'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncFBPersonal}
                    disabled={syncingFB}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingFB ? 'animate-spin' : ''}`} />
                    {syncingFB ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                  </button>
                  <button
                    onClick={() => setShowFBCookieModal(true)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-indigo-200 text-indigo-900 rounded-lg font-semibold text-xs shadow-2xs transition"
                  >
                    Nhập Cookie
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Không có cuộc hội thoại nào phù hợp</p>
                <button
                  onClick={() => setShowSimulateModal(true)}
                  className="mt-3 text-xs text-blue-600 hover:underline font-semibold"
                >
                  + Tạo tin nhắn giả lập để thử nghiệm
                </button>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === selectedConvId;
                return (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`p-3.5 cursor-pointer transition flex items-start gap-3 relative ${
                      isSelected
                        ? 'bg-blue-50/70 border-l-4 border-blue-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Avatar with Channel Icon Badge */}
                    <div className="relative shrink-0">
                      <img
                        src={conv.contact_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                        alt={conv.contact_name}
                        className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-sm"
                      />
                      <div className="absolute -bottom-1 -right-1 p-0.5 bg-white rounded-full shadow-sm">
                        {getPlatformIcon(conv.channel_type)}
                      </div>
                    </div>

                    {/* Content Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-xs truncate ${isSelected ? 'font-bold text-blue-950' : 'font-semibold text-slate-800'}`}>
                          {conv.contact_name || 'Khách hàng'}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {conv.last_message_at
                            ? new Date(conv.last_message_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                      </div>

                      <p className={`text-xs truncate ${conv.unread_count > 0 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                        {conv.last_message_sender === 'AGENT' && (
                          <span className="text-slate-400 font-normal">Bạn: </span>
                        )}
                        {conv.last_message_text || 'Chưa có tin nhắn'}
                      </p>

                      <div className="mt-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {renderChannelBadge(conv.channel_type)}
                        </div>

                        {conv.unread_count > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white shadow-sm">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Active Chat Window */}
        <div className="flex-1 bg-slate-50/50 flex flex-col h-full border-r border-slate-200">
          {activeConversation ? (
            <>
              {/* Chat Top Header */}
              <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={activeConversation.contact_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute bottom-0 right-0"></span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-slate-900 text-sm">
                        {activeConversation.contact_name}
                      </h2>
                      {renderChannelBadge(activeConversation.channel_type)}
                    </div>
                    <p className="text-xs text-slate-400">
                      {activeConversation.contact_phone || 'Chưa có SĐT'} • Kênh: {activeConversation.channel_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGetAiSuggestions}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 border border-indigo-200/80 rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${aiLoading ? 'animate-spin' : ''}`} />
                    {aiLoading ? 'AI đang phân tích...' : 'Gợi ý AI Copilot'}
                  </button>
                </div>
              </div>

              {/* Message Stream */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="text-xs">Bắt đầu cuộc trò chuyện với khách hàng ngay bây giờ</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOutbound = !msg.is_inbound;
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2.5 ${isOutbound ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isOutbound && (
                          <img
                            src={msg.sender_avatar || activeConversation.contact_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 mb-1"
                          />
                        )}

                        <div className={`max-w-[70%] sm:max-w-md ${isOutbound ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                              isOutbound
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none'
                                : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-none'
                            }`}
                          >
                            {msg.media_url && (
                              <div className="mb-2 rounded-lg overflow-hidden border border-black/10">
                                <img src={msg.media_url} alt="Media" className="max-h-48 w-full object-cover" />
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>

                          {/* Message Metadata */}
                          <div className={`flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 px-1`}>
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isOutbound && (
                              <span title={`Trạng thái: ${msg.delivery_status}`}>
                                {msg.delivery_status === 'DELIVERED' || msg.delivery_status === 'SENT' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                                ) : (
                                  <Check className="w-3 h-3 text-slate-400" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {isOutbound && (
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0 mb-1 border border-blue-200">
                            CS
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* AI Copilot Suggestions Tray */}
              {aiSuggestions.length > 0 && (
                <div className="px-6 py-2 bg-indigo-50/60 border-t border-indigo-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-600" /> Gợi ý trả lời thông minh (Gemini AI):
                    </span>
                    <button
                      onClick={() => setAiSuggestions([])}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {aiSuggestions.map((sugg, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSendMessage(sugg)}
                        className="bg-white p-2.5 rounded-xl border border-indigo-200 hover:border-indigo-400 text-xs text-slate-700 cursor-pointer shadow-xs hover:shadow-sm transition group"
                      >
                        <p className="line-clamp-2">{sugg}</p>
                        <span className="text-[10px] text-indigo-600 font-semibold mt-1 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          Gửi ngay <ChevronRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Canned Replies bar */}
              <div className="px-6 py-2 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
                <span className="text-slate-400 text-[11px] font-medium shrink-0 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-500" /> Mẫu nhanh:
                </span>
                {quickReplies.map((qr) => (
                  <button
                    key={qr.id}
                    onClick={() => handleSendMessage(qr.content)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs shrink-0 transition"
                    title={qr.content}
                  >
                    {qr.shortcut} ({qr.title})
                  </button>
                ))}
              </div>

              {/* Composer Input Area */}
              <div className="bg-white border-t border-slate-200 p-4">
                {showMediaInput && (
                  <div className="mb-2 flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <ImageIcon className="w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Dán URL hình ảnh đính kèm (https://...)"
                      value={mediaUrlInput}
                      onChange={(e) => setMediaUrlInput(e.target.value)}
                      className="flex-1 bg-transparent text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => setShowMediaInput(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Hủy
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMediaInput(!showMediaInput)}
                    className={`p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition ${showMediaInput ? 'text-blue-600 bg-blue-50' : ''}`}
                    title="Đính kèm hình ảnh"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>

                  <textarea
                    rows={2}
                    placeholder={`Nhập tin nhắn gửi tới ${activeConversation.contact_name} (Enter để gửi, Shift+Enter xuống dòng)...`}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={sending || (!inputText.trim() && !mediaUrlInput.trim())}
                    className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center shrink-0"
                  >
                    <Send className={`w-4 h-4 ${sending ? 'animate-pulse' : ''}`} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 mb-4 shadow-inner">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-slate-700">Chọn cuộc trò chuyện để bắt đầu</h3>
              <p className="text-xs text-slate-400 max-w-sm text-center mt-1">
                Tin nhắn từ Facebook Fanpage, FB Cá nhân, Zalo và WhatsApp được đồng bộ tập trung theo thời gian thực tại đây.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Contact CRM Details */}
        {activeConversation && activeConversation.contact && (
          <div className="w-72 lg:w-80 bg-white border-l border-slate-200 flex flex-col h-full overflow-y-auto p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Hồ Sơ Khách Hàng (CRM)
            </h3>

            {/* Profile Avatar & Name */}
            <div className="text-center pb-5 border-b border-slate-100">
              <img
                src={activeConversation.contact_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                alt=""
                className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-slate-200 shadow-sm mb-2"
              />
              <h4 className="font-bold text-slate-900 text-sm">
                {activeConversation.contact.name}
              </h4>
              <p className="text-xs text-slate-400">
                ID: {activeConversation.contact.external_user_id}
              </p>
              <div className="mt-2 flex justify-center">
                {renderChannelBadge(activeConversation.channel_type)}
              </div>
            </div>

            {/* Contact Details */}
            <div className="py-4 border-b border-slate-100 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium">{activeConversation.contact.phone || 'Chưa có SĐT'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium truncate">{activeConversation.contact.email || 'Chưa có Email'}</span>
              </div>
            </div>

            {/* Tags Manager */}
            <div className="py-4 border-b border-slate-100">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5 text-slate-400" /> Phân loại & Tags
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(() => {
                  try {
                    const tags = JSON.parse(activeConversation.contact.tags || '[]');
                    return tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        {t}
                        <button
                          onClick={() => handleRemoveTag(t)}
                          className="hover:text-rose-600"
                        >
                          ×
                        </button>
                      </span>
                    ));
                  } catch {
                    return null;
                  }
                })()}
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="+ Thêm tag mới..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAddTag}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
                >
                  Thêm
                </button>
              </div>
            </div>

            {/* Internal Staff Notes */}
            <div className="py-4 flex-1 flex flex-col">
              <label className="text-xs font-bold text-slate-700 mb-1.5">
                Ghi chú nội bộ CSKH
              </label>
              <textarea
                rows={4}
                placeholder="Ghi chú nhu cầu, lịch sử tư vấn, lưu ý đặc biệt cho khách..."
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none flex-1 mb-2"
              />
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
              >
                {savingNotes ? 'Đang lưu...' : 'Lưu ghi chú'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Simulation Incoming Message */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-600" /> Giả Lập Nhận Tin Nhắn
              </h3>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kênh nhận tin nhắn</label>
                <select
                  value={simForm.channel_type}
                  onChange={(e) => setSimForm({ ...simForm, channel_type: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="FB_PAGE">Facebook Fanpage (Messenger)</option>
                  <option value="FB_PERSONAL">Facebook Cá nhân</option>
                  <option value="ZALO">Zalo OA / Chat</option>
                  <option value="WHATSAPP">WhatsApp Cloud</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên khách hàng</label>
                <input
                  type="text"
                  value={simForm.sender_name}
                  onChange={(e) => setSimForm({ ...simForm, sender_name: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số điện thoại khách (tùy chọn)</label>
                <input
                  type="text"
                  value={simForm.sender_phone}
                  onChange={(e) => setSimForm({ ...simForm, sender_phone: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nội dung tin nhắn gửi đến</label>
                <textarea
                  rows={3}
                  value={simForm.message_text}
                  onChange={(e) => setSimForm({ ...simForm, message_text: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold shadow-md"
                >
                  Nhận tin nhắn vào hệ thống
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Settings & Channels Connection */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" /> Cấu Hình Kênh Kết Nối & Webhooks
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 text-xs">
              {/* Webhook Endpoint Info */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Webhook URL Nhận Tin Nhắn Trực Tiếp
                </h4>
                <p className="text-slate-500 mb-3">
                  Cấu hình URL này vào Meta App (Facebook Messenger & WhatsApp Cloud API) hoặc Zalo Developer để nhận tin nhắn real-time:
                </p>
                <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700">
                  <span className="flex-1 truncate">
                    {window.location.origin}/api/chat/webhooks/fb_page
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/chat/webhooks/fb_page`);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-sans font-semibold shrink-0"
                  >
                    {copiedWebhook ? 'Đã copy!' : 'Copy URL'}
                  </button>
                </div>
              </div>

              {/* Connected Channels List */}
              <div>
                <h4 className="font-bold text-slate-800 mb-3">Danh sách kênh đang kết nối ({channels.length})</h4>
                <div className="space-y-2">
                  {channels.map((ch) => (
                    <div
                      key={ch.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          {getPlatformIcon(ch.channel_type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{ch.name}</span>
                            {renderChannelBadge(ch.channel_type)}
                          </div>
                          <span className="text-slate-400 text-[11px]">
                            Định danh: {ch.account_identifier || 'Chưa đặt'} {ch.phone_number ? `• SĐT: ${ch.phone_number}` : ''}
                          </span>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã kết nối
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* General Settings */}
              {settings && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-800">Cài đặt hỗ trợ & Tự động hóa</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800">Gợi ý AI Copilot (Gemini)</span>
                      <p className="text-slate-500 text-[11px]">Tự động gợi ý 3 câu trả lời ngữ cảnh khi đọc tin nhắn khách</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.ai_auto_suggest}
                      onChange={(e) => {
                        const updated = { ...settings, ai_auto_suggest: e.target.checked };
                        setSettings(updated);
                        updateChatSettings({ ai_auto_suggest: e.target.checked });
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div>
                      <span className="font-semibold text-slate-800">Thông báo âm thanh tin nhắn</span>
                      <p className="text-slate-500 text-[11px]">Phát âm thanh khi có tin nhắn mới gửi đến</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.sound_notifications}
                      onChange={(e) => {
                        const updated = { ...settings, sound_notifications: e.target.checked };
                        setSettings(updated);
                        updateChatSettings({ sound_notifications: e.target.checked });
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Nhập Cookie Facebook Cá Nhân */}
      {showFBCookieModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" /> Nhập Cookie Facebook Cá Nhân
              </h3>
              <button
                onClick={() => setShowFBCookieModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportFBCookiesSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-slate-700 leading-relaxed">
                <p className="font-semibold text-indigo-950 mb-1">💡 Hướng dẫn lấy Cookie an toàn:</p>
                <p>1. Cài tiện ích <b>Cookie-Editor</b> trên trình duyệt Chrome.</p>
                <p>2. Đăng nhập vào <a href="https://facebook.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">facebook.com</a> cá nhân.</p>
                <p>3. Bấm icon Cookie-Editor ➔ chọn <b>Export</b> ➔ <b>Export as JSON</b> (hoặc Header String).</p>
                <p>4. Dán toàn bộ nội dung vào khung bên dưới và bấm <b>Lưu & Đồng bộ ngay</b>.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Chuỗi Cookie JSON hoặc chuỗi c_user=...; xs=...
                </label>
                <textarea
                  rows={5}
                  value={fbCookieInput}
                  onChange={(e) => setFbCookieInput(e.target.value)}
                  placeholder='Dán JSON cookie: [{"name":"c_user","value":"1000..."}, ...] hoặc c_user=...; xs=...'
                  className="w-full p-3 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 resize-none"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFBCookieModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={syncingFB || !fbCookieInput.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-md disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingFB ? 'animate-spin' : ''}`} />
                  {syncingFB ? 'Đang lưu & Quét...' : 'Lưu & Đồng bộ ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
