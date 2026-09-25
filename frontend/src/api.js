import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5 minutes default
});

export const getBrowserStatus = () => api.get('/browser/status');
export const startBrowser = () => api.post('/browser/start');
export const stopBrowser = () => api.post('/browser/stop');
export const openManualLogin = () => api.post('/browser/open-login');
export const checkLoginStatus = () => api.get('/browser/login-check');
export const importCookies = (cookie_data) => api.post('/browser/import-cookies', { cookie_data });


export const getGroups = (params) => api.get('/groups', { params });
export const searchGroups = (keyword, max_results = 50) => api.post('/groups/search', { keyword, max_results }, { timeout: 300000 });
export const syncJoinedGroups = (max_results = 200) => api.post(`/groups/sync-joined?max_results=${max_results}`, null, { timeout: 600000 });
export const joinGroup = (id) => api.post(`/groups/${id}/join`, null, { timeout: 120000 });
export const bulkJoinGroups = (ids) => api.post('/groups/bulk-join', ids, { timeout: 3600000 });
export const updateGroup = (id, data) => api.put(`/groups/${id}`, data);
export const deleteGroup = (id) => api.delete(`/groups/${id}`);
export const selectAllGroups = (selected) => api.post(`/groups/select-all?selected=${selected}`);
export const bulkSelectGroups = (ids, selected) => api.post(`/groups/bulk-select?selected=${selected}`, ids);

export const getPages = (params) => api.get('/pages', { params });
export const createPage = (data) => api.post('/pages', data);
export const batchCreatePages = (data) => api.post('/pages/batch', data);
export const syncManagedPages = (max_results = 100) => api.post(`/pages/sync-managed?max_results=${max_results}`, null, { timeout: 300000 });
export const searchPages = (keyword, max_results = 50) => api.post('/pages/search', { keyword, max_results }, { timeout: 300000 });
export const updatePage = (id, data) => api.put(`/pages/${id}`, data);
export const deletePage = (id) => api.delete(`/pages/${id}`);
export const selectAllPages = (selected) => api.post(`/pages/select-all?selected=${selected}`);
export const bulkSelectPages = (ids, selected) => api.post(`/pages/bulk-select?selected=${selected}`, ids);

