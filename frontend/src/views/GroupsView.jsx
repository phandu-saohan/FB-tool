import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ExternalLink, 
  Trash2, 
  CheckSquare, 
  Square, 
  Search, 
  RefreshCw,
  PenSquare,
  UserPlus,
  Loader2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { 
  getGroups, 
  updateGroup, 
  deleteGroup, 
  selectAllGroups, 
  syncJoinedGroups,
  joinGroup,
  bulkJoinGroups
} from '../api';
import Pagination, { usePagination } from '../components/Pagination';

export default function GroupsView({ setActiveTab }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const {
    currentPage,
    pageSize,
    totalItems,
    paginatedItems,
    setCurrentPage,
    setPageSize
  } = usePagination(groups, 15);
  
  // Actions loading
  const [syncingJoined, setSyncingJoined] = useState(false);
  const [joiningGroupId, setJoiningGroupId] = useState(null);
  const [bulkJoining, setBulkJoining] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');

  useEffect(() => {
    loadGroups();
  }, [keywordFilter, privacyFilter, statusFilter]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const res = await getGroups({
        keyword: keywordFilter || undefined,
        privacy: privacyFilter || undefined,
        status: statusFilter || undefined,
      });
      setGroups(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = async (group) => {
    try {
      const nextVal = !group.selected;
      await updateGroup(group.id, { selected: nextVal });
      setGroups(groups.map(g => g.id === group.id ? { ...g, selected: nextVal } : g));
    } catch (err) {
      alert('Lỗi cập nhật: ' + err.message);
    }
  };

  const handleSelectAll = async (selected) => {
    try {
      await selectAllGroups(selected);
      setGroups(groups.map(g => ({ ...g, selected })));
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa nhóm này khỏi danh sách?')) return;
    try {
      await deleteGroup(id);
      setGroups(groups.filter(g => g.id !== id));
    } catch (err) {
      alert('Lỗi xóa: ' + err.message);
    }
  };

  const handleSyncJoined = async () => {
    setSyncingJoined(true);
    setStatusNotice('Đang kết nối Facebook để đồng bộ danh sách nhóm đã tham gia...');
    try {
      const res = await syncJoinedGroups(200);
      setStatusNotice(res.data.message);
      await loadGroups();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      alert('Lỗi đồng bộ nhóm đã tham gia: ' + msg);
    } finally {
      setSyncingJoined(false);
    }
  };

  const handleJoinSingle = async (group) => {
    setJoiningGroupId(group.id);
    try {
      const res = await joinGroup(group.id);
      alert(res.data.message);
      await loadGroups();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      alert('Lỗi khi tham gia nhóm: ' + msg);
    } finally {
      setJoiningGroupId(null);
    }
  };

  const handleBulkJoin = async () => {
    const selectedActive = groups.filter(g => g.selected && g.status !== 'JOINED');
    if (selectedActive.length === 0) {
      alert('Vui lòng chọn ít nhất một nhóm chưa tham gia (ACTIVE hoặc PENDING).');
      return;
    }

    if (!confirm(`Bạn có chắc muốn tự động tham gia ${selectedActive.length} nhóm đã chọn? Hệ thống sẽ áp dụng giãn cách an toàn giữa mỗi nhóm.`)) {
      return;
    }

    setBulkJoining(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < selectedActive.length; i++) {
        const group = selectedActive[i];
        setJoiningGroupId(group.id);
        setStatusNotice(`[${i + 1}/${selectedActive.length}] Đang tham gia nhóm: "${group.name}"...`);

        try {
          const res = await joinGroup(group.id);
          if (res.data?.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
        }

        // Cập nhật lại danh sách ngay lập tức để người dùng thấy badge trạng thái thay đổi
        await loadGroups();

        // Nếu còn nhóm tiếp theo, đếm ngược thời gian chờ an toàn (15 - 30 giây)
        if (i < selectedActive.length - 1) {
          const waitSec = Math.floor(Math.random() * 15) + 15;
          for (let s = waitSec; s > 0; s--) {
            setStatusNotice(`Đã xử lý ${i + 1}/${selectedActive.length}. Giãn cách an toàn: ${s}s trước nhóm tiếp theo...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      alert(`Hoàn thành tham gia nhóm: ${successCount} thành công, ${failCount} thất bại/chờ duyệt.`);
      setStatusNotice(`Đã hoàn tất tham gia ${selectedActive.length} nhóm (${successCount} thành công, ${failCount} lỗi).`);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      alert('Lỗi tham gia nhóm hàng loạt: ' + msg);
    } finally {
      setJoiningGroupId(null);
      setBulkJoining(false);
      await loadGroups();
    }
  };

  const selectedCount = groups.filter(g => g.selected).length;
  const selectedUnjoinedCount = groups.filter(g => g.selected && g.status !== 'JOINED').length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'JOINED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            ĐÃ THAM GIA
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3 mr-1" />
            CHỜ DUYỆT
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            CHƯA THAM GIA
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Quản lý Facebook Groups</h2>
          <p className="text-slate-400 text-sm mt-1">Danh sách hội nhóm, đồng bộ nhóm đã tham gia và tự động tham gia nhóm mới.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Sync Joined Groups Button */}
          <button
            onClick={handleSyncJoined}
            disabled={syncingJoined}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 rounded-xl text-sm font-semibold border border-slate-700 shadow-sm transition"
          >
            {syncingJoined ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <RefreshCw className="w-4 h-4 text-emerald-400" />}
            <span>{syncingJoined ? 'Đang đồng bộ...' : 'Đồng bộ nhóm đã tham gia'}</span>
          </button>

          {/* Bulk Join Button */}
          {selectedUnjoinedCount > 0 && (
            <button
              onClick={handleBulkJoin}
              disabled={bulkJoining}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow transition"
            >
              {bulkJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>Tham gia {selectedUnjoinedCount} nhóm đã chọn</span>
            </button>
          )}

          {/* Post to selected groups */}
          <button
            onClick={() => setActiveTab('create-post')}
            disabled={selectedCount === 0}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow transition"
          >
            <PenSquare className="w-4 h-4" />
            <span>Đăng bài ({selectedCount} nhóm)</span>
          </button>
        </div>
      </div>

      {/* Notice Banner if any */}
      {statusNotice && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 flex items-center justify-between">
          <span>{statusNotice}</span>
          <button onClick={() => setStatusNotice('')} className="text-slate-400 hover:text-white text-xs ml-3 font-semibold">Đóng</button>
        </div>
      )}

      {/* Filter and Bulk Actions Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[320px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Lọc theo tên nhóm hoặc từ khóa..."
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="JOINED">Đã tham gia (JOINED)</option>
            <option value="PENDING">Đang chờ duyệt (PENDING)</option>
            <option value="ACTIVE">Chưa tham gia (ACTIVE)</option>
          </select>

          <select
            value={privacyFilter}
            onChange={(e) => setPrivacyFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="">Tất cả quyền riêng tư</option>
            <option value="Public">Công khai (Public)</option>
            <option value="Private">Riêng tư (Private)</option>
          </select>

          <button
            onClick={loadGroups}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Tải lại"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleSelectAll(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition"
          >
            <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
            <span>Chọn tất cả</span>
          </button>
          <button
            onClick={() => handleSelectAll(false)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Bỏ chọn tất cả</span>
          </button>
          <span className="text-xs text-slate-400">
            Đã chọn: <b className="text-white">{selectedCount}</b> / {groups.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4 w-12 text-center">Chọn</th>
                <th className="p-4">Tên nhóm</th>
                <th className="p-4">Thành viên</th>
                <th className="p-4">Quyền riêng tư</th>
                <th className="p-4">Từ khóa</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {groups.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500">
                    {loading ? 'Đang tải danh sách nhóm...' : 'Chưa có nhóm nào. Bấm "Đồng bộ nhóm đã tham gia" hoặc vào mục "Tìm kiếm".'}
                  </td>
                </tr>
              ) : (
                paginatedItems.map((grp) => (
                  <tr key={grp.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={grp.selected}
                        onChange={() => handleToggleSelect(grp)}
                        className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="p-4 font-semibold text-white max-w-sm truncate" title={grp.name}>
                      {grp.name}
                    </td>
                    <td className="p-4 text-slate-400">{grp.members || 'N/A'}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        grp.privacy === 'Public' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {grp.privacy || 'Public'}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-blue-400">{grp.keyword || '—'}</td>
                    <td className="p-4">
                      {getStatusBadge(grp.status)}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {grp.status !== 'JOINED' && (
                        <button
                          onClick={() => handleJoinSingle(grp)}
                          disabled={joiningGroupId === grp.id}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded text-xs font-semibold border border-emerald-500/30 transition disabled:opacity-50"
                        >
                          {joiningGroupId === grp.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <UserPlus className="w-3 h-3" />
                          )}
                          <span>Tham gia</span>
                        </button>
                      )}
                      <a
                        href={grp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        <span>Mở FB</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => handleDelete(grp.id)}
                        className="text-slate-500 hover:text-rose-400 transition"
                        title="Xóa nhóm"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <Pagination
          totalItems={totalItems}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          darkMode={true}
        />
      </div>
    </div>
  );
}
