import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Pause,
  Play,
  Square,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Plus,
  Trash2,
  Settings,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Users,
  Database,
  BarChart3,
  Calendar,
  Layers,
  FileSpreadsheet,
  Edit,
  Power,
  Server,
  ArrowRightLeft,
  CheckCircle2
} from 'lucide-react';
import {
  getEmailDashboard,
  getEmailCampaigns,
  createEmailCampaign,
  deleteEmailCampaign,
  importCampaignRecipients,
  getCampaignRecipients,
  startEmailCampaign,
  pauseEmailCampaign,
  resumeEmailCampaign,
  stopEmailCampaign,
  emergencyStopAllEmail,
  getEmailQueue,
  retryFailedEmailJobs,
  processEmailBatchNow,
  getEmailSuppressions,
  addEmailSuppression,
  deleteEmailSuppression,
  getEmailSettings,
  updateEmailSettings,
  testEmailSmtpConnection,
  resetEmailCircuitBreaker,
  getEmailAuditLogs,
  getEmailAccounts,
  createEmailAccount,
  updateEmailAccount,
  deleteEmailAccount,
  toggleEmailAccountActive,
  testEmailAccountConnection,
  resetEmailAccountCircuitBreaker
} from '../api';
import Pagination, { usePagination } from '../components/Pagination';

