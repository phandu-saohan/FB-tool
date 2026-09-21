import React, { useState, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Heading1, 
  Heading2, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Link, 
  Minus, 
  Quote, 
  Sparkles, 
  Eye, 
  Smartphone, 
  Monitor, 
  Edit3, 
  Tag, 
  FileText, 
  Check, 
  Palette,
  Phone,
  MessageSquare
} from 'lucide-react';

const EMAIL_TEMPLATES = [
  {
    id: 'conference_invitation',
    name: 'Thư Mời Hội Nghị Thẩm Mỹ & Y Khoa',
    category: 'Sự kiện / Hội nghị',
    subject: 'Trân trọng kính mời {{name}} tham dự Hội nghị Khoa học Thẩm mỹ Quốc tế 2026',
    preview_text: 'Thư mời độc quyền dành riêng cho {{name}} — Cập nhật xu hướng công nghệ thẩm mỹ mới nhất.',
    cta_text: 'Đăng ký vị trí VIP ngay',
    cta_url: 'https://aesthetichub.vn/hoi-nghi-2026',
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 32px 24px; text-align: center; color: #ffffff;">
    <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">HỘI NGHỊ KHOA HỌC THẨM MỸ QUỐC TẾ 2026</h1>
    <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Aesthetic Conference Intelligence & Clinical Innovation</p>
  </div>
  
  <div style="padding: 28px 24px;">
    <p style="font-size: 16px; margin-top: 0;">Kính gửi <strong>{{name}}</strong>,</p>
    
    <p>Ban Tổ Chức trân trọng kính mời Quý Bác sĩ / Quý Chuyên gia tham dự phiên toàn thể của <strong>Hội nghị Thẩm mỹ Quốc tế 2026</strong> với sự tham gia của hơn 50 chuyên gia đầu ngành trong và ngoài nước.</p>
    
    <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 6px; font-size: 14px; font-weight: bold; color: #1e40af;">📍 THÔNG TIN HỘI NGHỊ:</p>
      <p style="margin: 0; font-size: 13px; color: #475569;">• <strong>Thời gian:</strong> 08:30 - 17:30, Ngày 15 tháng 10 năm 2026</p>
      <p style="margin: 4px 0 0; font-size: 13px; color: #475569;">• <strong>Địa điểm:</strong> Trung tâm Hội nghị Quốc gia, Hà Nội</p>
      <p style="margin: 4px 0 0; font-size: 13px; color: #475569;">• <strong>Số điện thoại đăng ký:</strong> {{phone}}</p>
    </div>

    <p>Chúng tôi đã dành riêng một suất tham dự VIP với đầy đủ tài liệu chuyên khảo cho <strong>{{name}}</strong>.</p>
    
    <div style="text-align: center; margin: 30px 0 20px;">
      <a href="https://aesthetichub.vn/hoi-nghi-2026" style="background-color: #1e40af; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Xác Nhận Tham Dự Ngay</a>
    </div>

    <p style="font-size: 13px; color: #64748b; text-align: center; margin-bottom: 0;">Hoặc liên hệ hỗ trợ nhanh qua số điện thoại / Zalo OA của chúng tôi.</p>
  </div>
  
  <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0;">© 2026 Aesthetic Conference Intelligence. Mọi quyền được bảo lưu.</p>
    <p style="margin: 4px 0 0;">Email gửi tự động tới {{email}}.</p>
  </div>
</div>`
  },
  {
    id: 'zalo_oa_connect',
    name: 'Mời Kết Nối Zalo OA & Chăm Sóc Khách Hàng',
    category: 'Zalo OA Outreach',
    subject: 'Kết nối Zalo OA nhận thông tin tư vấn đặc quyền dành cho {{name}}',
    preview_text: 'Kênh Zalo Official Account chính thức hỗ trợ {{name}} 24/7.',
    cta_text: 'Kết nối Zalo OA ngay',
    cta_url: 'https://zalo.me/your_oa_id',
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background: linear-gradient(135deg, #0068FF, #0052cc); padding: 28px 24px; text-align: center; color: #ffffff;">
    <h2 style="margin: 0; font-size: 22px; font-weight: bold;">KẾT NỐI ZALO OFFICIAL ACCOUNT</h2>
    <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Nhận thông báo ưu đãi và tài liệu mới nhất trực tiếp trên Zalo</p>
  </div>
  
  <div style="padding: 28px 24px;">
    <p style="font-size: 15px; margin-top: 0;">Chào <strong>{{name}}</strong>,</p>
    
    <p>Để hỗ trợ phản hồi nhanh chóng và gửi các thông báo quan trọng nhất tới số điện thoại <strong>{{phone}}</strong> của bạn, chúng tôi trân trọng mời bạn quan tâm kênh <strong>Zalo Official Account</strong> của chúng tôi.</p>
    
    <div style="background-color: #eff6ff; border: 1px dashed #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-weight: bold; color: #1d4ed8; font-size: 14px;">🎁 ĐẶC QUYỀN KHI KẾT NỐI ZALO OA:</p>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #334155;">
        <li>Nhận tài liệu độc quyền qua tin nhắn ZNS hoàn toàn miễn phí.</li>
        <li>Hỗ trợ trực tiếp 1:1 từ đội ngũ chuyên gia trong vòng 5 phút.</li>
        <li>Nhận vé mời ưu tiên các sự kiện và khóa đào tạo sắp tới.</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 28px 0 20px;">
      <a href="https://zalo.me/your_oa_id" style="background-color: #0068FF; color: #ffffff; padding: 13px 30px; text-decoration: none; border-radius: 24px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(0, 104, 255, 0.25);">Bấm Quan Tâm Zalo OA</a>
    </div>

    <p style="font-size: 13px; color: #64748b; text-align: center;">Số điện thoại đồng bộ hệ thống: <strong>{{phone}}</strong></p>
  </div>
  
  <div style="background-color: #f8fafc; padding: 14px 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
    <p style="margin: 0;">Email này được gửi đến {{email}}</p>
  </div>
</div>`
  },
  {
    id: 'b2b_proposal',
    name: 'Thư Giới Thiệu Giải Pháp B2B Chuyên Nghiệp',
    category: 'Kinh doanh & Bán hàng',
    subject: 'Giải pháp nâng cao hiệu quả vận hành dành cho {{name}}',
    preview_text: 'Đề xuất hợp tác chiến lược tối ưu chi phí và tăng trưởng.',
    cta_text: 'Xem chi tiết giải pháp',
    cta_url: 'https://yourcompany.com/solutions',
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background: #0f172a; padding: 28px 24px; color: #ffffff;">
    <h2 style="margin: 0; font-size: 20px; font-weight: bold;">ĐỀ XUẤT GIẢI PHÁP TĂNG TRƯỞNG 2026</h2>
    <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">Dành cho đối tác chiến lược</p>
  </div>
  
  <div style="padding: 24px;">
    <p style="font-size: 15px; margin-top: 0;">Kính gửi <strong>{{name}}</strong>,</p>
    
    <p>Chúng tôi nhận thấy đơn vị của Quý đối tác đang tìm kiếm các giải pháp tự động hóa để tối ưu hóa chi phí vận hành và tăng cường tương tác khách hàng đa kênh (Email & Zalo OA).</p>
    
    <p>Hệ sinh thái công nghệ của chúng tôi có thể giúp <strong>{{name}}</strong>:</p>
    <ul style="color: #334155; font-size: 14px;">
      <li>Tiết kiệm hơn <strong>70% thời gian</strong> quản trị và gửi tin đa kênh.</li>
      <li>Tỷ lệ gửi thành công vào Inbox đạt <strong>trên 98%</strong> với chuẩn xác thực SPF/DKIM.</li>
      <li>Kết nối liền mạch với Zalo OA để gửi tin chăm sóc tự động.</li>
    </ul>

    <div style="text-align: center; margin: 26px 0;">
      <a href="https://yourcompany.com/solutions" style="background-color: #2563eb; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Nhận Bản Giới Thiệu Đầy Đủ</a>
    </div>

    <p style="font-size: 14px;">Rất mong có cơ hội trao đổi trực tiếp với {{name}} qua số điện thoại <strong>{{phone}}</strong> hoặc email này.</p>
    
    <p style="margin-bottom: 0; font-size: 14px;">Trân trọng,<br><strong>Đội ngũ Chuyên viên Tư vấn</strong></p>
  </div>
</div>`
  }
];

export default function EmailRichEditor({ 
  contentHtml, 
  onChangeHtml, 
  subject, 
  onChangeSubject,
  previewText,
  onChangePreviewText
}) {
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'preview-desktop', 'preview-mobile'
  const [mockData, setMockData] = useState(true);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const editorRef = useRef(null);

  // Sample data for live preview
  const SAMPLE_DATA = {
    name: 'Bác sĩ Nguyễn Văn An',
    email: 'nguyenvanan@clinic.vn',
    phone: '0912 345 678',
    campaign: 'Hội nghị Thẩm mỹ Quốc tế 2026'
  };

  const executeCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChangeHtml(editorRef.current.innerHTML);
    }
  };

  const insertVariable = (varName) => {
    const tag = `{{${varName}}}`;
    // Insert text at cursor position or append
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(tag));
      range.collapse(false);
    } else {
      executeCommand('insertText', tag);
    }
    if (editorRef.current) {
      onChangeHtml(editorRef.current.innerHTML);
    }
  };

  const applyTemplate = (tpl) => {
    if (onChangeSubject && tpl.subject) {
      onChangeSubject(tpl.subject);
    }
    if (onChangePreviewText && tpl.preview_text) {
      onChangePreviewText(tpl.preview_text);
    }
    onChangeHtml(tpl.html);
    if (editorRef.current) {
      editorRef.current.innerHTML = tpl.html;
    }
    setShowTemplateMenu(false);
  };

  const getRenderedHtml = () => {
    let html = contentHtml || '';
    if (mockData) {
      html = html.replace(/\{\{\s*name\s*\}\}/g, `<span style="background-color: #fef08a; padding: 1px 4px; border-radius: 3px; font-weight: bold; color: #854d0e;">${SAMPLE_DATA.name}</span>`);
      html = html.replace(/\{\{\s*email\s*\}\}/g, `<span style="background-color: #e0e7ff; padding: 1px 4px; border-radius: 3px; color: #3730a3;">${SAMPLE_DATA.email}</span>`);
      html = html.replace(/\{\{\s*phone\s*\}\}/g, `<span style="background-color: #dcfce7; padding: 1px 4px; border-radius: 3px; font-weight: bold; color: #166534;">${SAMPLE_DATA.phone}</span>`);
      html = html.replace(/\{\{\s*campaign\s*\}\}/g, SAMPLE_DATA.campaign);
    }
    return html;
  };

  const getRenderedSubject = () => {
    let sub = subject || '';
    if (mockData) {
      sub = sub.replace(/\{\{\s*name\s*\}\}/g, SAMPLE_DATA.name);
      sub = sub.replace(/\{\{\s*phone\s*\}\}/g, SAMPLE_DATA.phone);
      sub = sub.replace(/\{\{\s*email\s*\}\}/g, SAMPLE_DATA.email);
    }
    return sub;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Top Header Toolbar */}
      <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* Left: View Tabs */}
        <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'editor' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Soạn thảo Rich Text</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview-desktop')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'preview-desktop' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Xem trước Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview-mobile')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'preview-mobile' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Xem trước Mobile</span>
          </button>
        </div>

        {/* Right: Template Selector & Mock Data Toggle */}
        <div className="flex items-center space-x-2.5">
          {activeTab !== 'editor' && (
            <label className="inline-flex items-center space-x-1.5 text-xs text-slate-600 font-medium cursor-pointer">
              <input 
                type="checkbox"
                checked={mockData}
                onChange={(e) => setMockData(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Điền dữ liệu mẫu</span>
            </label>
          )}

          {/* Template Menu Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Kho Mẫu Email Có Sẵn ({EMAIL_TEMPLATES.length})</span>
            </button>

            {showTemplateMenu && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl z-30 p-2 space-y-1 animate-in fade-in duration-150">
                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Chọn mẫu email chuyên nghiệp
                </div>
                {EMAIL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 transition flex flex-col space-y-0.5 group"
                  >
                    <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600">{tpl.name}</span>
                    <span className="text-[11px] text-slate-400">{tpl.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor Mode */}
      {activeTab === 'editor' && (
        <>
          {/* Variable Chips Bar */}
          <div className="px-4 py-2 bg-blue-50/40 border-b border-slate-100 flex items-center space-x-2 overflow-x-auto text-xs">
            <span className="text-slate-500 font-medium flex items-center space-x-1 shrink-0">
              <Tag className="w-3 h-3 text-blue-500" />
              <span>Chèn biến cá nhân hoá:</span>
            </span>
            <button
              type="button"
              onClick={() => insertVariable('name')}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 font-mono font-semibold rounded-lg border border-blue-200 shadow-2xs transition"
              title="Chèn tên khách hàng"
            >
              <span>{"{{name}}"}</span>
              <span className="text-[10px] text-slate-400 font-sans">(Tên)</span>
            </button>
            <button
              type="button"
              onClick={() => insertVariable('phone')}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 font-mono font-semibold rounded-lg border border-emerald-200 shadow-2xs transition"
              title="Chèn số điện thoại khách hàng (dành cho Zalo OA)"
            >
              <Phone className="w-3 h-3 text-emerald-600" />
              <span>{"{{phone}}"}</span>
              <span className="text-[10px] text-emerald-500 font-sans font-medium">(Zalo SĐT)</span>
            </button>
            <button
              type="button"
              onClick={() => insertVariable('email')}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-700 font-mono font-semibold rounded-lg border border-amber-200 shadow-2xs transition"
              title="Chèn email người nhận"
            >
              <span>{"{{email}}"}</span>
              <span className="text-[10px] text-slate-400 font-sans">(Email)</span>
            </button>
            <button
              type="button"
              onClick={() => insertVariable('campaign')}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-mono font-semibold rounded-lg border border-slate-200 shadow-2xs transition"
              title="Chèn tên chiến dịch"
            >
              <span>{"{{campaign}}"}</span>
              <span className="text-[10px] text-slate-400 font-sans">(Chiến dịch)</span>
            </button>
          </div>

          {/* Formatting Controls Bar */}
          <div className="px-4 py-2 border-b border-slate-200 flex flex-wrap items-center gap-1 text-slate-600 bg-white">
            <button
              type="button"
              onClick={() => executeCommand('bold')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="In đậm (Bold)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('italic')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="In nghiêng (Italic)"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('underline')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="Gạch chân (Underline)"
            >
              <Underline className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <button
              type="button"
              onClick={() => executeCommand('formatBlock', '<h1>')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="Tiêu đề 1 (Heading 1)"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('formatBlock', '<h2>')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="Tiêu đề 2 (Heading 2)"
            >
              <Heading2 className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <button
              type="button"
              onClick={() => executeCommand('insertUnorderedList')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="Danh sách gạch đầu dòng"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('insertOrderedList')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="Danh sách đánh số"
            >
              <ListOrdered className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <button
              type="button"
              onClick={() => executeCommand('justifyLeft')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="Căn trái"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('justifyCenter')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="Căn giữa"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('justifyRight')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="Căn phải"
            >
              <AlignRight className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <button
              type="button"
              onClick={() => {
                const url = prompt('Nhập đường dẫn liên kết (URL):', 'https://');
                if (url) executeCommand('createLink', url);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="Chèn liên kết (Link)"
            >
              <Link className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('insertHorizontalRule')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="Kẻ đường phân cách ngang"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('formatBlock', '<blockquote>')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
              title="Đoạn trích dẫn (Quote)"
            >
              <Quote className="w-4 h-4" />
            </button>
          </div>

          {/* Editable WYSIWYG Content Area */}
          <div
            ref={editorRef}
            contentEditable
            onInput={(e) => onChangeHtml(e.currentTarget.innerHTML)}
            dangerouslySetInnerHTML={{ __html: contentHtml || '' }}
            className="p-6 min-h-[360px] max-h-[550px] overflow-y-auto outline-hidden text-sm leading-relaxed prose max-w-none focus:bg-slate-50/20 transition"
            placeholder="Bắt đầu soạn thảo nội dung email chuyên nghiệp của bạn ở đây..."
          />
        </>
      )}

      {/* Desktop Preview Mode */}
      {activeTab === 'preview-desktop' && (
        <div className="p-8 bg-slate-100/70 overflow-y-auto flex flex-col items-center">
          {/* Simulated Email Client Window */}
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Email Header Info */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">{getRenderedSubject()}</span>
                <span className="text-slate-400">10:30 AM</span>
              </div>
              <div className="text-slate-600">
                <span className="font-semibold">Người nhận:</span> {mockData ? `${SAMPLE_DATA.name} <${SAMPLE_DATA.email}>` : '{{name}} <{{email}}>'}
              </div>
              {mockData && (
                <div className="text-emerald-700 font-medium flex items-center space-x-1">
                  <Phone className="w-3 h-3" />
                  <span>Số điện thoại (Zalo OA): {SAMPLE_DATA.phone}</span>
                </div>
              )}
            </div>

            {/* Email Body */}
            <div className="p-6 overflow-x-auto">
              <div dangerouslySetInnerHTML={{ __html: getRenderedHtml() }} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Preview Mode (iPhone frame) */}
      {activeTab === 'preview-mobile' && (
        <div className="p-8 bg-slate-100/70 overflow-y-auto flex flex-col items-center justify-center">
          {/* Simulated Mobile Device Frame */}
          <div className="w-[375px] bg-slate-900 rounded-[44px] p-3 shadow-2xl border-4 border-slate-800">
            {/* Notch */}
            <div className="w-32 h-5 bg-slate-900 rounded-b-xl mx-auto mb-2 flex items-center justify-center">
              <div className="w-12 h-1 bg-slate-700 rounded-full" />
            </div>

            {/* Screen */}
            <div className="bg-white rounded-[32px] overflow-hidden min-h-[550px] max-h-[600px] overflow-y-auto flex flex-col">
              {/* Mobile Email Header */}
              <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs">
                <div className="font-bold text-slate-900 text-xs line-clamp-1">{getRenderedSubject()}</div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  Tới: {mockData ? SAMPLE_DATA.name : '{{name}}'}
                </div>
              </div>

              {/* Mobile Body */}
              <div className="p-3 text-xs overflow-x-auto">
                <div dangerouslySetInnerHTML={{ __html: getRenderedHtml() }} />
              </div>
            </div>

            {/* Home Indicator */}
            <div className="w-28 h-1 bg-slate-600 rounded-full mx-auto mt-3 mb-1" />
          </div>
        </div>
      )}
    </div>
  );
}