export const getPosts = () => api.get('/posts');
export const getPost = (id) => api.get(`/posts/${id}`);
export const createPost = (data) => api.post('/posts', data);
export const deletePost = (id) => api.delete(`/posts/${id}`);
export const publishPost = (id) => api.post(`/posts/${id}/publish`);
export const generateAIPost = (data) => api.post('/posts/ai-generate', data);
export const uploadImage = (formData) => api.post('/posts/upload-image', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

export const getQueueStatus = () => api.get('/automation/status');
export const pauseQueue = () => api.post('/automation/pause');
export const resumeQueue = () => api.post('/automation/resume');
export const cancelQueue = () => api.post('/automation/cancel');

export const getLogs = (limit = 100) => api.get('/logs', { params: { limit } });
export const getSettings = () => api.get('/settings');
export const updateSettings = (data) => api.post('/settings', data);

// ---------------------------------------------------------------------------
// Comment Assistant API Methods
// ---------------------------------------------------------------------------
export const getCommentDashboard = () => api.get('/comments/dashboard');
export const getMonitoringRules = () => api.get('/comments/monitoring-rules');
export const createMonitoringRule = (data) => api.post('/comments/monitoring-rules', data);
export const updateMonitoringRule = (id, data) => api.put(`/comments/monitoring-rules/${id}`, data);
export const deleteMonitoringRule = (id) => api.delete(`/comments/monitoring-rules/${id}`);
export const triggerPostDiscovery = (params) => api.post('/comments/discover', null, { params });
export const getDiscoveredPosts = (params) => api.get('/comments/discovered-posts', { params });
export const getCommentSuggestions = (filter_type = 'all') => api.get(`/comments/suggestions?filter_type=${filter_type}`);
export const approveSuggestion = (id, data = {}) => api.post(`/comments/suggestions/${id}/approve`, data);
export const rejectSuggestion = (id, data = {}) => api.post(`/comments/suggestions/${id}/reject`, data);
export const editSuggestion = (id, data) => api.put(`/comments/suggestions/${id}/edit`, data);
export const bulkActionSuggestions = (data) => api.post('/comments/suggestions/bulk', data);
export const scheduleComment = (data) => api.post('/comments/schedule', data);
export const getScheduledComments = () => api.get('/comments/schedules');
export const publishCommentNow = (id) => api.post(`/comments/publish-now/${id}`);
export const emergencyStopComments = () => api.post('/comments/emergency-stop');
export const getCommentCampaigns = () => api.get('/comments/campaigns');
export const createCommentCampaign = (data) => api.post('/comments/campaigns', data);
export const getCommentAnalytics = () => api.get('/comments/analytics');
export const getCommentLogs = (limit = 50) => api.get('/comments/logs', { params: { limit } });
export const getCommentSettings = () => api.get('/comments/settings');
export const updateCommentSettings = (data) => api.put('/comments/settings', data);
export const createCustomComment = (data) => api.post('/comments/custom', data);
export const generateCustomCommentAI = (data) => api.post('/comments/generate-custom', data);


// ---------------------------------------------------------------------------
// Email Campaign Queue & Reliable Sending API Methods
// ---------------------------------------------------------------------------
export const getEmailDashboard = () => api.get('/email/dashboard');
export const getEmailCampaigns = () => api.get('/email/campaigns');
export const getEmailCampaign = (id) => api.get(`/email/campaigns/${id}`);
export const createEmailCampaign = (data) => api.post('/email/campaigns', data);
export const updateEmailCampaign = (id, data) => api.put(`/email/campaigns/${id}`, data);
export const deleteEmailCampaign = (id) => api.delete(`/email/campaigns/${id}`);
export const importCampaignRecipients = (id, data) => api.post(`/email/campaigns/${id}/recipients`, data);
export const downloadEmailExcelTemplate = () => api.get('/email/template-excel', { responseType: 'blob' });
export const uploadCampaignExcel = (id, formData) => api.post(`/email/campaigns/${id}/upload-excel`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 300000
});
export const exportCampaignZaloOA = (id) => api.get(`/email/campaigns/${id}/export-zalo-oa`, { responseType: 'blob' });
export const getCampaignRecipients = (id, params) => api.get(`/email/campaigns/${id}/recipients`, { params });

export const startEmailCampaign = (id) => api.post(`/email/campaigns/${id}/start`);
export const pauseEmailCampaign = (id) => api.post(`/email/campaigns/${id}/pause`);
export const resumeEmailCampaign = (id) => api.post(`/email/campaigns/${id}/resume`);
export const stopEmailCampaign = (id) => api.post(`/email/campaigns/${id}/stop`);
export const emergencyStopAllEmail = () => api.post('/email/emergency-stop');
export const getEmailQueue = (params) => api.get('/email/queue', { params });
export const retryFailedEmailJobs = (params) => api.post('/email/queue/retry-failed', null, { params });
export const processEmailBatchNow = (params) => api.post('/email/process-batch', null, { params });
export const getEmailSuppressions = () => api.get('/email/suppression');
export const addEmailSuppression = (data) => api.post('/email/suppression', data);
export const deleteEmailSuppression = (id) => api.delete(`/email/suppression/${id}`);
export const getEmailSettings = () => api.get('/email/settings');
export const updateEmailSettings = (data) => api.put('/email/settings', data);
export const testEmailSmtpConnection = () => api.post('/email/settings/test-connection');
export const resetEmailCircuitBreaker = () => api.post('/email/circuit-breaker/reset');
export const getEmailAuditLogs = (limit = 50) => api.get('/email/logs', { params: { limit } });

// Multi-Account Sender Configurations
export const getEmailAccounts = () => api.get('/email/accounts');
export const createEmailAccount = (data) => api.post('/email/accounts', data);
export const getEmailAccount = (id) => api.get(`/email/accounts/${id}`);
export const updateEmailAccount = (id, data) => api.put(`/email/accounts/${id}`, data);
export const deleteEmailAccount = (id) => api.delete(`/email/accounts/${id}`);
export const toggleEmailAccountActive = (id) => api.post(`/email/accounts/${id}/toggle-active`);
export const testEmailAccountConnection = (id) => api.post(`/email/accounts/${id}/test-connection`);
export const testDraftEmailAccountConnection = (data) => api.post('/email/accounts/test-draft', data);
export const resetEmailAccountCircuitBreaker = (id) => api.post(`/email/accounts/${id}/reset-circuit-breaker`);
export const resetEmailAccountCooldown = (id) => api.post(`/email/accounts/${id}/reset-cooldown`);

