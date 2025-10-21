'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Bell, Palette, Shield, Globe, Save, Moon, Sun, Upload, Camera } from 'lucide-react';
import { useAuth } from './AuthContext';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const t = useTranslations();
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    autoSave: true
  });
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    avatar: user?.avatar || ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
    
    // Load dark mode from localStorage
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode) {
      const isDark = JSON.parse(savedDarkMode);
      setSettings(prev => ({ ...prev, darkMode: isDark }));
      applyDarkMode(isDark);
    }
  }, []);

  // Update profile data when user changes
  useEffect(() => {
    setProfileData({
      name: user?.name || '',
      username: user?.username || '',
      avatar: user?.avatar || ''
    });
    setAvatarPreview(user?.avatar || null);
  }, [user]);

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      localStorage.setItem('appSettings', JSON.stringify(newSettings));
      
      // Handle dark mode
      if (key === 'darkMode') {
        localStorage.setItem('darkMode', JSON.stringify(value));
        applyDarkMode(value);
      }
      
      return newSettings;
    });
  };

  const applyDarkMode = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleDeleteStudyData = () => {
    if (confirm(t('settings.confirmDeleteStudyData'))) {
      try {
        // Xóa tất cả dữ liệu học tập (study progress)
        const keys = Object.keys(localStorage);
        const studyKeys = keys.filter(key => 
          key.startsWith('studyProgress_') || 
          key.startsWith('quizProgress_') ||
          key.startsWith('reviewProgress_') ||
          key.startsWith('practiceProgress_')
        );
        
        studyKeys.forEach(key => localStorage.removeItem(key));
        
        // Xóa chat history
        const chatKeys = keys.filter(key => 
          key.startsWith('chatHistory_') || 
          key.startsWith('conversation_')
        );
        
        chatKeys.forEach(key => localStorage.removeItem(key));
        
        // Xóa current lecture data
        localStorage.removeItem('currentLectureData');
        
        alert(t('settings.studyDataDeleted'));
      } catch (error) {
        console.error('Error deleting study data:', error);
        alert(t('settings.errorDeletingData'));
      }
    }
  };

  const handleDeleteAllData = () => {
    if (confirm(t('settings.confirmDeleteAllData'))) {
      try {
        // Lưu lại user data và settings trước khi xóa
        const userData = localStorage.getItem('user');
        const appSettings = localStorage.getItem('appSettings');
        const darkMode = localStorage.getItem('darkMode');
        
        // Xóa tất cả localStorage
        localStorage.clear();
        
        // Khôi phục user data và settings
        if (userData) localStorage.setItem('user', userData);
        if (appSettings) localStorage.setItem('appSettings', appSettings);
        if (darkMode) localStorage.setItem('darkMode', darkMode);
        
        alert(t('settings.allDataDeleted'));
      } catch (error) {
        console.error('Error deleting all data:', error);
        alert(t('settings.errorDeletingData'));
      }
    }
  };

  const handleProfileUpdate = () => {
    if (profileData.name.trim() && profileData.username.trim()) {
      updateUser({
        name: profileData.name.trim(),
        username: profileData.username.trim(),
        avatar: profileData.avatar
      });
      setIsEditing(false);
    }
  };

  // Handle avatar upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh hợp lệ');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Kích thước file không được vượt quá 2MB');
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Convert to base64 for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setAvatarPreview(base64);
        setProfileData(prev => ({ ...prev, avatar: base64 }));
      };
      reader.readAsDataURL(file);

      // Here you would typically upload to a server
      // For now, we'll just use base64
      console.log('Avatar uploaded:', file.name);
      
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Lỗi khi upload ảnh đại diện');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Remove avatar
  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setProfileData(prev => ({ ...prev, avatar: '' }));
  };

  const tabs = [
    { id: 'profile', name: t('settings.profile'), icon: User },
    { id: 'notifications', name: t('settings.notifications'), icon: Bell },
    { id: 'appearance', name: t('settings.appearance'), icon: Palette },
    { id: 'privacy', name: t('settings.privacy'), icon: Shield },
    { id: 'language', name: t('settings.language'), icon: Globe }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-2xl lg:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden mx-4 sm:mx-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 dark:text-white">{t('settings.title')}</h2>
              <button
                onClick={onClose}
                className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row h-[calc(100vh-200px)] sm:h-[600px]">
              {/* Sidebar */}
              <div className="w-full lg:w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 sm:p-4">
                <nav className="space-y-1 sm:space-y-2">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center space-x-2 sm:space-x-3 px-3 py-2 sm:py-3 rounded-lg text-left transition-colors text-sm sm:text-base ${
                          activeTab === tab.id
                            ? 'bg-blue-500 text-white'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="font-medium hidden sm:inline">{tab.name}</span>
                        <span className="font-medium sm:hidden">{tab.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Content */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto dark:bg-gray-900">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4 sm:space-y-6"
                  >
                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                      <div>
                        <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 dark:text-white">{t('settings.profileInfo')}</h3>
                        <div className="space-y-3 sm:space-y-4">
                          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
                            <div className="relative">
                              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden">
                                {avatarPreview ? (
                                  <img 
                                    src={avatarPreview} 
                                    alt={user?.name}
                                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover"
                                  />
                                ) : (
                                  <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                                )}
                              </div>
                              {isUploadingAvatar && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 sm:h-6 sm:w-6 border-b-2 border-white"></div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                              <p className="font-medium text-gray-800 dark:text-white text-sm sm:text-base">{user?.name}</p>
                              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">{user?.email}</p>
                              <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2 mt-2">
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarUpload}
                                    className="hidden"
                                    disabled={isUploadingAvatar}
                                  />
                                  <span className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 flex items-center space-x-1">
                                    <Camera className="w-3 h-3" />
                                    <span>Đổi ảnh</span>
                                  </span>
                                </label>
                                {avatarPreview && (
                                  <button
                                    onClick={handleRemoveAvatar}
                                    className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 flex items-center space-x-1"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>Xóa</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-3 sm:gap-4">
                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                                {t('settings.displayName')}
                              </label>
                              <input
                                type="text"
                                value={profileData.name}
                                onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                                disabled={!isEditing}
                                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                                {t('settings.username')}
                              </label>
                              <input
                                type="text"
                                value={profileData.username}
                                onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                                disabled={!isEditing}
                                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                              Email
                            </label>
                            <input
                              type="email"
                              value={user?.email || ''}
                              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                              disabled
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.emailCannotChange')}</p>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={handleProfileUpdate}
                                  className="w-full sm:w-auto bg-blue-500 text-white px-4 py-2 rounded text-sm sm:text-base hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                                >
                                  <Save className="w-4 h-4" />
                                  {t('settings.saveChanges')}
                                </button>
                                <button
                                  onClick={() => {
                                    setIsEditing(false);
                                    setProfileData({
                                      name: user?.name || '',
                                      username: user?.username || '',
                                      avatar: user?.avatar || ''
                                    });
                                    setAvatarPreview(user?.avatar || null);
                                  }}
                                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                                >
                                  {t('common.cancel')}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setIsEditing(true)}
                                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                              >
                                <User className="w-4 h-4" />
                                {t('settings.editProfile')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                      <div>
                        <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 dark:text-white">{t('settings.notificationSettings')}</h3>
                        <div className="space-y-3 sm:space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2 sm:space-y-0">
                            <div className="flex-1">
                              <p className="font-medium dark:text-white text-sm sm:text-base">{t('settings.emailNotifications')}</p>
                              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('settings.emailNotificationsDesc')}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.notifications}
                                onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Appearance Tab */}
                    {activeTab === 'appearance' && (
                      <div>
                        <h3 className="text-xl font-semibold mb-4 dark:text-white">{t('settings.appearanceCustomization')}</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center space-x-3">
                              {settings.darkMode ? (
                                <Moon className="w-5 h-5 text-blue-500" />
                              ) : (
                                <Sun className="w-5 h-5 text-yellow-500" />
                              )}
                              <div>
                                <p className="font-medium dark:text-white">{t('settings.darkMode')}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {settings.darkMode ? t('settings.darkModeActive') : t('settings.darkModeInactive')}
                                </p>
                              </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.darkMode}
                                onChange={(e) => handleSettingChange('darkMode', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                          
                          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div>
                              <p className="font-medium dark:text-white">{t('settings.autoSave')}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.autoSaveDesc')}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.autoSave}
                                onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>

                          {/* Theme Preview */}
                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <h4 className="font-medium mb-3 dark:text-white">{t('settings.themePreview')}</h4>
                            <div className={`p-4 rounded-lg border ${settings.darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800'}`}>
                              <div className="flex items-center space-x-3 mb-3">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                  <p className="font-medium">Nguyễn Thị Hằng</p>
                                  <p className={`text-sm ${settings.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>hang@example.com</p>
                                </div>
                              </div>
                              <p className={`text-sm ${settings.darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {t('settings.themePreviewDesc', { theme: settings.darkMode ? t('settings.dark') : t('settings.light') })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Privacy Tab */}
                    {activeTab === 'privacy' && (
                      <div>
                        <h3 className="text-xl font-semibold mb-4 dark:text-white">{t('settings.privacySecurity')}</h3>
                        <div className="space-y-4">
                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <h4 className="font-medium mb-2 dark:text-white">{t('settings.dataPrivacy')}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {t('settings.dataPrivacyDesc')}
                            </p>
                            <button 
                              onClick={() => setShowPrivacyPolicy(true)}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors"
                            >
                              {t('settings.viewPrivacyPolicy')}
                            </button>
                          </div>
                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <h4 className="font-medium mb-2 dark:text-white">{t('settings.deleteData')}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {t('settings.deleteDataDesc')}
                            </p>
                            <div className="space-y-2">
                              <button 
                                onClick={handleDeleteStudyData}
                                className="text-red-600 hover:text-red-700 text-sm font-medium mr-4"
                              >
                                {t('settings.deleteStudyData')}
                              </button>
                              <button 
                                onClick={handleDeleteAllData}
                                className="text-red-600 hover:text-red-700 text-sm font-medium"
                              >
                                {t('settings.deleteAllData')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Language Tab */}
                    {activeTab === 'language' && (
                      <div>
                        <h3 className="text-xl font-semibold mb-4 dark:text-white">{t('settings.language')}</h3>
                        <div className="space-y-4">
                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                              {t('settings.languageDesc')}
                            </p>
                            <LanguageSwitcher variant="list" />
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-end space-y-2 sm:space-y-0 sm:space-x-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-sm sm:text-base"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
              >
                <Save className="w-4 h-4" />
                <span>{t('settings.saveChanges')}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={showPrivacyPolicy}
        onClose={() => setShowPrivacyPolicy(false)}
      />
    </AnimatePresence>
  );
};

export default SettingsModal;
