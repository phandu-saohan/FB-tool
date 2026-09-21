import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Image as ImageIcon, 
  Eye, 
  Save, 
  Users, 
  Flag, 
  Loader2, 
  Upload, 
  CheckCircle2,
  Calendar,
  X
} from 'lucide-react';
import { 
  getGroups, 
  getPages, 
  createPost, 
  publishPost, 
  generateAIPost, 
  uploadImage 
} from '../api';

export default function CreatePostView({ setActiveTab }) {
  // Post Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [targetGroupIds, setTargetGroupIds] = useState([]);
  const [targetPageIds, setTargetPageIds] = useState([]);

  // AI Studio State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('Hội nghị phẫu thuật thẩm mỹ & Trẻ hóa công nghệ cao');
  const [aiAudience, setAiAudience] = useState('Bác sĩ phẫu thuật thẩm mỹ và chủ viện spa');
  const [aiTone, setAiTone] = useState('Chuyên nghiệp, uy tín');
  const [aiCta, setAiCta] = useState('Đăng ký tham gia ngay nhận ưu đãi VIP');
  const [aiLoading, setAiLoading] = useState(false);

  // Preview & UI state
  const [previewModal, setPreviewModal] = useState(false);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [availablePages, setAvailablePages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTargets();
  }, []);

  const loadTargets = async () => {
    try {
      const [groupsRes, pagesRes] = await Promise.all([getGroups(), getPages()]);
      const grps = groupsRes.data || [];
      const pgs = pagesRes.data || [];
      setAvailableGroups(grps);
      setAvailablePages(pgs);

      // Pre-select items that were already marked 'selected: true'
      setTargetGroupIds(grps.filter(g => g.selected).map(g => g.id));
      setTargetPageIds(pgs.filter(p => p.selected).map(p => p.id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingImage(true);
    try {
      const res = await uploadImage(formData);
      setImagePath(res.data.image_path);
      setImageUrl(res.data.url);
    } catch (err) {
      alert('Lỗi upload ảnh: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!aiTopic.trim()) {
      alert('Vui lòng nhập chủ đề bài viết.');
      return;
    }

    setAiLoading(true);
    try {
      const res = await generateAIPost({
        topic: aiTopic,
        audience: aiAudience,
        tone: aiTone,
        call_to_action: aiCta
      });

      setTitle(res.data.headline || aiTopic);
      setContent(res.data.full_text || res.data.content);
      setAiModalOpen(false);
    } catch (err) {
      alert('Lỗi tạo nội dung AI: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim() || !content.trim()) {
      alert('Vui lòng nhập Tiêu đề và Nội dung bài viết.');
      return;
    }

    setSubmitting(true);
    try {
      await createPost({
        title,
        content,
        image_path: imagePath || null,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        target_group_ids: targetGroupIds,
        target_page_ids: targetPageIds
      });

      alert('Đã lưu bài viết nháp thành công!');
      setActiveTab('posts');
    } catch (err) {
      alert('Lỗi lưu bài: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishNow = async () => {
    if (!title.trim() || !content.trim()) {
      alert('Vui lòng nhập Tiêu đề và Nội dung bài viết.');
      return;
    }

    if (targetGroupIds.length === 0 && targetPageIds.length === 0) {
      alert('Vui lòng chọn ít nhất một Group hoặc Page mục tiêu để đăng.');
      return;
    }

    if (!confirm(`Bạn có chắc muốn đưa bài viết này vào hàng đợi để đăng lên ${targetGroupIds.length + targetPageIds.length} mục tiêu?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const resPost = await createPost({
        title,
        content,
        image_path: imagePath || null,
        scheduled_at: null,
        target_group_ids: targetGroupIds,
        target_page_ids: targetPageIds
      });

      await publishPost(resPost.data.id);
      alert('Bài viết đã được đưa vào Hàng đợi đăng bài thành công!');
      setActiveTab('queue');
    } catch (err) {
      alert('Lỗi khởi tạo đăng bài: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTargetGroup = (id) => {
    setTargetGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleTargetPage = (id) => {
    setTargetPageIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Soạn thảo & Sáng tạo nội dung</h2>
          <p className="text-slate-400 text-sm mt-1">Viết bài thủ công hoặc sáng tạo nội dung tự động bằng AI Studio.</p>
        </div>

        <button
          onClick={() => setAiModalOpen(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-purple-500/20 transition"
        >
          <Sparkles className="w-4 h-4" />
          <span>Sáng tạo với AI Studio</span>
        </button>
      </div>

      {/* Main Grid: Left editor, Right targets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor Form */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Tiêu đề bài viết</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: [Hội Nghị 2026] Đột phá công nghệ thẩm mỹ..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Nội dung bài viết (Facebook Content)</label>
            <textarea
              rows="12"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung bài viết đầy đủ hoặc bấm 'Sáng tạo với AI Studio'..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
            />
          </div>

          {/* Image Attachment */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Đính kèm hình ảnh</label>
            {imageUrl ? (
              <div className="relative inline-block border border-slate-700 rounded-xl overflow-hidden group">
                <img src={imageUrl} alt="Upload preview" className="max-h-48 object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={() => { setImagePath(''); setImageUrl(''); }}
                  className="absolute top-2 right-2 bg-slate-900/80 hover:bg-red-600 text-white p-1 rounded-full shadow transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition">
                <Upload className="w-6 h-6 text-slate-500 mb-2" />
                <span className="text-xs text-slate-400 font-medium">Bấm để tải ảnh lên (PNG, JPG, WebP)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploadingImage}
                />
              </label>
            )}
            {uploadingImage && <p className="text-xs text-blue-400 mt-1">Đang tải ảnh lên...</p>}
          </div>

          {/* Buttons: Preview, Save Draft, Publish */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPreviewModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition"
            >
              <Eye className="w-4 h-4" />
              <span>Xem trước (Preview)</span>
            </button>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={submitting}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition"
              >
                <Save className="w-4 h-4" />
                <span>Lưu nháp</span>
              </button>

              <button
                type="button"
                onClick={handlePublishNow}
                disabled={submitting}
                className="inline-flex items-center space-x-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Đăng bài (Publish Queue)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Targets Selection */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Chọn Groups mục tiêu ({targetGroupIds.length})</h3>
              </div>
              <button 
                onClick={() => setTargetGroupIds(targetGroupIds.length === availableGroups.length ? [] : availableGroups.map(g => g.id))}
                className="text-xs text-blue-400 hover:underline"
              >
                {targetGroupIds.length === availableGroups.length ? 'Bỏ chọn' : 'Tất cả'}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {availableGroups.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">Chưa có nhóm nào trong DB.</p>
              ) : (
                availableGroups.map(grp => (
                  <label 
                    key={grp.id} 
                    className={`flex items-start space-x-2 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                      targetGroupIds.includes(grp.id) 
                        ? 'bg-blue-600/10 border-blue-500/40 text-white' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={targetGroupIds.includes(grp.id)}
                      onChange={() => toggleTargetGroup(grp.id)}
                      className="rounded bg-slate-800 border-slate-700 text-blue-600 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{grp.name}</div>
                      <div className="text-[11px] text-slate-400">{grp.members || 'N/A'} • {grp.privacy}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Flag className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Chọn Pages mục tiêu ({targetPageIds.length})</h3>
              </div>
              <button 
                onClick={() => setTargetPageIds(targetPageIds.length === availablePages.length ? [] : availablePages.map(p => p.id))}
                className="text-xs text-blue-400 hover:underline"
              >
                {targetPageIds.length === availablePages.length ? 'Bỏ chọn' : 'Tất cả'}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {availablePages.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">Chưa có trang nào trong DB.</p>
              ) : (
                availablePages.map(pg => (
                  <label 
                    key={pg.id} 
                    className={`flex items-start space-x-2 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                      targetPageIds.includes(pg.id) 
                        ? 'bg-emerald-600/10 border-emerald-500/40 text-white' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={targetPageIds.includes(pg.id)}
                      onChange={() => toggleTargetPage(pg.id)}
                      className="rounded bg-slate-800 border-slate-700 text-emerald-600 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{pg.name}</div>
                      <div className="text-[11px] text-slate-400">{pg.followers || 'N/A'} • {pg.category}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Generator Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-indigo-400">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">AI Content Studio</h3>
              </div>
              <button 
                onClick={() => setAiModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Chủ đề (Topic)</label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Đối tượng độc giả (Audience)</label>
                <input
                  type="text"
                  value={aiAudience}
                  onChange={(e) => setAiAudience(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Giọng văn (Tone)</label>
                  <input
                    type="text"
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Kêu gọi hành động (CTA)</label>
                  <input
                    type="text"
                    value={aiCta}
                    onChange={(e) => setAiCta(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 text-sm"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={aiLoading}
                className="inline-flex items-center space-x-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow transition"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Generate with AI</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">Xem trước hiển thị trên Facebook (Preview)</h3>
              <button onClick={() => setPreviewModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Facebook Post Mock Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">
                  FB
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Tài khoản của bạn</div>
                  <div className="text-xs text-slate-400">Vừa xong • 🌐 Công khai</div>
                </div>
              </div>

              <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {content || title || 'Chưa có nội dung bài viết.'}
              </div>

              {imageUrl && (
                <div className="rounded-lg overflow-hidden border border-slate-800">
                  <img src={imageUrl} alt="Post preview" className="w-full max-h-72 object-cover" />
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition"
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
