import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Search,
  Plus,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Sliders,
  Calendar,
  Layers,
  Users,
  Trash2,
  ExternalLink,
  PauseCircle,
  StopCircle,
  FileText,
  Upload,
  Check,
  Tag,
  Bot,
  ShieldCheck,
  Link2,
  Copy,
  Key
} from 'lucide-react';
import {
  getZaloDashboard,
  getZaloGroups,
  createZaloGroup,
  batchImportZaloGroups,
  searchZaloGroups,
  deleteZaloGroup,
  getZaloPosts,
  getZaloPost,
  createZaloPost,
  publishZaloPostNow,
  scheduleZaloPost,
  pauseZaloCampaign,
  cancelZaloCampaign,
  generateZaloAIPost,
  getZaloSettings,
  updateZaloSettings,
  testZaloBotToken,
  setZaloBotWebhook
} from '../api';
import Pagination, { usePagination } from '../components/Pagination';

export default function ZaloView() {
  const [activeTab, setActiveTab] = useState('compose'); // compose, groups, queue, history, settings
  const [loading, setLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');

  // Dashboard Stats
  const [stats, setStats] = useState({
    total_groups: 0,
    active_groups: 0,
    total_posts: 0,
    scheduled_posts: 0,
    completed_posts: 0,
    total_sent_items: 0,
    success_rate: 100.0,
    daily_sent_today: 0,
    daily_limit: 50
  });

  // Groups State
  const [groups, setGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState('all');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);

  // Modals for Groups
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', group_link: '', category: 'Thẩm mỹ', members_count: 0 });
  
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);
  const [batchImportText, setBatchImportText] = useState('');
  const [batchCategory, setBatchCategory] = useState('Thẩm mỹ');

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('thẩm mỹ');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Post Composer State
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [ctaUrl, setCtaUrl] = useState('https://kbit2026.vercel.app');
  const [delaySeconds, setDelaySeconds] = useState(20);
  const [postAction, setPostAction] = useState('publish_now'); // publish_now, schedule, draft
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  // AI Assistant State
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiAudience, setAiAudience] = useState('Bác sĩ da liễu, chủ cơ sở Spa & Clinic');
  const [aiTone, setAiTone] = useState('Friendly & Professional');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Queue & Posts State
  const [posts, setPosts] = useState([]);
  const [activePostDetail, setActivePostDetail] = useState(null);

  // Settings State
  const [settings, setSettings] = useState(null);
  const [testingBot, setTestingBot] = useState(false);
  const [botTestResult, setBotTestResult] = useState(null);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState(null);
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [copiedField, setCopiedField] = useState('');

  // Pagination
  const paginatedGroups = usePagination(groups, 8);
  const paginatedPosts = usePagination(posts, 6);

  // Load Dashboard & Data
  const loadDashboard = async () => {
    try {
      const res = await getZaloDashboard();
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadGroups = async () => {
    try {
      const params = {};
      if (groupFilter !== 'all') params.category = groupFilter;
      if (groupSearchQuery.trim()) params.search = groupSearchQuery.trim();
      const res = await getZaloGroups(params);
      setGroups(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadPosts = async () => {
    try {
      const res = await getZaloPosts();
      setPosts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await getZaloSettings();
      setSettings(res.data);
      const defaultHost = window.location.origin.includes('localhost')
        ? 'https://fb.medicalcenter.vn'
        : window.location.origin;
      setWebhookUrlInput(`${defaultHost}/api/zalo/bot/webhook`);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadDashboard();
    if (activeTab === 'groups' || activeTab === 'compose') loadGroups();
    if (activeTab === 'queue' || activeTab === 'history') loadPosts();
    if (activeTab === 'settings') loadSettings();
  }, [activeTab, groupFilter]);

  // Periodic refresh when queue is active
  useEffect(() => {
    const hasProcessing = posts.some(p => p.status === 'PROCESSING');
    if (hasProcessing || activeTab === 'queue') {
      const interval = setInterval(() => {
        loadPosts();
        loadDashboard();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [posts, activeTab]);

  // Handle Search Groups
  const handleSearchGroups = async () => {
    if (!searchKeyword.trim()) return;
    setIsSearching(true);
    try {
      const res = await searchZaloGroups({ keyword: searchKeyword.trim(), limit: 15 });
      setSearchResults(res.data);
    } catch (err) {
      alert('Lỗi tìm kiếm: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveSearchResult = async (item) => {
    try {
      await createZaloGroup({
        name: item.name,
        group_link: item.group_link,
        category: item.category,
        description: item.description,
        members_count: item.estimated_members
      });
      // Mark saved in results
      setSearchResults(searchResults.map(r => r.group_link === item.group_link ? { ...r, already_saved: true } : r));
      await loadGroups();
      await loadDashboard();
    } catch (err) {
      alert('Lỗi lưu nhóm: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Handle Add Single Group
  const handleCreateSingleGroup = async (e) => {
    e.preventDefault();
    if (!newGroup.name.trim() || !newGroup.group_link.trim()) return;
    try {
      await createZaloGroup(newGroup);
      setShowAddGroupModal(false);
      setNewGroup({ name: '', group_link: '', category: 'Thẩm mỹ', members_count: 0 });
      await loadGroups();
      await loadDashboard();
      alert('Đã thêm nhóm Zalo thành công!');
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Handle Batch Import
  const handleBatchImport = async (e) => {
    e.preventDefault();
    if (!batchImportText.trim()) return;
    try {
      const res = await batchImportZaloGroups({
        links_text: batchImportText,
        category: batchCategory
      });
      alert(`Đã nạp thành công ${res.data.added_count} nhóm Zalo (${res.data.skipped_count} nhóm trùng lặp đã bỏ qua).`);
      setShowBatchImportModal(false);
      setBatchImportText('');
      await loadGroups();
      await loadDashboard();
    } catch (err) {
      alert('Lỗi nạp nhóm: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Handle Delete Group
  const handleDeleteGroup = async (id, name) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa nhóm "${name}" khỏi danh sách?`)) return;
    try {
      await deleteZaloGroup(id);
      await loadGroups();
      await loadDashboard();
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Handle AI Content Generation
  const handleGenerateAI = async () => {
    if (!aiTopic.trim()) {
      alert('Vui lòng nhập chủ đề cần viết bài.');
      return;
    }
    setIsGeneratingAI(true);
    try {
      const res = await generateZaloAIPost({
        topic: aiTopic,
        cta_url: ctaUrl,
        tone: aiTone,
        target_audience: aiAudience
      });
      if (res.data) {
        setPostTitle(res.data.title || `Thông Báo: ${aiTopic}`);
        setPostContent(res.data.full_message || res.data.content);
        setShowAIAssistant(false);
      }
    } catch (err) {
      alert('Lỗi tạo bài bằng AI: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Handle Create Post & Submit
  const handleCreatePostSubmit = async (e) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) {
      alert('Vui lòng nhập đầy đủ tiêu đề và nội dung bài viết.');
      return;
    }

    const targetGroupIds = selectedGroupIds.length > 0 
      ? selectedGroupIds 
      : groups.filter(g => g.status === 'ACTIVE').map(g => g.id);

    if (targetGroupIds.length === 0) {
      alert('Không có nhóm Zalo nào được chọn để gửi bài. Vui lòng thêm hoặc chọn nhóm.');
      return;
    }

    if (postAction === 'schedule' && !scheduleDateTime) {
      alert('Vui lòng chọn ngày và giờ lên lịch đăng.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: postTitle.trim(),
        content: postContent.trim(),
        call_to_action_url: ctaUrl.trim() || null,
        group_ids: targetGroupIds,
        delay_seconds: parseInt(delaySeconds) || 20,
        action: postAction,
        scheduled_at: postAction === 'schedule' ? new Date(scheduleDateTime).toISOString() : null
      };

      const res = await createZaloPost(payload);
      if (postAction === 'publish_now') {
        alert(`Đã khởi động chiến dịch gửi bài ngay tới ${targetGroupIds.length} nhóm Zalo (giãn cách ${delaySeconds}s/nhóm).`);
      } else if (postAction === 'schedule') {
        alert(`Đã lên lịch gửi bài tới ${targetGroupIds.length} nhóm Zalo vào lúc ${new Date(scheduleDateTime).toLocaleString('vi-VN')}.`);
      } else {
        alert('Đã lưu bài viết vào bản nháp.');
      }

      // Reset form
      setPostTitle('');
      setPostContent('');
      setScheduleDateTime('');
      setSelectedGroupIds([]);
      await loadDashboard();
      setActiveTab('queue');
    } catch (err) {
      alert('Lỗi tạo bài đăng: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Post Actions
  const handlePublishNow = async (postId) => {
    if (!confirm('Bạn có muốn kích hoạt gửi bài đăng này ngay lập tức vào tất cả nhóm mục tiêu?')) return;
    try {
      const res = await publishZaloPostNow(postId);
      alert(res.data.message);
      await loadPosts();
      await loadDashboard();
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handlePausePost = async (postId) => {
    try {
      const res = await pauseZaloCampaign(postId);
      alert(res.data.message);
      await loadPosts();
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCancelPost = async (postId) => {
    if (!confirm('Bạn có chắc chắn muốn hủy chiến dịch gửi bài này?')) return;
    try {
      const res = await cancelZaloCampaign(postId);
      alert(res.data.message);
      await loadPosts();
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleViewDetail = async (postId) => {
    try {
      const res = await getZaloPost(postId);
      setActivePostDetail(res.data);
    } catch (err) {
      alert('Lỗi tải chi tiết: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Settings Save
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await updateZaloSettings(settings);
      alert('Đã lưu cài đặt Zalo thành công!');
      await loadDashboard();
    } catch (err) {
      alert('Lỗi lưu cài đặt: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Test Zalo Bot Token
  const handleTestBot = async () => {
    if (!settings?.bot_token?.trim()) {
      alert('Vui lòng nhập Zalo Bot Token trước khi kiểm tra.');
      return;
    }
    setTestingBot(true);
    setBotTestResult(null);
    try {
      const res = await testZaloBotToken(settings.bot_token.trim());
      setBotTestResult(res.data);
      if (res.data.success) {
        setSettings(prev => ({
          ...prev,
          bot_name: res.data.bot_name,
          bot_username: res.data.bot_username
        }));
      }
    } catch (err) {
      setBotTestResult({
        success: false,
        message: err.response?.data?.detail || err.message
      });
    } finally {
      setTestingBot(false);
    }
  };

  // Generate random secret token
  const generateRandomSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSettings(prev => ({ ...prev, bot_webhook_secret: result }));
  };

  // Copy helper
  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2500);
  };

  // Set Zalo Bot Webhook
  const handleSetWebhook = async () => {
    if (!settings?.bot_token?.trim()) {
      alert('Vui lòng nhập và lưu Zalo Bot Token trước.');
      return;
    }
    const finalUrl = webhookUrlInput.trim() || `${window.location.origin}/api/zalo/bot/webhook`;
    setSettingWebhook(true);
    setWebhookResult(null);
    try {
      const res = await setZaloBotWebhook(finalUrl, settings?.bot_webhook_secret?.trim() || null);
      setWebhookResult(res.data);
      if (res.data?.success) {
        alert('Kích hoạt Webhook thành công!');
      }
    } catch (err) {
      setWebhookResult({
        success: false,
        message: err.response?.data?.detail || err.message
      });
    } finally {
      setSettingWebhook(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-2xs">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <MessageCircle className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-slate-900">Zalo Marketing Suite — Đăng Bài & Nhóm Zalo</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border bg-blue-50 text-blue-700 border-blue-200">
                ● ZALO AUTOMATION & SCHEDULER
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tìm kiếm nhóm Zalo thẩm mỹ • Soạn bài viết bằng AI Gemini • Lên lịch đăng bài tự động có giãn cách an toàn chống checkpoint
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => { loadDashboard(); if (activeTab === 'groups') loadGroups(); if (activeTab === 'queue') loadPosts(); }}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition-colors border border-slate-200 shadow-2xs"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => { setActiveTab('compose'); }}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Soạn bài đăng Zalo</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Tổng nhóm Zalo</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total_groups}</div>
          <div className="text-[11px] text-blue-600 mt-1 font-semibold">{stats.active_groups} hoạt động</div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Tổng bài viết</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total_posts}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-semibold">Post Campaigns</div>
        </div>

        <div className="bg-blue-50/50 border border-blue-200 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-blue-700 font-medium">Lịch đăng chờ</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{stats.scheduled_posts}</div>
          <div className="text-[11px] text-blue-600 mt-1 font-semibold">Scheduled</div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Đã hoàn thành</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.completed_posts}</div>
          <div className="text-[11px] text-emerald-600 mt-1 font-semibold">Completed</div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Đã gửi hôm nay</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.daily_sent_today}/{stats.daily_limit}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-semibold">Hạn ngạch ngày</div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Tổng tin gửi</div>
          <div className="text-2xl font-bold text-purple-700 mt-1">{stats.total_sent_items}</div>
          <div className="text-[11px] text-purple-600 mt-1 font-semibold">Total Delivered</div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Tỷ lệ thành công</div>
          <div className="text-2xl font-bold text-teal-600 mt-1">{stats.success_rate}%</div>
          <div className="text-[11px] text-teal-600 mt-1 font-semibold">Success Rate</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto pb-1">
        {[
          { id: 'compose', label: 'Soạn bài & Lên lịch đăng', icon: Send },
          { id: 'groups', label: 'Quản lý & Tìm kiếm Nhóm', icon: Users, badge: stats.total_groups },
          { id: 'queue', label: 'Hàng đợi & Lịch hẹn', icon: Clock, badge: stats.scheduled_posts },
          { id: 'history', label: 'Lịch sử bài đăng', icon: FileText },
          { id: 'settings', label: 'Cài đặt an toàn', icon: Sliders }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-3 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-blue-600 text-blue-700 bg-white shadow-2xs font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: COMPOSE & SCHEDULE POST */}
      {/* ========================================================================= */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Post Editor */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 p-6 rounded-2xl space-y-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Nội dung bài đăng Zalo</h3>
                <p className="text-xs text-slate-500">Tối ưu định dạng cho tin nhắn nhóm Zalo di động</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAIAssistant(!showAIAssistant)}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-2xs"
              >
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>{showAIAssistant ? 'Ẩn trợ lý AI' : '✨ Soạn bằng AI Gemini'}</span>
              </button>
            </div>

            {/* AI Assistant Box */}
            {showAIAssistant && (
              <div className="bg-purple-50/60 border border-purple-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Trợ lý AI viết bài Zalo (Gemini 2.5)</span>
                  </span>
                  <span className="text-[11px] text-purple-700 font-medium">Tối ưu cho nhóm Zalo y khoa & thẩm mỹ</span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-700 font-semibold block mb-1">
                      Chủ đề bài đăng / Điểm nổi bật sự kiện *
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Kính mời tham dự Hội nghị Khoa học Thẩm mỹ 108 - Thị phạm trực tiếp từ phòng mổ..."
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-600 font-medium block mb-1">Đối tượng người đọc</label>
                      <input
                        type="text"
                        value={aiAudience}
                        onChange={(e) => setAiAudience(e.target.value)}
                        className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 font-medium block mb-1">Giọng văn</label>
                      <select
                        value={aiTone}
                        onChange={(e) => setAiTone(e.target.value)}
                        className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition"
                      >
                        <option value="Friendly & Professional">Trang trọng & Thân thiện</option>
                        <option value="Academic CME">Học thuật chuẩn CME</option>
                        <option value="Urgent VIP">Cấp bách giữ chỗ vé VIP</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={isGeneratingAI || !aiTopic.trim()}
                    onClick={handleGenerateAI}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isGeneratingAI ? 'Đang tạo nội dung...' : 'Tạo bài đăng Zalo ngay'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Post Title */}
            <div>
              <label className="text-xs text-slate-700 font-semibold block mb-1">
                Tiêu đề bài đăng / Tên chiến dịch *
              </label>
              <input
                type="text"
                placeholder="Ví dụ: 📢 THÔNG BÁO: HỘI NGHỊ KHOA HỌC THẨM MỸ VIỆT - HÀN 2026"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            {/* Post Content */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-700 font-semibold block">
                  Nội dung chi tiết bài đăng Zalo *
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {postContent.length} ký tự
                </span>
              </div>
              <textarea
                rows={9}
                placeholder="Kính gửi Quý Bác sĩ và Quý Đồng nghiệp,&#10;&#10;Ban tổ chức trân trọng kính mời tham dự..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition leading-relaxed font-sans"
              />
            </div>

            {/* CTA URL */}
            <div>
              <label className="text-xs text-slate-700 font-semibold block mb-1">
                Đường link kêu gọi hành động (CTA / Đăng ký vé sự kiện)
              </label>
              <input
                type="text"
                placeholder="https://kbit2026.vercel.app"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Right Column: Target Groups & Schedule Configuration */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl space-y-5 shadow-2xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Cấu hình gửi & Lên lịch</h3>
                <p className="text-xs text-slate-500">Chọn nhóm nhận tin và thời gian thực thi</p>
              </div>

              {/* Action Choice */}
              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-2">Hình thức thực thi</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'publish_now', label: '🚀 Đăng ngay', desc: 'Bắt đầu gửi bài tức thì' },
                    { id: 'schedule', label: '⏱️ Lên lịch hẹn', desc: 'Đăng tự động theo giờ' },
                    { id: 'draft', label: '📝 Lưu bản nháp', desc: 'Lưu lại để duyệt sau' }
                  ].map(act => (
                    <div
                      key={act.id}
                      onClick={() => setPostAction(act.id)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        postAction === act.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{act.label}</span>
                        {postAction === act.id && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className={`text-[10px] mt-0.5 block ${postAction === act.id ? 'text-blue-100' : 'text-slate-400'}`}>
                        {act.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* If Schedule Date */}
              {postAction === 'schedule' && (
                <div className="space-y-1 bg-blue-50/60 p-3.5 rounded-xl border border-blue-200">
                  <label className="text-xs text-blue-900 font-bold block">
                    Thời gian bắt đầu gửi (Asia/Ho_Chi_Minh) *
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              )}

              {/* Delay between groups */}
              <div className="space-y-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-700 font-semibold block">
                    Giãn cách an toàn (Anti-spam Delay)
                  </label>
                  <span className="text-xs font-bold text-blue-600">{delaySeconds} giây/nhóm</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={5}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(e.target.value)}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">
                  Tự động giãn cách ngẫu nhiên để bảo vệ tài khoản Zalo không bị chặn gửi tin.
                </p>
              </div>

              {/* Target Groups Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-700 font-semibold block">
                    Nhóm Zalo nhận bài ({selectedGroupIds.length > 0 ? selectedGroupIds.length : groups.length}/{groups.length})
                  </label>
                  <div className="space-x-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedGroupIds(groups.map(g => g.id))}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Chọn tất cả
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedGroupIds([])}
                      className="text-slate-500 hover:underline"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
                  {groups.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      Chưa có nhóm nào. Vui lòng sang tab "Quản lý nhóm" để thêm nhóm.
                    </div>
                  ) : (
                    groups.map(g => {
                      const isChecked = selectedGroupIds.includes(g.id);
                      return (
                        <label
                          key={g.id}
                          className="flex items-center space-x-2 text-xs p-1.5 rounded-lg hover:bg-white transition cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedGroupIds([...selectedGroupIds, g.id]);
                              else setSelectedGroupIds(selectedGroupIds.filter(id => id !== g.id));
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="flex-1 font-medium text-slate-800 truncate">{g.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{g.category}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                disabled={loading || !postTitle.trim() || !postContent.trim()}
                onClick={handleCreatePostSubmit}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-blue-600/20 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>
                  {postAction === 'publish_now' ? 'Bắt đầu gửi bài ngay' : postAction === 'schedule' ? 'Xác nhận lên lịch đăng' : 'Lưu bản nháp'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GROUPS MANAGEMENT & SEARCH DISCOVERY */}
      {/* ========================================================================= */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Lọc nhóm theo tên, link..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadGroups()}
                  className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white w-48 sm:w-64 transition"
                />
              </div>

              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="all">Tất cả chuyên mục</option>
                <option value="Thẩm mỹ">Thẩm mỹ</option>
                <option value="Spa & Clinic">Spa & Clinic</option>
                <option value="Da liễu & Bác sĩ">Da liễu & Bác sĩ</option>
                <option value="Đào tạo CME">Đào tạo CME</option>
                <option value="Công nghệ & Thiết bị">Công nghệ & Thiết bị</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSearchModal(true)}
                className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-2xs"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Tìm nhóm cộng đồng Zalo</span>
              </button>

              <button
                onClick={() => setShowBatchImportModal(true)}
                className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Nạp danh sách nhóm</span>
              </button>

              <button
                onClick={() => setShowAddGroupModal(true)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm nhóm</span>
              </button>
            </div>
          </div>

          {/* Groups List Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Tên Nhóm Zalo</th>
                    <th className="py-3 px-4">Chuyên mục</th>
                    <th className="py-3 px-4">Đường dẫn (Link)</th>
                    <th className="py-3 px-4 text-center">Bài đã gửi</th>
                    <th className="py-3 px-4">Lần gửi gần nhất</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedGroups.totalItems === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Chưa có nhóm Zalo nào. Bấm <strong>"Tìm nhóm cộng đồng Zalo"</strong> hoặc <strong>"Nạp danh sách nhóm"</strong> ở trên để thêm ngay!
                      </td>
                    </tr>
                  ) : (
                    paginatedGroups.paginatedItems.map(g => (
                      <tr key={g.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center space-x-2">
                            <span>{g.name}</span>
                            {g.group_id_external && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold inline-flex items-center space-x-1">
                                <Bot className="w-3 h-3" />
                                <span>Bot Chat</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {g.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <a
                            href={g.group_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center space-x-1"
                          >
                            <span>{g.group_link}</span>
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                          {g.post_count || 0}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {g.last_posted_at ? new Date(g.last_posted_at).toLocaleString('vi-VN') : 'Chưa gửi'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            g.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {g.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteGroup(g.id, g.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                            title="Xóa nhóm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              totalItems={paginatedGroups.totalItems}
              currentPage={paginatedGroups.currentPage}
              pageSize={paginatedGroups.pageSize}
              onPageChange={paginatedGroups.setCurrentPage}
              onPageSizeChange={paginatedGroups.setPageSize}
              darkMode={false}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: QUEUE & SCHEDULED POSTS */}
      {/* ========================================================================= */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tiến độ hàng đợi & Lịch hẹn đăng Zalo</h3>
              <p className="text-xs text-slate-500">Các chiến dịch đang gửi bài và các bài hẹn giờ trong tương lai</p>
            </div>
            <button
              onClick={() => setActiveTab('compose')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo chiến dịch mới</span>
            </button>
          </div>

          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-400 space-y-3 shadow-2xs">
                <Clock className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs">Chưa có bài đăng nào trong hàng đợi hoặc đã lên lịch.</p>
                <button
                  onClick={() => setActiveTab('compose')}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow"
                >
                  Soạn bài đăng Zalo ngay
                </button>
              </div>
            ) : (
              posts.map(p => {
                const total = p.target_groups_count || 1;
                const done = (p.success_count || 0) + (p.failed_count || 0);
                const pct = Math.min(Math.round((done / total) * 100), 100);

                return (
                  <div key={p.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-slate-900">{p.title}</h4>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                            p.status === 'PROCESSING' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                            p.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            p.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {p.status === 'PROCESSING' ? '● ĐANG GỬI BÀI' : p.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-3">
                          <span>Mục tiêu: <strong>{p.target_groups_count} nhóm</strong></span>
                          <span>•</span>
                          <span>Giãn cách: <strong>{p.delay_seconds}s/nhóm</strong></span>
                          {p.scheduled_at && (
                            <>
                              <span>•</span>
                              <span>Hẹn lúc: <strong className="text-blue-600">{new Date(p.scheduled_at).toLocaleString('vi-VN')}</strong></span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Control buttons */}
                      <div className="flex items-center space-x-2">
                        {p.status === 'PROCESSING' && (
                          <button
                            onClick={() => handlePausePost(p.id)}
                            className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold flex items-center space-x-1"
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                            <span>Tạm dừng</span>
                          </button>
                        )}
                        {(p.status === 'SCHEDULED' || p.status === 'PAUSED' || p.status === 'DRAFT') && (
                          <button
                            onClick={() => handlePublishNow(p.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow transition"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Gửi ngay</span>
                          </button>
                        )}
                        {p.status !== 'COMPLETED' && p.status !== 'FAILED' && (
                          <button
                            onClick={() => handleCancelPost(p.id)}
                            className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center space-x-1"
                          >
                            <StopCircle className="w-3.5 h-3.5" />
                            <span>Hủy</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleViewDetail(p.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                        >
                          Chi tiết
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Tiến độ gửi: <strong>{p.success_count || 0}/{p.target_groups_count} nhóm thành công</strong></span>
                        <span className="font-bold text-blue-600">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Excerpt */}
                    <p className="text-xs text-slate-600 line-clamp-2 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      "{p.content}"
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: HISTORY & REPORTS */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Lịch sử các bài đăng Zalo ({posts.length})
            </h4>
          </div>

          <div className="divide-y divide-slate-100">
            {paginatedPosts.totalItems === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Chưa có lịch sử gửi bài.</div>
            ) : (
              paginatedPosts.paginatedItems.map(p => (
                <div key={p.id} className="p-4 hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{p.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        p.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-slate-600 line-clamp-1 italic">"{p.content}"</p>
                    <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                      <span>Đã gửi: {p.success_count}/{p.target_groups_count} nhóm</span>
                      <span>•</span>
                      <span>Thời gian tạo: {new Date(p.created_at).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleViewDetail(p.id)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg self-start md:self-auto transition"
                  >
                    Xem báo cáo
                  </button>
                </div>
              ))
            )}
          </div>

          <Pagination
            totalItems={paginatedPosts.totalItems}
            currentPage={paginatedPosts.currentPage}
            pageSize={paginatedPosts.pageSize}
            onPageChange={paginatedPosts.setCurrentPage}
            onPageSizeChange={paginatedPosts.setPageSize}
            darkMode={false}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && settings && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200/80 p-6 rounded-2xl space-y-6 shadow-2xs max-w-3xl">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Cấu hình an toàn Zalo Marketing</h3>
            <p className="text-xs text-slate-500">Giới hạn số bài đăng và khoảng cách giãn cách chống checkpoint</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Tên tài khoản Zalo hiển thị</label>
              <input
                type="text"
                value={settings.account_name}
                onChange={(e) => setSettings({ ...settings, account_name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-700 font-semibold block mb-1">Số điện thoại liên kết Zalo</label>
              <input
                type="text"
                value={settings.phone_number || ''}
                placeholder="0912345678"
                onChange={(e) => setSettings({ ...settings, phone_number: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-700 font-semibold block mb-1">Giới hạn gửi mỗi ngày (bài/nhóm)</label>
              <input
                type="number"
                value={settings.daily_limit}
                onChange={(e) => setSettings({ ...settings, daily_limit: parseInt(e.target.value) || 50 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-700 font-semibold block mb-1">Thời gian giãn cách tối thiểu (giây)</label>
              <input
                type="number"
                value={settings.min_delay_seconds}
                onChange={(e) => setSettings({ ...settings, min_delay_seconds: parseInt(e.target.value) || 15 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Zalo Bot Platform Official Connection (bot.zaloplatforms.com) */}
          {/* ========================================================================= */}
          <div className="pt-5 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold border border-purple-200">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Zalo Bot Platform (bot.zaloplatforms.com)</h4>
                  <p className="text-[11px] text-slate-500">API chính thức từ Zalo để gửi bài tốc độ cao, không checkpoint</p>
                </div>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                Official Bot API
              </span>
            </div>

            <div className="space-y-3 bg-purple-50/40 p-4 rounded-2xl border border-purple-100 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Zalo Bot Token *</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Dán token nhận từ bot.zaloplatforms.com (Ví dụ: 123456789:AA...)"
                    value={settings.bot_token || ''}
                    onChange={(e) => setSettings({ ...settings, bot_token: e.target.value })}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    disabled={testingBot || !settings.bot_token}
                    onClick={handleTestBot}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{testingBot ? 'Đang test...' : 'Kiểm tra token'}</span>
                  </button>
                </div>
              </div>

              {/* Bot Test Status Display */}
              {botTestResult && (
                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  botTestResult.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <div className="flex items-center space-x-2">
                    {botTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <div>
                      <div className="font-bold">{botTestResult.message}</div>
                      {botTestResult.bot_name && (
                        <div className="text-[11px] opacity-80">
                          Tên Bot: <strong>{botTestResult.bot_name}</strong> {botTestResult.bot_username ? `(@${botTestResult.bot_username})` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Webhook & Secret Token Configuration */}
              <div className="pt-3 border-t border-purple-100 space-y-3">
                <div className="font-semibold text-slate-800 flex items-center justify-between">
                  <span>Cấu hình Webhook & Bí mật xác thực (Secret Token)</span>
                  <span className="text-[10px] text-purple-600 bg-purple-100/60 px-2 py-0.5 rounded-full font-medium">
                    Bảo mật 2 chiều
                  </span>
                </div>

                {/* Webhook URL Input with Copy button */}
                <div>
                  <label className="text-slate-600 block mb-1 font-medium">
                    Webhook URL (Nhận tin nhắn & tự động bắt nhóm)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={webhookUrlInput}
                      onChange={(e) => setWebhookUrlInput(e.target.value)}
                      placeholder="https://fb.medicalcenter.vn/api/zalo/bot/webhook"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono text-[11px] focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(webhookUrlInput, 'url')}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition flex items-center space-x-1 shrink-0"
                      title="Copy Webhook URL"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedField === 'url' ? 'Đã copy!' : 'Copy URL'}</span>
                    </button>
                  </div>
                </div>

                {/* Secret Token Input with Generate & Copy buttons */}
                <div>
                  <label className="text-slate-600 block mb-1 font-medium flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Key className="w-3.5 h-3.5 text-amber-500" />
                      <span>Secret Token (Khóa xác thực bí mật Webhook)</span>
                    </span>
                    <button
                      type="button"
                      onClick={generateRandomSecret}
                      className="text-purple-600 hover:text-purple-800 font-semibold underline text-[11px]"
                    >
                      🎲 Tạo ngẫu nhiên
                    </button>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={settings.bot_webhook_secret || ''}
                      onChange={(e) => setSettings({ ...settings, bot_webhook_secret: e.target.value })}
                      placeholder="Nhập chuỗi bí mật hoặc bấm Tạo ngẫu nhiên..."
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono text-[11px] focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      disabled={!settings.bot_webhook_secret}
                      onClick={() => copyToClipboard(settings.bot_webhook_secret, 'secret')}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold rounded-xl transition flex items-center space-x-1 shrink-0"
                      title="Copy Secret Token"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedField === 'secret' ? 'Đã copy!' : 'Copy Secret'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={settingWebhook || !settings.bot_token}
                      onClick={handleSetWebhook}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs shrink-0"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>{settingWebhook ? 'Đang kích hoạt...' : 'Kích hoạt Webhook'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nếu bạn điền Webhook trực tiếp trên trang <strong>bot.zaloplatforms.com</strong>, hãy copy <strong>Webhook URL</strong> và <strong>Secret Token</strong> ở trên để dán vào Zalo Bot Manager.
                  </p>
                </div>
              </div>

              {webhookResult && (
                <div className={`p-2.5 rounded-xl border text-[11px] ${
                  webhookResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  {webhookResult.message}
                </div>
              )}

              {/* Quick instructions */}
              <div className="bg-white p-3.5 rounded-xl border border-purple-100 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                <div className="font-bold text-purple-800 flex items-center space-x-1">
                  <span>💡 Hướng dẫn 3 bước kết nối Zalo Bot Platform:</span>
                </div>
                <div>1. Truy cập <a href="https://bot.zaloplatforms.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">bot.zaloplatforms.com</a>, đăng nhập tài khoản Zalo để tạo Bot và sao chép <strong>Bot Token</strong>.</div>
                <div>2. Dán Token vào ô trên, bấm <strong>Kiểm tra token</strong> rồi bấm <strong>Lưu cài đặt Zalo</strong>.</div>
                <div>3. <strong>Mời (Add) Bot vừa tạo vào các nhóm Zalo</strong> bạn muốn đăng tin. Hệ thống sẽ tự động phát hiện nhóm, hoặc bạn có thể copy <strong>Chat ID</strong> của nhóm và dán vào tab <strong>Nhóm mục tiêu</strong>.</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition"
            >
              Lưu cài đặt Zalo
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD SINGLE GROUP */}
      {/* ========================================================================= */}
      {showAddGroupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">Thêm nhóm Zalo mới</h3>
            <form onSubmit={handleCreateSingleGroup} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-medium block mb-1">Tên nhóm Zalo *</label>
                <input
                  required
                  type="text"
                  placeholder="Ví dụ: Hội Bác Sĩ Da Liễu 108"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">
                  Đường dẫn nhóm (Link Zalo hoặc Chat ID Bot) *
                </label>
                <input
                  required
                  type="text"
                  placeholder="https://zalo.me/g/xxxxxx HOẶC Chat ID: -123456789"
                  value={newGroup.group_link}
                  onChange={(e) => setNewGroup({ ...newGroup, group_link: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Nhập link nhóm công khai (zalo.me/g/...) hoặc Chat ID nhóm nhận từ Zalo Bot
                </span>
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">Chuyên mục</label>
                <select
                  value={newGroup.category}
                  onChange={(e) => setNewGroup({ ...newGroup, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="Thẩm mỹ">Thẩm mỹ</option>
                  <option value="Spa & Clinic">Spa & Clinic</option>
                  <option value="Da liễu & Bác sĩ">Da liễu & Bác sĩ</option>
                  <option value="Đào tạo CME">Đào tạo CME</option>
                  <option value="Công nghệ & Thiết bị">Công nghệ & Thiết bị</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddGroupModal(false)}
                  className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow"
                >
                  Thêm nhóm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BATCH IMPORT GROUPS */}
      {/* ========================================================================= */}
      {showBatchImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">Nạp danh sách nhóm Zalo hàng loạt</h3>
            <p className="text-xs text-slate-500">
              Dán danh sách các link nhóm Zalo (mỗi dòng một link hoặc định dạng "Tên nhóm - https://zalo.me/g/..."):
            </p>

            <form onSubmit={handleBatchImport} className="space-y-3 text-xs">
              <textarea
                required
                rows={6}
                placeholder="https://zalo.me/g/nhom1&#10;Hội Spa Hà Nội - https://zalo.me/g/nhom2&#10;https://zalo.me/g/nhom3"
                value={batchImportText}
                onChange={(e) => setBatchImportText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-mono focus:outline-none focus:border-blue-500 leading-relaxed"
              />

              <div>
                <label className="text-slate-700 font-medium block mb-1">Gán chuyên mục cho danh sách này</label>
                <select
                  value={batchCategory}
                  onChange={(e) => setBatchCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="Thẩm mỹ">Thẩm mỹ</option>
                  <option value="Spa & Clinic">Spa & Clinic</option>
                  <option value="Da liễu & Bác sĩ">Da liễu & Bác sĩ</option>
                  <option value="Đào tạo CME">Đào tạo CME</option>
                  <option value="Công nghệ & Thiết bị">Công nghệ & Thiết bị</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchImportModal(false)}
                  className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow"
                >
                  Bắt đầu nạp nhóm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SEARCH ZALO GROUPS */}
      {/* ========================================================================= */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tìm kiếm nhóm cộng đồng Zalo</h3>
                <p className="text-xs text-slate-500">Khám phá các nhóm Zalo chuyên ngành thẩm mỹ, da liễu & CME</p>
              </div>
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nhập từ khóa: thẩm mỹ, spa, da liễu, filler, cme..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchGroups()}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
              />
              <button
                disabled={isSearching || !searchKeyword.trim()}
                onClick={handleSearchGroups}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50 flex items-center space-x-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isSearching ? 'Đang tìm...' : 'Tìm kiếm'}</span>
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2.5">
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Nhập từ khóa và bấm "Tìm kiếm" để quét các nhóm Zalo cộng đồng.
                </div>
              ) : (
                searchResults.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{item.name}</span>
                        <span className="text-[10px] px-2 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px]">{item.description}</p>
                      <div className="text-blue-600 font-mono text-[11px]">{item.group_link}</div>
                    </div>

                    <button
                      disabled={item.already_saved}
                      onClick={() => handleSaveSearchResult(item)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 whitespace-nowrap ${
                        item.already_saved 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                      }`}
                    >
                      {item.already_saved ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã lưu</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Lưu nhóm</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: POST DETAIL */}
      {/* ========================================================================= */}
      {activePostDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{activePostDetail.title}</h3>
                <span className="text-[11px] text-slate-500">
                  Trạng thái: <strong>{activePostDetail.status}</strong> • Đã gửi: {activePostDetail.success_count}/{activePostDetail.target_groups_count} nhóm
                </span>
              </div>
              <button
                onClick={() => setActivePostDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap">
              {activePostDetail.content}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase">Danh sách nhóm nhận bài</h4>
              <div className="max-h-60 overflow-y-auto space-y-1.5">
                {activePostDetail.items && activePostDetail.items.map(it => (
                  <div key={it.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">Nhóm ID: {it.group_id}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      it.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      it.status === 'SENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {it.status} {it.sent_at ? `(${new Date(it.sent_at).toLocaleTimeString('vi-VN')})` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActivePostDetail(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
