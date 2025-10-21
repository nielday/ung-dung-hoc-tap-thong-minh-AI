'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, MessageCircle, Brain, FileText, TrendingUp, Clock, Target } from 'lucide-react';
import { useLocale } from 'next-intl';

interface StudyProgress {
  id: string;
  searchTabProgress: number;
  chatTabProgress: number;
  quizTabProgress: number;
  flashcardTabProgress: number;
  totalProgress: number;
  lastUpdated: string;
}

interface StudyProgressBarProps {
  lectureId: string;
  userId: string;
  className?: string;
}

const StudyProgressBar: React.FC<StudyProgressBarProps> = ({ 
  lectureId, 
  userId, 
  className = '' 
}) => {
  const locale = useLocale();
  const [studyProgress, setStudyProgress] = useState<StudyProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Load study progress
  const loadStudyProgress = async () => {
    try {
      setIsLoading(true);
      console.log(`📊 Loading study progress for user ${userId}, lecture ${lectureId}`);
      
      const response = await fetch(`/api/study-progress?userId=${userId}&lectureId=${lectureId}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Study progress loaded:', data.studyProgress);
        setStudyProgress(data.studyProgress);
        setLastUpdate(new Date(data.studyProgress.lastUpdated));
      } else {
        console.error('❌ Failed to load study progress:', data.message);
      }
    } catch (error) {
      console.error('❌ Error loading study progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId && lectureId) {
      loadStudyProgress();
    }
  }, [userId, lectureId]);

  // Auto refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (userId && lectureId) {
        loadStudyProgress();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [userId, lectureId]);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg p-4 shadow-sm border ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="h-3 bg-gray-200 rounded w-full mb-4"></div>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!studyProgress) {
    return null;
  }

  const tabProgress = [
    {
      name: locale === 'vi' ? 'Tìm kiếm' : 'Search',
      icon: <BookOpen size={16} />,
      progress: studyProgress.searchTabProgress,
      color: 'blue'
    },
    {
      name: locale === 'vi' ? 'Chat AI' : 'AI Chat',
      icon: <MessageCircle size={16} />,
      progress: studyProgress.chatTabProgress,
      color: 'green'
    },
    {
      name: 'Quiz',
      icon: <Brain size={16} />,
      progress: studyProgress.quizTabProgress,
      color: 'purple'
    },
    {
      name: locale === 'vi' ? 'Flashcard' : 'Flashcard',
      icon: <FileText size={16} />,
      progress: studyProgress.flashcardTabProgress,
      color: 'orange'
    }
  ];

  const getProgressColor = (color: string) => {
    switch (color) {
      case 'blue': return 'from-blue-500 to-blue-600';
      case 'green': return 'from-green-500 to-green-600';
      case 'purple': return 'from-purple-500 to-purple-600';
      case 'orange': return 'from-orange-500 to-orange-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getProgressBgColor = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-100';
      case 'green': return 'bg-green-100';
      case 'purple': return 'bg-purple-100';
      case 'orange': return 'bg-orange-100';
      default: return 'bg-gray-100';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return locale === 'vi' ? 'Vừa xong' : 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return locale === 'vi' ? `${minutes} phút trước` : `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return locale === 'vi' ? `${hours} giờ trước` : `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return locale === 'vi' ? `${days} ngày trước` : `${days}d ago`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-lg p-4 shadow-sm border ${className}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Target className="text-blue-600" size={20} />
          <h3 className="font-semibold text-gray-800">
            {locale === 'vi' ? 'Tiến độ học tập' : 'Study Progress'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-blue-600">
            {Math.round(studyProgress.totalProgress)}%
          </span>
          {lastUpdate && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={12} />
              <span>{formatTimeAgo(lastUpdate)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Progress Bar */}
      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${studyProgress.totalProgress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full shadow-sm"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>{locale === 'vi' ? 'Bắt đầu' : 'Start'}</span>
          <span>{locale === 'vi' ? 'Hoàn thành' : 'Complete'}</span>
        </div>
      </div>

      {/* Tab Progress Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {tabProgress.map((tab, index) => (
          <motion.div
            key={tab.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded ${getProgressBgColor(tab.color)}`}>
                {tab.icon}
              </div>
              <span className="text-sm font-medium text-gray-700">
                {tab.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">
                {Math.round(tab.progress)}%
              </span>
              <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${tab.progress}%` }}
                  transition={{ duration: 1, delay: index * 0.1 }}
                  className={`h-full bg-gradient-to-r ${getProgressColor(tab.color)}`}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Progress Tips */}
      {studyProgress.totalProgress < 100 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-2">
            <TrendingUp className="text-blue-600 mt-0.5" size={16} />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">
                {locale === 'vi' ? '💡 Gợi ý để tăng tiến độ:' : '💡 Tips to increase progress:'}
              </p>
              <ul className="text-xs space-y-1">
                {studyProgress.searchTabProgress < 50 && (
                  <li>• {locale === 'vi' ? 'Khám phá tab Tìm kiếm thông minh' : 'Explore the Smart Search tab'}</li>
                )}
                {studyProgress.chatTabProgress < 50 && (
                  <li>• {locale === 'vi' ? 'Trò chuyện với AI trợ lý' : 'Chat with AI assistant'}</li>
                )}
                {studyProgress.quizTabProgress < 50 && (
                  <li>• {locale === 'vi' ? 'Làm quiz để kiểm tra kiến thức' : 'Take quizzes to test knowledge'}</li>
                )}
                {studyProgress.flashcardTabProgress < 50 && (
                  <li>• {locale === 'vi' ? 'Học với flashcard' : 'Study with flashcards'}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Completion Celebration */}
      {studyProgress.totalProgress >= 100 && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200"
        >
          <div className="flex items-center gap-2">
            <div className="text-2xl">🎉</div>
            <div className="text-sm text-green-800">
              <p className="font-medium">
                {locale === 'vi' ? 'Chúc mừng! Bạn đã hoàn thành bài học!' : 'Congratulations! You completed the lesson!'}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default StudyProgressBar;