export default function EmailView() {
  const [activeSubTab, setActiveSubTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [queue, setQueue] = useState([]);
  const [suppressions, setSuppressions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Multi-Account States
  const [accounts, setAccounts] = useState([]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [testingAccountId, setTestingAccountId] = useState(null);

  const [accountForm, setAccountForm] = useState({
    name: 'Hostinger Outreach 01',
    priority: 1,
    is_active: true,
    provider_name: 'Hostinger',
    smtp_host: 'smtp.hostinger.com',
    smtp_port: 465,
    smtp_username: '',
    smtp_password: '',
    use_ssl: true,
    use_tls: false,
    from_email: '',
    from_name: 'Aesthetic Conference Hub',
    reply_to: 'support@aesthetichub.vn',
    daily_limit: 300,
    safety_margin_pct: 10.0,
    hourly_limit: 30,
    min_delay_seconds: 15,
    max_delay_seconds: 45,
    sending_window_start: '08:00',
    sending_window_end: '18:00'
  });

  // Pagination Hooks
  const paginatedCampaigns = usePagination(campaigns, 8);
  const paginatedQueue = usePagination(queue, 12);
  const paginatedSuppressions = usePagination(suppressions, 10);
  const paginatedAuditLogs = usePagination(auditLogs, 15);
  const paginatedAccounts = usePagination(accounts, 10);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [recipientsList, setRecipientsList] = useState([]);
  const paginatedRecipients = usePagination(recipientsList, 15);

  // Form states
  const [newCampaign, setNewCampaign] = useState({
    name: 'Hội nghị Thẩm mỹ Quốc tế 2026 - Thư Mời VIP',
    subject: 'Kính mời Bác sĩ tham dự Hội nghị Thẩm mỹ Da liễu Toàn quốc 2026',
    from_name: 'BTC Aesthetic Conference',
    from_email: 'outreach@aesthetichub.vn',
    reply_to: 'support@aesthetichub.vn',
    daily_limit: 300,
    hourly_limit: 30,
    min_delay_seconds: 15,
    max_delay_seconds: 45,
    cta_text: 'Đăng Ký Tham Dự',
    cta_url: 'https://aesthetichub.vn/register',
    content_html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2>Kính gửi Quý Bác sĩ {{name}},</h2>
  <p>Ban tổ chức trân trọng kính mời Bác sĩ tham dự phiên thảo luận chuyên sâu về công nghệ trẻ hóa da và laser tiên tiến tại Hội nghị Thẩm mỹ Quốc tế 2026.</p>
  <p>Chương trình quy tụ hơn 50 chuyên gia đầu ngành trong nước và quốc tế.</p>
  <p><a href="https://aesthetichub.vn/register" style="background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Đăng Ký Giữ Chỗ VIP</a></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
  <small style="color: #666;">Email được gửi đến {{email}}. Nếu không muốn nhận thư mời, vui lòng bấm hủy đăng ký.</small>
</div>`,
    content_plain: `Kính gửi Quý Bác sĩ {{name}},\n\nBan tổ chức trân trọng kính mời Bác sĩ tham dự Hội nghị Thẩm mỹ Quốc tế 2026.\nĐăng ký tại: https://aesthetichub.vn/register`
  });

  const [importText, setImportText] = useState('');
  const [newSuppressionEmail, setNewSuppressionEmail] = useState('');
  const [newSuppressionReason, setNewSuppressionReason] = useState('UNSUBSCRIBED');

  const showNotification = (msg, isError = false) => {
    setFeedbackMsg({ text: msg, isError });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [dashRes, campRes, suppRes, settRes, logsRes, accRes] = await Promise.all([
        getEmailDashboard(),
        getEmailCampaigns(),
        getEmailSuppressions(),
        getEmailSettings(),
        getEmailAuditLogs(50),
        getEmailAccounts()
      ]);
      setDashboardData(dashRes.data);
      setCampaigns(campRes.data);
      setSuppressions(suppRes.data);
      setSettings(settRes.data);
      setAuditLogs(logsRes.data);
      setAccounts(accRes.data || []);
    } catch (err) {
      console.error('Failed to load email data:', err);
      showNotification('Không thể tải dữ liệu email: ' + (err.response?.data?.detail || err.message), true);
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async () => {
    try {
      const res = await getEmailQueue({ limit: 100 });
      setQueue(res.data);
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'queue') {
      loadQueue();
    }
  }, [activeSubTab]);

  // Campaign handlers
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      await createEmailCampaign(newCampaign);
      showNotification('Tạo chiến dịch email thành công!');
      setShowCreateModal(false);
      loadAllData();
    } catch (err) {
      showNotification('Lỗi tạo chiến dịch: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handleDeleteCampaign = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa chiến dịch này không?')) return;
    try {
      await deleteEmailCampaign(id);
      showNotification('Đã xóa chiến dịch thành công.');
      loadAllData();
    } catch (err) {
      showNotification('Lỗi xóa chiến dịch: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handleStartCampaign = async (id) => {
    try {
      await startEmailCampaign(id);
      showNotification('Đã kích hoạt chiến dịch! Worker đang xử lý theo hàng đợi.');
      loadAllData();
    } catch (err) {
      showNotification('Lỗi: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handlePauseCampaign = async (id) => {
    try {
      await pauseEmailCampaign(id);
      showNotification('Đã tạm dừng chiến dịch.');
      loadAllData();
    } catch (err) {
      showNotification('Lỗi: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handleResumeCampaign = async (id) => {
    try {
      await resumeEmailCampaign(id);
      showNotification('Đã tiếp tục chiến dịch.');
      loadAllData();
    } catch (err) {
      showNotification('Lỗi: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handleStopCampaign = async (id) => {
    if (!window.confirm('Bạn có chắc muốn hủy/dừng hẳn chiến dịch này?')) return;
    try {
      await stopEmailCampaign(id);
      showNotification('Đã hủy chiến dịch.');
      loadAllData();
    } catch (err) {
      showNotification('Lỗi: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handleEmergencyStop = async () => {
    if (!window.confirm('CẢNH BÁO: Bạn sắp kích hoạt STOP ALL EMAIL! Toàn bộ chiến dịch sẽ dừng gửi ngay lập tức. Tiếp tục?')) return;
    try {
      const res = await emergencyStopAllEmail();
      showNotification(res.data.message, true);
      loadAllData();
    } catch (err) {
      showNotification('Lỗi: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  // Import recipients
  const handleImportRecipients = async () => {
    if (!importText.trim()) return;
    try {
      // Parse lines: either "email,name" or just "email"
      const lines = importText.split('\n');
      const recipients = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(',');
        const email = parts[0].trim();
        const name = parts.length > 1 ? parts[1].trim() : '';
        if (email.includes('@')) {
          recipients.push({ email, name });
        }
      }

      if (recipients.length === 0) {
        showNotification('Không tìm thấy địa chỉ email hợp lệ nào trong nội dung nhập.', true);
        return;
      }

      const res = await importCampaignRecipients(selectedCampaignId, { recipients });
      showNotification(res.data.message);
      setImportText('');
      setShowImportModal(false);
      loadAllData();
    } catch (err) {
      showNotification('Lỗi nạp danh sách: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const simulate5000Contacts = () => {
    const mockList = [];
    for (let i = 1; i <= 5000; i++) {
      mockList.push(`bacsi.thammy.${i}@hospital.vn,Bác sĩ Chuyên khoa ${i}`);
    }
    setImportText(mockList.join('\n'));
  };

  const handleViewRecipients = async (campId) => {
    setSelectedCampaignId(campId);
    setShowRecipientsModal(true);
    try {
      const res = await getCampaignRecipients(campId, { limit: 100 });
      setRecipientsList(res.data);
    } catch (err) {
      showNotification('Lỗi tải danh sách người nhận: ' + err.message, true);
    }
  };

  const handleProcessBatchNow = async () => {
    try {
      const res = await processEmailBatchNow({ max_batch: 5, enable_delay: false });
      showNotification(`Đã thực hiện gửi thử nghiệm 1 lượt (${res.data.processed_count} email đã xử lý)`);
      loadAllData();
      if (activeSubTab === 'queue') loadQueue();
    } catch (err) {
      showNotification('Lỗi: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handleRetryFailed = async () => {
    try {
      const res = await retryFailedEmailJobs();
      showNotification(res.data.message);
      loadQueue();
      loadAllData();
    } catch (err) {
      showNotification('Lỗi retry: ' + err.message, true);
    }
  };

  // Suppression handlers
  const handleAddSuppression = async (e) => {
    e.preventDefault();
    if (!newSuppressionEmail.trim()) return;
    try {
      await addEmailSuppression({ email: newSuppressionEmail, reason: newSuppressionReason, source: 'Manual' });
      showNotification('Đã thêm email vào danh sách chặn.');
      setNewSuppressionEmail('');
      const res = await getEmailSuppressions();
      setSuppressions(res.data);
    } catch (err) {
      showNotification('Lỗi: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handleDeleteSuppression = async (id) => {
    try {
      await deleteEmailSuppression(id);
      showNotification('Đã gỡ email khỏi danh sách chặn.');
      const res = await getEmailSuppressions();
      setSuppressions(res.data);
    } catch (err) {
      showNotification('Lỗi: ' + err.message, true);
    }
  };

  // Settings handlers
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await updateEmailSettings(settings);
      showNotification('Cập nhật cấu hình gửi email thành công.');
      loadAllData();
    } catch (err) {
      showNotification('Lỗi lưu cấu hình: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handleTestConnection = async () => {
    try {
      const res = await testEmailSmtpConnection();
      if (res.data.success) {
        showNotification('Kết nối SMTP thành công (250 OK)!');
      } else {
        showNotification('Kết nối thất bại: ' + res.data.message, true);
      }
    } catch (err) {
      showNotification('Lỗi kết nối: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handleResetCircuitBreaker = async () => {
    try {
      await resetEmailCircuitBreaker();
      showNotification('Đã reset Circuit Breaker về trạng thái An toàn.');
      loadAllData();
    } catch (err) {
      showNotification('Lỗi: ' + err.message, true);
    }
  };

  // Multi-Account Handlers
  const handleOpenCreateAccount = () => {
    if (accounts.length >= 10) {
      showNotification('Đã đạt giới hạn tối đa 10 cấu hình email gửi.', true);
      return;
    }
    const nextPriority = accounts.length + 1;
    setAccountForm({
      name: `Hostinger Outreach 0${nextPriority}`,
      priority: nextPriority,
      is_active: true,
      provider_name: 'Hostinger',
      smtp_host: 'smtp.hostinger.com',
      smtp_port: 465,
      smtp_username: `outreach${nextPriority}@aesthetichub.vn`,
      smtp_password: '',
      use_ssl: true,
      use_tls: false,
      from_email: `outreach${nextPriority}@aesthetichub.vn`,
      from_name: 'Aesthetic Conference Hub',
      reply_to: 'support@aesthetichub.vn',
      daily_limit: 300,
      safety_margin_pct: 10.0,
      hourly_limit: 30,
      min_delay_seconds: 15,
      max_delay_seconds: 45,
      sending_window_start: '08:00',
      sending_window_end: '18:00'
    });
    setEditingAccount(null);
    setShowAccountModal(true);
  };

  const handleOpenEditAccount = (acc) => {
    setAccountForm({
      name: acc.name,
      priority: acc.priority,
      is_active: acc.is_active,
      provider_name: acc.provider_name,
      smtp_host: acc.smtp_host,
      smtp_port: acc.smtp_port,
      smtp_username: acc.smtp_username,
      smtp_password: acc.smtp_password || '',
      use_ssl: acc.use_ssl,
      use_tls: acc.use_tls,
      from_email: acc.from_email,
      from_name: acc.from_name,
      reply_to: acc.reply_to || '',
      daily_limit: acc.daily_limit,
      safety_margin_pct: acc.safety_margin_pct,
      hourly_limit: acc.hourly_limit,
      min_delay_seconds: acc.min_delay_seconds,
      max_delay_seconds: acc.max_delay_seconds,
      sending_window_start: acc.sending_window_start,
      sending_window_end: acc.sending_window_end
    });
    setEditingAccount(acc);
    setShowAccountModal(true);
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await updateEmailAccount(editingAccount.id, accountForm);
        showNotification(`Đã cập nhật cấu hình '${accountForm.name}' thành công.`);
      } else {
        await createEmailAccount(accountForm);
        showNotification(`Đã tạo cấu hình '${accountForm.name}' thành công.`);
      }
      setShowAccountModal(false);
      loadAllData();
    } catch (err) {
      showNotification('Lỗi lưu cấu hình: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handleDeleteAccount = async (acc) => {
    if (accounts.length <= 1) {
      showNotification('Không thể xóa cấu hình duy nhất. Hệ thống cần ít nhất 1 tài khoản.', true);
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa cấu hình '${acc.name}' (${acc.from_email})?`)) return;
    try {
      await deleteEmailAccount(acc.id);
      showNotification(`Đã xóa cấu hình '${acc.name}' thành công.`);
      loadAllData();
    } catch (err) {
      showNotification('Lỗi xóa cấu hình: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handleToggleAccountActive = async (acc) => {
    try {
      await toggleEmailAccountActive(acc.id);
      showNotification(`Đã ${acc.is_active ? 'vô hiệu hóa' : 'kích hoạt'} cấu hình '${acc.name}'.`);
      loadAllData();
    } catch (err) {
      showNotification('Lỗi bật/tắt cấu hình: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const handleTestAccountConnection = async (acc) => {
    setTestingAccountId(acc.id);
    try {
      const res = await testEmailAccountConnection(acc.id);
      if (res.data.success) {
        showNotification(res.data.message);
      } else {
        showNotification(res.data.message, true);
      }
    } catch (err) {
      showNotification('Lỗi kiểm tra kết nối: ' + (err.response?.data?.detail || err.message), true);
    } finally {
      setTestingAccountId(null);
    }
  };

  const handleResetAccountCircuitBreaker = async (acc) => {
    try {
      await resetEmailAccountCircuitBreaker(acc.id);
      showNotification(`Đã reset Circuit Breaker cho cấu hình '${acc.name}'.`);
      loadAllData();
    } catch (err) {
      showNotification('Lỗi reset: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  const quota = dashboardData?.quota || { daily_limit: 300, used_count: 0, remaining_count: 300, effective_limit: 270, safety_margin_pct: 10 };
  const metrics = dashboardData?.metrics || { sent_count: 0, queued_count: 0, failed_count: 0, skipped_count: 0 };
  const providerStatus = dashboardData?.provider_status || {};

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Email Campaign Queue & Reliable Sending</h1>
              <p className="text-sm text-slate-500">
                Hệ thống hàng đợi gửi email thông minh chuẩn Enterprise — Kiểm soát Quota Hostinger & Chống Spam
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleEmergencyStop}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-sm transition"
            title="Dừng tất cả chiến dịch ngay lập tức"
          >
            <AlertTriangle className="w-4 h-4" />
            STOP ALL EMAIL
          </button>

          <button
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          feedbackMsg.isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {feedbackMsg.isError ? <AlertTriangle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
          <span className="text-sm font-medium">{feedbackMsg.text}</span>
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
        {[
          { id: 'dashboard', label: 'Tổng quan & Quota', icon: BarChart3 },
          { id: 'campaigns', label: 'Chiến dịch', icon: Layers },
          { id: 'queue', label: 'Hàng đợi (Queue)', icon: Clock },
          { id: 'suppression', label: 'Danh sách chặn (Suppression)', icon: ShieldAlert },
          { id: 'settings', label: `Tài khoản Gửi (${accounts.length}/10)`, icon: Server },
          { id: 'logs', label: 'Nhật ký (Audit Logs)', icon: Database }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`pb-3 flex items-center gap-2 border-b-2 transition ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD & QUOTA */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Quota & Circuit Breaker Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Quota Gauge Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hạn ngạch gửi hôm nay (Quota)</span>
                  <h3 className="text-xl font-bold text-slate-800 mt-1">
                    {quota.used_count} / {quota.effective_limit} <span className="text-xs font-normal text-slate-500">(Tối đa: {quota.daily_limit})</span>
                  </h3>
                </div>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full">
                  Margin: {quota.safety_margin_pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    quota.used_count >= quota.effective_limit ? 'bg-red-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, (quota.used_count / quota.effective_limit) * 100)}%` }}
                ></div>
              </div>

              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>Còn lại: <strong className="text-slate-800">{quota.remaining_count} email</strong></span>
                <span>Reset lúc: <strong>{quota.resets_at}</strong></span>
              </div>

              {dashboardData?.accounts && dashboardData.accounts.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                      Tiến độ hạn ngạch từng tài khoản (Auto-Rotation):
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Đang gửi qua: <strong className="text-blue-600 font-semibold">{dashboardData?.provider_status?.current_active_sender}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {dashboardData.accounts.map((acc) => (
                      <div key={acc.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between font-medium">
                          <span className="truncate text-slate-700 font-semibold">#{acc.priority} {acc.name}</span>
                          {acc.is_exhausted ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-700">Hết quota</span>
                          ) : !acc.is_active ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-200 text-slate-600">Tắt</span>
                          ) : acc.is_paused ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-red-100 text-red-700">Tạm dừng</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-700">Khả dụng</span>
                          )}
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 my-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${acc.is_exhausted ? 'bg-amber-500' : 'bg-blue-600'}`}
                            style={{ width: `${Math.min(100, acc.percent_used)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>{acc.used_count} / {acc.effective_limit} email</span>
                          <span>Còn: <strong className="text-slate-700">{acc.remaining_count}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Khung giờ gửi: <strong>{settings?.sending_window_start || '08:00'} - {settings?.sending_window_end || '18:00'} (GMT+7)</strong></span>
                <button
                  onClick={handleProcessBatchNow}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded transition"
                >
                  Gửi 1 lượt ngay
                </button>
              </div>
            </div>

            {/* Circuit Breaker Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Circuit Breaker</span>
              <div className="mt-2 flex items-center gap-2">
                {providerStatus.is_paused ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full">
                    <ShieldAlert className="w-4 h-4" /> ĐÃ KÍCH HOẠT (PAUSED)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
                    <ShieldCheck className="w-4 h-4" /> AN TOÀN (HEALTHY)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Lỗi liên tiếp: <strong>{providerStatus.consecutive_failures || 0} / 20</strong>
              </p>
              {providerStatus.is_paused && (
                <button
                  onClick={handleResetCircuitBreaker}
                  className="mt-3 w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold"
                >
                  Khôi phục Circuit Breaker
                </button>
              )}
            </div>

            {/* Overall Metrics Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng quan gửi</span>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-base font-bold text-green-600">{metrics.sent_count}</div>
                  <div className="text-[10px] text-slate-500">Đã gửi thành công</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-base font-bold text-blue-600">{metrics.queued_count}</div>
                  <div className="text-[10px] text-slate-500">Đang chờ gửi</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-base font-bold text-red-500">{metrics.failed_count + (metrics.bounced_count || 0)}</div>
                  <div className="text-[10px] text-slate-500">Lỗi / Bounced</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-base font-bold text-amber-500">{metrics.skipped_count}</div>
                  <div className="text-[10px] text-slate-500">Bỏ qua (Fatigue/Supp)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Active Campaigns Progress View */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                Chiến dịch đang hoạt động
              </h3>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
              >
                <Plus className="w-4 h-4" /> Tạo chiến dịch mới
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                Chưa có chiến dịch nào. Nhấn "Tạo chiến dịch mới" để bắt đầu!
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.map((camp) => {
                  const progressPct = camp.total_recipients > 0
                    ? Math.round((camp.sent_count / camp.total_recipients) * 100)
                    : 0;
                  return (
                    <div key={camp.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 text-sm">{camp.name}</h4>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            camp.status === 'RUNNING' ? 'bg-green-100 text-green-700 animate-pulse' :
                            camp.status === 'PAUSED' ? 'bg-amber-100 text-amber-700' :
                            camp.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {camp.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Tiêu đề: {camp.subject}</p>

                        {/* Progress */}
                        <div className="mt-3 flex items-center gap-3">
                          <div className="w-48 bg-slate-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progressPct}%` }}></div>
                          </div>
                          <span className="text-xs font-semibold text-slate-700">
                            {camp.sent_count} / {camp.total_recipients} ({progressPct}%)
                          </span>
                          {camp.estimated_days_remaining !== null && camp.status === 'RUNNING' && (
                            <span className="text-xs text-blue-600 font-medium">
                              (Dự kiến hoàn thành: ~{camp.estimated_days_remaining} ngày)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2">
                        {camp.status === 'RUNNING' ? (
                          <button
                            onClick={() => handlePauseCampaign(camp.id)}
                            className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-semibold rounded flex items-center gap-1"
                          >
                            <Pause className="w-3.5 h-3.5" /> Tạm dừng
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartCampaign(camp.id)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded flex items-center gap-1"
                          >
                            <Play className="w-3.5 h-3.5" /> Bắt đầu
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedCampaignId(camp.id);
                            setShowImportModal(true);
                          }}
                          className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded flex items-center gap-1"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Nạp Contacts
                        </button>

                        <button
                          onClick={() => handleViewRecipients(camp.id)}
                          className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded flex items-center gap-1"
                        >
                          <Users className="w-3.5 h-3.5" /> Chi tiết
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CAMPAIGNS LIST */}
      {activeSubTab === 'campaigns' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Quản lý Chiến dịch Email</h3>
              <p className="text-xs text-slate-500">Tạo, nạp danh bạ 5.000 contacts và phân phối theo hạn mức Hostinger</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Soạn Chiến dịch mới
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Tên Chiến dịch</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3">Tiến độ gửi</th>
                  <th className="p-3">Còn lại</th>
                  <th className="p-3">Ước tính</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCampaigns.totalItems === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-400">
                      Chưa có chiến dịch nào. Hãy tạo chiến dịch mới.
                    </td>
                  </tr>
                ) : (
                  paginatedCampaigns.paginatedItems.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold">#{c.id}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{c.name}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{c.subject}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === 'RUNNING' ? 'bg-green-100 text-green-700' :
                          c.status === 'PAUSED' ? 'bg-amber-100 text-amber-700' :
                          c.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-700">{c.sent_count} / {c.total_recipients}</div>
                        <div className="w-24 bg-slate-200 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${c.total_recipients > 0 ? (c.sent_count / c.total_recipients) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="p-3 font-bold text-slate-700">{c.remaining_count}</td>
                      <td className="p-3 text-slate-500">
                        {c.estimated_days_remaining ? `~${c.estimated_days_remaining} ngày` : '-'}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {c.status === 'RUNNING' ? (
                          <button
                            onClick={() => handlePauseCampaign(c.id)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                            title="Tạm dừng"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartCampaign(c.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Bắt đầu"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedCampaignId(c.id);
                            setShowImportModal(true);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Nạp người nhận"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleViewRecipients(c.id)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                          title="Xem danh sách người nhận"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCampaign(c.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Xóa chiến dịch"
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
            totalItems={paginatedCampaigns.totalItems}
            currentPage={paginatedCampaigns.currentPage}
            pageSize={paginatedCampaigns.pageSize}
            onPageChange={paginatedCampaigns.setCurrentPage}
            onPageSizeChange={paginatedCampaigns.setPageSize}
            darkMode={false}
          />
        </div>
      )}


      {/* TAB 3: QUEUE */}
      {activeSubTab === 'queue' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Hàng đợi Gửi (Job Queue)</h3>
              <p className="text-xs text-slate-500">Các email đang nằm trong tiến trình hàng đợi, kèm cơ chế Watchdog & Idempotency</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRetryFailed}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded border border-amber-200"
              >
                Thử lại tất cả job lỗi (Retry Failed)
              </button>
              <button
                onClick={loadQueue}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
              >
                Làm mới Queue
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Job ID</th>
                  <th className="p-3">Chiến dịch</th>
                  <th className="p-3">Người nhận</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3">Số lần thử</th>
                  <th className="p-3">Khóa bởi (Locked by)</th>
                  <th className="p-3">Lỗi gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedQueue.totalItems === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-400">
                      Không có job nào trong hàng đợi.
                    </td>
                  </tr>
                ) : (
                  paginatedQueue.paginatedItems.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold">#{j.id}</td>
                      <td className="p-3 font-medium text-slate-700">{j.campaign_name || `#${j.campaign_id}`}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{j.recipient_email}</div>
                        <div className="text-[10px] text-slate-400">{j.recipient_name}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          j.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          j.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                          j.status === 'RETRY' ? 'bg-amber-100 text-amber-700' :
                          j.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="p-3 font-semibold">{j.attempts} / 5</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">{j.locked_by || '-'}</td>
                      <td className="p-3 text-red-600 text-[11px] truncate max-w-xs">{j.last_error || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            totalItems={paginatedQueue.totalItems}
            currentPage={paginatedQueue.currentPage}
            pageSize={paginatedQueue.pageSize}
            onPageChange={paginatedQueue.setCurrentPage}
            onPageSizeChange={paginatedQueue.setPageSize}
            darkMode={false}
          />
        </div>
      )}


      {/* TAB 4: SUPPRESSION */}
      {activeSubTab === 'suppression' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-base">Thêm vào Danh sách Chặn</h3>
            <p className="text-xs text-slate-500">
              Email nằm trong danh sách này sẽ tự động bị bỏ qua (SKIPPED), không bao giờ gửi lại.
            </p>
            <form onSubmit={handleAddSuppression} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Địa chỉ Email</label>
                <input
                  type="email"
                  required
                  value={newSuppressionEmail}
                  onChange={(e) => setNewSuppressionEmail(e.target.value)}
                  placeholder="contact@spam.com"
                  className="w-full mt-1 p-2 border border-slate-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Lý do chặn</label>
                <select
                  value={newSuppressionReason}
                  onChange={(e) => setNewSuppressionReason(e.target.value)}
                  className="w-full mt-1 p-2 border border-slate-300 rounded text-xs"
                >
                  <option value="UNSUBSCRIBED">Hủy đăng ký (Unsubscribed)</option>
                  <option value="HARD_BOUNCE">Hard Bounce (Hòm thư không tồn tại)</option>
                  <option value="COMPLAINT">Báo cáo Spam (Complaint)</option>
                  <option value="INVALID">Địa chỉ không hợp lệ (Invalid)</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold transition"
              >
                Thêm vào Suppression List
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-base">Danh sách Email Bị Chặn ({suppressions.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Email</th>
                    <th className="p-3">Lý do</th>
                    <th className="p-3">Nguồn</th>
                    <th className="p-3">Ngày thêm</th>
                    <th className="p-3 text-right">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedSuppressions.totalItems === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-6 text-slate-400">
                        Danh sách chặn trống.
                      </td>
                    </tr>
                  ) : (
                    paginatedSuppressions.paginatedItems.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-800">{s.email}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                            {s.reason}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">{s.source}</td>
                        <td className="p-3 text-slate-400 text-[11px]">{new Date(s.created_at).toLocaleDateString('vi-VN')}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteSuppression(s.id)}
                            className="text-red-500 hover:text-red-700 p-1"
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
              totalItems={paginatedSuppressions.totalItems}
              currentPage={paginatedSuppressions.currentPage}
              pageSize={paginatedSuppressions.pageSize}
              onPageChange={paginatedSuppressions.setCurrentPage}
              onPageSizeChange={paginatedSuppressions.setPageSize}
              darkMode={false}
            />
          </div>
        </div>
      )}


      {/* TAB 5: MULTI-ACCOUNT SENDER CONFIGURATIONS (UP TO 10 ACCOUNTS & AUTO-ROTATION) */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          {/* Top Banner with Summary & Add Button */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-lg">Quản lý 10 Cấu hình Email gửi & Luân chuyển Quota</h3>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                  {accounts.length} / 10 cấu hình
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Cơ chế <strong>Auto-Rotation</strong> tự động: Hệ thống ưu tiên gửi theo thứ tự ưu tiên (#1, #2, #3...). Khi một tài khoản chạm trần hạn ngạch ngày (daily limit), hệ thống sẽ <strong>tự động chuyển tiếp sang tài khoản kế tiếp</strong> mà không làm gián đoạn chiến dịch.
              </p>
            </div>

            <button
              onClick={handleOpenCreateAccount}
              disabled={accounts.length >= 10}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Cấu Hình Gửi Mới ({accounts.length}/10)</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Tài khoản Hoạt động</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-slate-800">
                  {accounts.filter(a => a.is_active && !a.is_paused).length}
                </span>
                <span className="text-xs text-slate-500">/ {accounts.length} cấu hình</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Tổng Hạn ngạch Ngày</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-emerald-600">
                  {accounts.filter(a => a.is_active).reduce((sum, a) => sum + (a.daily_limit || 0), 0)}
                </span>
                <span className="text-xs text-slate-500">emails/ngày</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Hạn mức Hiệu dụng (An toàn)</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-blue-600">
                  {accounts.filter(a => a.is_active).reduce((sum, a) => sum + (a.effective_limit || Math.round(a.daily_limit * 0.9)), 0)}
                </span>
                <span className="text-xs text-slate-500">emails/ngày (-10%)</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Tài khoản Gửi Hiện tại</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-sm font-bold text-slate-800 truncate" title={dashboardData?.provider_status?.current_active_sender || 'Đang xác định'}>
                  {dashboardData?.provider_status?.current_active_sender || 'Chưa xác định'}
                </span>
              </div>
            </div>
          </div>

          {/* Accounts List Table / Cards */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                Danh Sách Cấu Hình Gửi & Hàng Đợi Luân Chuyển ({accounts.length})
              </h4>
              <span className="text-xs text-slate-500">
                Sắp xếp theo độ ưu tiên: Số nhỏ gửi trước, khi đầy chuyển số tiếp theo
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-center w-16">Ưu tiên</th>
                    <th className="p-3">Tên & Người gửi (From)</th>
                    <th className="p-3">Máy chủ SMTP</th>
                    <th className="p-3">Hạn ngạch hôm nay (Quota)</th>
                    <th className="p-3 text-center">Trạng thái</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedAccounts.totalItems === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-slate-400">
                        Chưa có cấu hình email nào. Hãy bấm "Thêm Cấu Hình Gửi Mới".
                      </td>
                    </tr>
                  ) : (
                    paginatedAccounts.paginatedItems.map((acc) => {
                      const isTesting = testingAccountId === acc.id;
                      return (
                        <tr key={acc.id} className={`hover:bg-slate-50/80 transition ${!acc.is_active ? 'opacity-60 bg-slate-50/40' : ''}`}>
                          {/* Priority badge */}
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs ${
                              acc.priority === 1
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              #{acc.priority}
                            </span>
                          </td>

                          {/* Account Name & Sender */}
                          <td className="p-3">
                            <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                              {acc.name}
                              {acc.is_active && !acc.is_paused && !acc.is_exhausted && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Đang sẵn sàng gửi"></span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              {acc.from_name} &lt;{acc.from_email}&gt;
                            </div>
                            {acc.reply_to && (
                              <div className="text-[10px] text-slate-400">Reply-To: {acc.reply_to}</div>
                            )}
                          </td>

                          {/* SMTP Host */}
                          <td className="p-3">
                            <div className="font-mono text-slate-700">
                              {acc.smtp_host}:{acc.smtp_port}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span>{acc.use_ssl ? 'SSL (465)' : acc.use_tls ? 'TLS (587)' : 'Plain'}</span>
                              <span>•</span>
                              <span className="truncate max-w-[130px]" title={acc.smtp_username}>{acc.smtp_username}</span>
                            </div>
                          </td>

                          {/* Quota Progress */}
                          <td className="p-3 w-56">
                            <div className="flex justify-between items-center text-xs mb-1">
                              <span className="font-semibold text-slate-700">
                                {acc.used_today || 0} / {acc.effective_limit || acc.daily_limit}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                (Max: {acc.daily_limit})
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  acc.is_exhausted
                                    ? 'bg-amber-500'
                                    : acc.percent_used > 80
                                      ? 'bg-amber-400'
                                      : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, acc.percent_used || 0)}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                              <span>Còn lại: <strong className="text-slate-700">{acc.remaining_today ?? (acc.daily_limit - (acc.used_today || 0))}</strong></span>
                              {acc.is_exhausted ? (
                                <span className="px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-700">Hết quota ngày</span>
                              ) : acc.percent_used > 0 ? (
                                <span>{acc.percent_used}%</span>
                              ) : (
                                <span className="text-emerald-600 font-medium">Chưa dùng</span>
                              )}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="p-3 text-center">
                            {!acc.is_active ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                VÔ HIỆU HÓA
                              </span>
                            ) : acc.is_paused ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                                TẠM DỪNG (CB)
                              </span>
                            ) : acc.is_exhausted ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                ĐÃ HẾT QUOTA
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                ĐANG SẴN SÀNG
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Test Connection */}
                              <button
                                onClick={() => handleTestAccountConnection(acc)}
                                disabled={isTesting}
                                className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition border border-slate-200"
                                title="Kiểm tra kết nối SMTP"
                              >
                                {isTesting ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                ) : (
                                  <Server className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* Toggle Active */}
                              <button
                                onClick={() => handleToggleAccountActive(acc)}
                                className={`p-1.5 rounded transition border ${
                                  acc.is_active
                                    ? 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                                    : 'text-slate-400 hover:bg-slate-100 border-slate-200'
                                }`}
                                title={acc.is_active ? 'Tắt tài khoản này' : 'Bật tài khoản này'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit Account */}
                              <button
                                onClick={() => handleOpenEditAccount(acc)}
                                className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition border border-slate-200"
                                title="Chỉnh sửa cấu hình"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {/* Reset CB if paused */}
                              {acc.is_paused && (
                                <button
                                  onClick={() => handleResetAccountCircuitBreaker(acc)}
                                  className="p-1.5 rounded text-amber-600 hover:bg-amber-50 transition border border-amber-200"
                                  title="Reset lỗi Circuit Breaker"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete Account */}
                              {accounts.length > 1 && (
                                <button
                                  onClick={() => handleDeleteAccount(acc)}
                                  className="p-1.5 rounded text-red-500 hover:bg-red-50 transition border border-slate-200"
                                  title="Xóa cấu hình"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              totalItems={paginatedAccounts.totalItems}
              currentPage={paginatedAccounts.currentPage}
              pageSize={paginatedAccounts.pageSize}
              onPageChange={paginatedAccounts.setCurrentPage}
              onPageSizeChange={paginatedAccounts.setPageSize}
              darkMode={false}
            />
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SENDER ACCOUNT (UP TO 10 ACCOUNTS) */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">
                  {editingAccount ? `Chỉnh Sửa Cấu Hình: ${editingAccount.name}` : 'Thêm Cấu Hình Gửi Mới (Tối đa 10)'}
                </h3>
                <p className="text-xs text-slate-500">
                  Cấu hình tài khoản SMTP gửi email và hạn ngạch ngày phục vụ luân chuyển tự động
                </p>
              </div>
              <button
                onClick={() => setShowAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
              {/* Basic & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700">Tên gợi nhớ của cấu hình *</label>
                  <input
                    type="text"
                    required
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                    placeholder="VD: Hostinger Outreach 01"
                    className="w-full mt-1 p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Thứ tự ưu tiên (1 - 10) *</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={accountForm.priority}
                    onChange={(e) => setAccountForm({ ...accountForm, priority: parseInt(e.target.value) || 1 })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded text-center font-bold"
                  />
                  <small className="text-[10px] text-slate-400">Số 1 gửi trước, sau đó đến số 2...</small>
                </div>
              </div>

              {/* Provider Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Loại Provider</label>
                  <select
                    value={accountForm.provider_name}
                    onChange={(e) => setAccountForm({ ...accountForm, provider_name: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded bg-white font-medium"
                  >
                    <option value="Hostinger">Hostinger SMTP (Gửi thực qua smtplib)</option>
                    <option value="MockEmailProvider">Mock Email Provider (Mô phỏng thử nghiệm / Test)</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accountForm.is_active}
                      onChange={(e) => setAccountForm({ ...accountForm, is_active: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>Kích hoạt tài khoản này trong vòng xoay gửi</span>
                  </label>
                </div>
              </div>

              {/* SMTP Host & Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="font-semibold text-slate-700">SMTP Host *</label>
                  <input
                    type="text"
                    required
                    value={accountForm.smtp_host}
                    onChange={(e) => setAccountForm({ ...accountForm, smtp_host: e.target.value })}
                    placeholder="smtp.hostinger.com"
                    className="w-full mt-1 p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Cổng (Port) *</label>
                  <input
                    type="number"
                    required
                    value={accountForm.smtp_port}
                    onChange={(e) => setAccountForm({ ...accountForm, smtp_port: parseInt(e.target.value) || 465 })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded"
                  />
                </div>
              </div>

              {/* Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">SMTP Username *</label>
                  <input
                    type="text"
                    required
                    value={accountForm.smtp_username}
                    onChange={(e) => setAccountForm({ ...accountForm, smtp_username: e.target.value })}
                    placeholder="outreach@aesthetichub.vn"
                    className="w-full mt-1 p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">SMTP Password</label>
                  <input
                    type="password"
                    value={accountForm.smtp_password}
                    onChange={(e) => setAccountForm({ ...accountForm, smtp_password: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full mt-1 p-2 border border-slate-300 rounded"
                  />
                </div>
              </div>

              {/* SSL / TLS */}
              <div className="flex gap-4 font-medium text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={accountForm.use_ssl}
                    onChange={(e) => setAccountForm({ ...accountForm, use_ssl: e.target.checked })}
                  />
                  Sử dụng SSL (Khuyên dùng: Cổng 465)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={accountForm.use_tls}
                    onChange={(e) => setAccountForm({ ...accountForm, use_tls: e.target.checked })}
                  />
                  Sử dụng TLS (Cổng 587)
                </label>
              </div>

              {/* From Email, From Name, Reply To */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">From Email *</label>
                  <input
                    type="email"
                    required
                    value={accountForm.from_email}
                    onChange={(e) => setAccountForm({ ...accountForm, from_email: e.target.value })}
                    placeholder="outreach@aesthetichub.vn"
                    className="w-full mt-1 p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">From Name *</label>
                  <input
                    type="text"
                    required
                    value={accountForm.from_name}
                    onChange={(e) => setAccountForm({ ...accountForm, from_name: e.target.value })}
                    placeholder="Aesthetic Conference"
                    className="w-full mt-1 p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Reply-To</label>
                  <input
                    type="email"
                    value={accountForm.reply_to}
                    onChange={(e) => setAccountForm({ ...accountForm, reply_to: e.target.value })}
                    placeholder="support@aesthetichub.vn"
                    className="w-full mt-1 p-2 border border-slate-300 rounded"
                  />
                </div>
              </div>

              {/* Limits & Margin */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Hạn ngạch/Ngày *</label>
                  <input
                    type="number"
                    required
                    value={accountForm.daily_limit}
                    onChange={(e) => setAccountForm({ ...accountForm, daily_limit: parseInt(e.target.value) || 300 })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded"
                  />
                  <small className="text-[10px] text-slate-400">Hostinger: 100, 200, 300, 500</small>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Biên an toàn (%)</label>
                  <input
                    type="number"
                    value={accountForm.safety_margin_pct}
                    onChange={(e) => setAccountForm({ ...accountForm, safety_margin_pct: parseFloat(e.target.value) || 10 })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded"
                  />
                  <small className="text-[10px] text-slate-400">Mặc định: 10% (Chỉ gửi 90%)</small>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Giới hạn/Giờ</label>
                  <input
                    type="number"
                    value={accountForm.hourly_limit}
                    onChange={(e) => setAccountForm({ ...accountForm, hourly_limit: parseInt(e.target.value) || 30 })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Delay Ngẫu nhiên (s)</label>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      value={accountForm.min_delay_seconds}
                      onChange={(e) => setAccountForm({ ...accountForm, min_delay_seconds: parseInt(e.target.value) || 15 })}
                      className="w-1/2 p-2 border border-slate-300 rounded text-center"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      value={accountForm.max_delay_seconds}
                      onChange={(e) => setAccountForm({ ...accountForm, max_delay_seconds: parseInt(e.target.value) || 45 })}
                      className="w-1/2 p-2 border border-slate-300 rounded text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Sending Window */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Khung giờ bắt đầu gửi</label>
                  <input
                    type="text"
                    value={accountForm.sending_window_start}
                    onChange={(e) => setAccountForm({ ...accountForm, sending_window_start: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Khung giờ kết thúc gửi</label>
                  <input
                    type="text"
                    value={accountForm.sending_window_end}
                    onChange={(e) => setAccountForm({ ...accountForm, sending_window_end: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition"
                >
                  {editingAccount ? 'Lưu Thay Đổi' : 'Tạo Cấu Hình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-lg">Nhật ký Hoạt động (Audit Logs)</h3>
            <span className="text-xs text-slate-500">Ghi nhận toàn bộ thao tác Start, Pause, Lỗi, và Trip Circuit Breaker</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Thời gian</th>
                  <th className="p-3">Tác tử (Actor)</th>
                  <th className="p-3">Hành động</th>
                  <th className="p-3">Chiến dịch ID</th>
                  <th className="p-3">Chi tiết (Metadata)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedAuditLogs.totalItems === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-xs text-slate-400">
                      Chưa có nhật ký hoạt động.
                    </td>
                  </tr>
                ) : (
                  paginatedAuditLogs.paginatedItems.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-[11px] text-slate-400">
                        {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="p-3 font-semibold text-slate-700">{log.actor}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{log.campaign_id || '-'}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-500 truncate max-w-sm">{log.metadata || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            totalItems={paginatedAuditLogs.totalItems}
            currentPage={paginatedAuditLogs.currentPage}
            pageSize={paginatedAuditLogs.pageSize}
            onPageChange={paginatedAuditLogs.setCurrentPage}
            onPageSizeChange={paginatedAuditLogs.setPageSize}
            darkMode={false}
          />
        </div>
      )}


      {/* MODAL: CREATE CAMPAIGN */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base">Soạn Chiến dịch Email Mới</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Tên chiến dịch</label>
                <input
                  type="text"
                  required
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Tiêu đề email (Subject)</label>
                <input
                  type="text"
                  required
                  value={newCampaign.subject}
                  onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-300 rounded text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Tên người gửi (From Name)</label>
                  <input
                    type="text"
                    required
                    value={newCampaign.from_name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, from_name: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Email người gửi (From Email)</label>
                  <input
                    type="email"
                    required
                    value={newCampaign.from_email}
                    onChange={(e) => setNewCampaign({ ...newCampaign, from_email: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Nút kêu gọi hành động (CTA Text)</label>
                  <input
                    type="text"
                    value={newCampaign.cta_text}
                    onChange={(e) => setNewCampaign({ ...newCampaign, cta_text: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Đường dẫn CTA (Tự động gắn UTM)</label>
                  <input
                    type="url"
                    value={newCampaign.cta_url}
                    onChange={(e) => setNewCampaign({ ...newCampaign, cta_url: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Nội dung HTML (Hỗ trợ thẻ cá nhân hóa: <code>&#123;&#123;name&#125;&#125;</code>, <code>&#123;&#123;email&#125;&#125;</code>)
                </label>
                <textarea
                  rows="6"
                  value={newCampaign.content_html}
                  onChange={(e) => setNewCampaign({ ...newCampaign, content_html: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-300 rounded text-xs font-mono"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold"
                >
                  Tạo Chiến Dịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT RECIPIENTS */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Nạp Danh bạ Người nhận (Contacts)</h3>
                <p className="text-xs text-slate-500">Định dạng mỗi dòng: <code>email,Họ và tên</code> hoặc chỉ <code>email</code></p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Dán danh sách email:</span>
              <button
                type="button"
                onClick={simulate5000Contacts}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Mô phỏng nạp 5.000 contacts
              </button>
            </div>

            <textarea
              rows="8"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="bacsi.nam@gmail.com,Bác sĩ Nam&#10;bacsi.huong@clinic.vn,Bác sĩ Hương"
              className="w-full p-3 border border-slate-300 rounded text-xs font-mono"
            ></textarea>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border rounded text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleImportRecipients}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold"
              >
                Xác nhận nạp vào Hàng đợi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW RECIPIENTS */}
      {showRecipientsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base">Danh sách người nhận (Chiến dịch #{selectedCampaignId})</h3>
              <button onClick={() => setShowRecipientsModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold sticky top-0">
                  <tr>
                    <th className="p-2.5">Email</th>
                    <th className="p-2.5">Họ tên</th>
                    <th className="p-2.5">Trạng thái</th>
                    <th className="p-2.5">Số lần gửi</th>
                    <th className="p-2.5">Thời gian gửi</th>
                    <th className="p-2.5">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRecipients.totalItems === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-6 text-slate-400">
                        Chưa có người nhận nào trong chiến dịch này.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecipients.paginatedItems.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2.5 font-semibold text-slate-800">{r.email}</td>
                        <td className="p-2.5 text-slate-600">{r.name || '-'}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'SENT' ? 'bg-green-100 text-green-700' :
                            r.status === 'BOUNCED' ? 'bg-red-100 text-red-700' :
                            r.status === 'SKIPPED' ? 'bg-amber-100 text-amber-700' :
                            r.status === 'RETRY' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-2.5 font-semibold">{r.attempt_count}</td>
                        <td className="p-2.5 text-slate-400 text-[11px]">
                          {r.sent_at ? new Date(r.sent_at).toLocaleString('vi-VN') : '-'}
                        </td>
                        <td className="p-2.5 text-slate-500 text-[10px] truncate max-w-xs">{r.error_message || r.provider_message_id || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              totalItems={paginatedRecipients.totalItems}
              currentPage={paginatedRecipients.currentPage}
              pageSize={paginatedRecipients.pageSize}
              onPageChange={paginatedRecipients.setCurrentPage}
              onPageSizeChange={paginatedRecipients.setPageSize}
              darkMode={false}
            />

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setShowRecipientsModal(false)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded text-xs font-semibold"
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
