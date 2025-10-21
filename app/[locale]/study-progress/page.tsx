'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  MessageCircle, 
  Brain, 
  FileText, 
  TrendingUp, 
  Clock, 
  Target, 
  Calendar,
  BarChart3,
  Award,
  ArrowLeft
} from 'lucide-react';
import StudyProgressBar from '@/components/StudyProgressBar';
import { useRouter } from 'next/navigation';

interface StudyProgress {
  id: string;
  searchTabProgress: number;
  chatTabProgress: number;
  quizTabProgress: number;
  flashcardTabProgress: number;
  totalProgress: number;
  lastUpdated: string;
  activities: any[];
}

interface Lecture {
  id: string;
  filename: string;
  originalName: string;
  createdAt: string;
}

const StudyProgressPage: React.FC = () => {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [studyProgress, setStudyProgress] = useState<StudyProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load current user
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
  }, []);

  // Load lectures
  useEffect(() => {
    const loadLectures = async () => {
      try {
        const response = await fetch('/api/lectures');
        const data = await response.json();
        if (data.success) {
          setLectures(data.lectures);
          if (data.lectures.length > 0) {
            setSelectedLecture(data.lectures[0]);
          }
        }
      } catch (error) {
        console.error('Error loading lectures:', error);
      }
    };

    if (currentUser?.id) {
      loadLectures();
    }
  }, [currentUser]);

  // Load study progress when lecture changes
  useEffect(() => {
    const loadStudyProgress = async () => {
      if (!currentUser?.id || !selectedLecture?.id) return;

      setIsLoading(true);
      try {
        const response = await fetch(`/api/study-progress?userId=${currentUser.id}&lectureId=${selectedLecture.id}`);
        const data = await response.json();
        if (data.success) {
          setStudyProgress(data.studyProgress);
        }
      } catch (error) {
        console.error('Error loading study progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStudyProgress();
  }, [currentUser, selectedLecture]);

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'text-green-600';
    if (progress >= 60) return 'text-yellow-600';
    if (progress >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getProgressBgColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-100';
    if (progress >= 60) return 'bg-yellow-100';
    if (progress >= 40) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRecentActivities = () => {
    if (!studyProgress?.activities) return [];
    return studyProgress.activities.slice(0, 10);
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'tab_visit': return <Target size={16} className="text-blue-600" />;
      case 'scroll': return <TrendingUp size={16} className="text-green-600" />;
      case 'time_spent': return <Clock size={16} className="text-purple-600" />;
      case 'interaction': return <Brain size={16} className="text-orange-600" />;
      default: return <FileText size={16} className="text-gray-600" />;
    }
  };

  const getActivityDescription = (activity: any) => {
    const tabNames = {
      search: locale === 'vi' ? 'Tìm kiếm' : 'Search',
      chat: locale === 'vi' ? 'Chat AI' : 'AI Chat',
      quiz: locale === 'vi' ? 'Quiz' : 'Quiz',
      flashcard: locale === 'vi' ? 'Flashcard' : 'Flashcard'
    };

    const activityTypes = {
      tab_visit: locale === 'vi' ? 'Truy cập' : 'Visited',
      scroll: locale === 'vi' ? 'Lướt trang' : 'Scrolled',
      time_spent: locale === 'vi' ? 'Dành thời gian' : 'Time spent',
      interaction: locale === 'vi' ? 'Tương tác' : 'Interacted'
    };

    const tabName = tabNames[activity.tab_name as keyof typeof tabNames] || activity.tab_name;
    const activityType = activityTypes[activity.activity_type as keyof typeof activityTypes] || activity.activity_type;

    return `${activityType} ${tabName}`;
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {locale === 'vi' ? 'Vui lòng đăng nhập' : 'Please login'}
          </h2>
          <p className="text-gray-600">
            {locale === 'vi' ? 'Bạn cần đăng nhập để xem tiến độ học tập' : 'You need to login to view study progress'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="hidden sm:inline">
                {locale === 'vi' ? 'Quay lại' : 'Back'}
              </span>
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {locale === 'vi' ? 'Tiến độ Học tập' : 'Study Progress'}
              </h1>
              <p className="text-gray-600">
                {locale === 'vi' 
                  ? 'Theo dõi tiến độ học tập của bạn qua các bài giảng'
                  : 'Track your learning progress across lectures'
                }
              </p>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar size={16} />
              <span>{formatDate(new Date().toISOString())}</span>
            </div>
          </div>
        </div>

        {/* Lecture Selector */}
        {lectures.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {locale === 'vi' ? 'Chọn bài giảng:' : 'Select Lecture:'}
            </label>
            <select
              value={selectedLecture?.id || ''}
              onChange={(e) => {
                const lecture = lectures.find(l => l.id === e.target.value);
                setSelectedLecture(lecture || null);
              }}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {lectures.map((lecture) => (
                <option key={lecture.id} value={lecture.id}>
                  {lecture.originalName}
                </option>
              ))}
            </select>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-32 bg-gray-200 rounded mb-4"></div>
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        ) : selectedLecture ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Main Progress */}
            <div className="lg:col-span-2">
              <StudyProgressBar 
                userId={currentUser.id}
                lectureId={selectedLecture.id}
                className="mb-6"
              />

              {/* Detailed Progress */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {locale === 'vi' ? 'Chi tiết Tiến độ' : 'Progress Details'}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {studyProgress && [
                    {
                      name: locale === 'vi' ? 'Tìm kiếm' : 'Search',
                      icon: <BookOpen size={20} className="text-blue-600" />,
                      progress: studyProgress.searchTabProgress,
                      color: 'blue'
                    },
                    {
                      name: locale === 'vi' ? 'Chat AI' : 'AI Chat',
                      icon: <MessageCircle size={20} className="text-green-600" />,
                      progress: studyProgress.chatTabProgress,
                      color: 'green'
                    },
                    {
                      name: 'Quiz',
                      icon: <Brain size={20} className="text-purple-600" />,
                      progress: studyProgress.quizTabProgress,
                      color: 'purple'
                    },
                    {
                      name: locale === 'vi' ? 'Flashcard' : 'Flashcard',
                      icon: <FileText size={20} className="text-orange-600" />,
                      progress: studyProgress.flashcardTabProgress,
                      color: 'orange'
                    }
                  ].map((tab, index) => (
                    <motion.div
                      key={tab.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {tab.icon}
                          <span className="font-medium text-gray-800">{tab.name}</span>
                        </div>
                        <span className={`text-lg font-bold ${getProgressColor(tab.progress)}`}>
                          {Math.round(tab.progress)}%
                        </span>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${tab.progress}%` }}
                          transition={{ duration: 1, delay: index * 0.1 }}
                          className={`h-2 rounded-full ${
                            tab.progress >= 80 ? 'bg-green-500' :
                            tab.progress >= 60 ? 'bg-yellow-500' :
                            tab.progress >= 40 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Recent Activities */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <BarChart3 size={20} />
                  {locale === 'vi' ? 'Hoạt động Gần đây' : 'Recent Activities'}
                </h3>
                
                <div className="space-y-3">
                  {getRecentActivities().map((activity, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {getActivityIcon(activity.activity_type)}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">
                          {getActivityDescription(activity)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(activity.created_at)}
                        </p>
                      </div>
                      {activity.progress_value > 0 && (
                        <span className="text-xs font-medium text-blue-600">
                          +{Math.round(activity.progress_value)}%
                        </span>
                      )}
                    </motion.div>
                  ))}
                  
                  {getRecentActivities().length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      {locale === 'vi' ? 'Chưa có hoạt động nào' : 'No activities yet'}
                    </p>
                  )}
                </div>
              </div>

              {/* Achievements */}
              {studyProgress && studyProgress.totalProgress >= 100 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-6 border border-yellow-200"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Award size={24} className="text-yellow-600" />
                    <h3 className="text-lg font-semibold text-yellow-800">
                      {locale === 'vi' ? 'Thành tích' : 'Achievement'}
                    </h3>
                  </div>
                  <p className="text-sm text-yellow-700">
                    {locale === 'vi' 
                      ? '🎉 Chúc mừng! Bạn đã hoàn thành bài học này!'
                      : '🎉 Congratulations! You completed this lesson!'
                    }
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <BookOpen size={48} className="text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              {locale === 'vi' ? 'Chưa có bài giảng nào' : 'No lectures available'}
            </h3>
            <p className="text-gray-500">
              {locale === 'vi' 
                ? 'Hãy upload bài giảng để bắt đầu theo dõi tiến độ học tập'
                : 'Upload a lecture to start tracking your study progress'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyProgressPage;
