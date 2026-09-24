import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

import DashboardView from './views/DashboardView';
import SearchView from './views/SearchView';
import GroupsView from './views/GroupsView';
import PagesView from './views/PagesView';
import CreatePostView from './views/CreatePostView';
import PostsView from './views/PostsView';
import QueueView from './views/QueueView';
import LogsView from './views/LogsView';
import SettingsView from './views/SettingsView';
import CommentsView from './views/CommentsView';
import EmailView from './views/EmailView';
import ZaloView from './views/ZaloView';
import ChatView from './views/ChatView';

import { getBrowserStatus } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [browserStatus, setBrowserStatus] = useState({
    is_running: false,
    profile_path: '',
    is_logged_in: false,
    login_status: 'STOPPED',
    checkpoint_detected: false,
    checkpoint_reason: null
  });

  const refreshBrowserStatus = async () => {
    try {
      const res = await getBrowserStatus();
      setBrowserStatus(res.data);
    } catch (err) {
      console.error('Failed to get browser status:', err);
    }
  };

  useEffect(() => {
    refreshBrowserStatus();
    const interval = setInterval(refreshBrowserStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView setActiveTab={setActiveTab} browserStatus={browserStatus} />;
      case 'chat':
        return <ChatView />;
      case 'comments':
        return <CommentsView />;
      case 'email':
        return <EmailView />;
      case 'zalo':
        return <ZaloView />;
      case 'groups':
        return <GroupsView setActiveTab={setActiveTab} />;
      case 'pages':
        return <PagesView setActiveTab={setActiveTab} />;
      case 'search':
        return <SearchView setActiveTab={setActiveTab} />;
      case 'create-post':
        return <CreatePostView setActiveTab={setActiveTab} />;
      case 'posts':
        return <PostsView setActiveTab={setActiveTab} />;
      case 'queue':
        return <QueueView />;
      case 'logs':
        return <LogsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView setActiveTab={setActiveTab} browserStatus={browserStatus} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100/70 text-slate-800 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <Header browserStatus={browserStatus} onRefreshStatus={refreshBrowserStatus} />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50/70">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}