// AI Content Studio & Telegram Bot Alerts
export const generateAIEmail = (data) => api.post('/email/ai/generate', data);
export const testTelegramBot = (data) => api.post('/email/telegram/test', data);
export const updateTelegramSettings = (data) => api.put('/email/telegram/settings', data);

// ---------------------------------------------------------------------------
// Zalo Marketing Suite API Methods
// ---------------------------------------------------------------------------
export const getZaloDashboard = () => api.get('/zalo/dashboard');
export const getZaloGroups = (params) => api.get('/zalo/groups', { params });
export const createZaloGroup = (data) => api.post('/zalo/groups', data);
export const batchImportZaloGroups = (data) => api.post('/zalo/groups/batch-import', data);
export const searchZaloGroups = (data) => api.post('/zalo/groups/search', data);
export const deleteZaloGroup = (id) => api.delete(`/zalo/groups/${id}`);

export const getZaloPosts = () => api.get('/zalo/posts');
export const getZaloPost = (id) => api.get(`/zalo/posts/${id}`);
export const createZaloPost = (data) => api.post('/zalo/posts', data);
export const publishZaloPostNow = (id) => api.post(`/zalo/posts/${id}/publish-now`);
export const scheduleZaloPost = (id, data) => api.post(`/zalo/posts/${id}/schedule`, data);
export const pauseZaloCampaign = (id) => api.post(`/zalo/posts/${id}/pause`);
export const cancelZaloCampaign = (id) => api.post(`/zalo/posts/${id}/cancel`);

export const generateZaloAIPost = (data) => api.post('/zalo/ai/generate', data);
export const getZaloSettings = () => api.get('/zalo/settings');
export const updateZaloSettings = (data) => api.put('/zalo/settings', data);
export const testZaloBotToken = (bot_token) => api.post('/zalo/bot/test', { bot_token });
export const setZaloBotWebhook = (webhook_url) => api.post('/zalo/bot/set-webhook', { webhook_url });

// ---------------------------------------------------------------------------
// Omnichannel Chat API Methods (FB Page, FB Personal, Zalo, WhatsApp)
// ---------------------------------------------------------------------------
export const getChatStats = () => api.get('/chat/stats');
export const getChatChannels = () => api.get('/chat/channels');
export const createChatChannel = (data) => api.post('/chat/channels', data);
export const updateChatChannel = (id, data) => api.put(`/chat/channels/${id}`, data);
export const deleteChatChannel = (id) => api.delete(`/chat/channels/${id}`);

export const getChatConversations = (params) => api.get('/chat/conversations', { params });
export const getChatConversationDetail = (id) => api.get(`/chat/conversations/${id}`);
export const updateChatConversation = (id, data) => api.patch(`/chat/conversations/${id}`, data);
export const markChatConversationRead = (id) => api.post(`/chat/conversations/${id}/mark-read`);

export const sendChatMessage = (conversationId, data) => api.post(`/chat/conversations/${conversationId}/messages`, data);
export const getChatAISuggestions = (conversationId, data) => api.post(`/chat/conversations/${conversationId}/ai-suggest`, data);
export const updateChatContact = (id, data) => api.patch(`/chat/contacts/${id}`, data);

export const getChatQuickReplies = (channelType) => api.get('/chat/quick-replies', { params: { channel_type: channelType } });
export const createChatQuickReply = (data) => api.post('/chat/quick-replies', data);
export const deleteChatQuickReply = (id) => api.delete(`/chat/quick-replies/${id}`);

export const simulateIncomingChatMessage = (data) => api.post('/chat/simulate-incoming', data);
export const getChatSettings = () => api.get('/chat/settings');
export const updateChatSettings = (data) => api.put('/chat/settings', data);

// Facebook Personal Synchronization
export const getFBPersonalStatus = () => api.get('/chat/channels/fb-personal/status');
export const syncFBPersonalMessages = () => api.post('/chat/channels/fb-personal/sync');
export const syncChatConversation = (id) => api.post(`/chat/conversations/${id}/sync`);
export const importFBPersonalCookies = (cookies) => api.post('/chat/channels/fb-personal/cookies', { cookies });

export default api;



