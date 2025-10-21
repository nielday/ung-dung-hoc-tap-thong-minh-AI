'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import LectureSummary from './LectureSummary'
import FlashcardCreator from './FlashcardCreator'
import SmartSearch from './SmartSearch'
import AIStudyMode from './AIStudyMode'
import SettingsModal from './SettingsModal'
import StudyProgressBar from './StudyProgressBar'

interface Lecture {
  id: string
  filename: string
  originalName: string
  content: string
  isPublic: boolean
  permissions: string[]
  createdAt: string
  teacher: {
    name: string
    email: string
  }
}

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('lectures')
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    loadAccessibleLectures()
  }, [])

  const loadAccessibleLectures = async () => {
    try {
      const response = await fetch(`/api/lectures?studentId=${user?.id}`)
      const data = await response.json()
      if (data.success) {
        setLectures(data.lectures)
        // Auto-select first lecture if available
        if (data.lectures.length > 0 && !selectedLecture) {
          setSelectedLecture(data.lectures[0])
        }
      }
    } catch (error) {
      console.error('Error loading lectures:', error)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'lectures', label: '📚 Bài giảng', icon: '📚' },
    { id: 'summary', label: '📝 Tóm tắt AI', icon: '📝' },
    { id: 'flashcards', label: '🃏 Flashcards', icon: '🃏' },
    { id: 'study', label: '🎯 Học tập', icon: '🎯' },
    { id: 'progress', label: '📊 Tiến độ', icon: '📊' },
    { id: 'chat', label: '💬 Chat AI', icon: '💬' }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải bài giảng...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center py-2 sm:py-3 lg:py-4">
            <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                {user?.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.name}
                    className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-base sm:text-lg lg:text-2xl">👩‍🎓</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-gray-900 truncate">Student Dashboard</h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate">Xin chào, {user?.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-3 flex-shrink-0">
              <button
                onClick={() => setShowSettings(true)}
                className="bg-gray-600 text-white px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 rounded text-xs sm:text-sm hover:bg-gray-700 transition-colors flex items-center space-x-1"
              >
                <span className="text-xs sm:text-sm">⚙️</span>
                <span className="hidden sm:inline">Cài đặt</span>
              </button>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 rounded text-xs sm:text-sm hover:bg-red-700 transition-colors"
              >
                <span className="hidden sm:inline">Đăng xuất</span>
                <span className="sm:hidden">Thoát</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <nav className="flex overflow-x-auto space-x-1 sm:space-x-2 lg:space-x-8 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 sm:py-3 lg:py-4 px-2 sm:px-3 lg:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="hidden lg:inline">{tab.label}</span>
                <span className="lg:hidden">{tab.icon}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4 lg:py-6 xl:py-8">
        {activeTab === 'lectures' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
            <h2 className="text-base sm:text-lg lg:text-xl font-semibold mb-4">Bài giảng có sẵn</h2>
            {lectures.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="text-4xl sm:text-6xl mb-4">📚</div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Chưa có bài giảng nào</h3>
                <p className="text-sm sm:text-base text-gray-600">Giáo viên chưa chia sẻ bài giảng nào với bạn.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {lectures.map((lecture) => (
                  <div 
                    key={lecture.id} 
                    className={`border rounded-lg p-3 sm:p-4 cursor-pointer transition-all ${
                      selectedLecture?.id === lecture.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedLecture(lecture)}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-base sm:text-lg text-gray-900 truncate">{lecture.originalName}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                          Giáo viên: {lecture.teacher?.name || 'Không xác định'}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                          Tạo lúc: {new Date(lecture.createdAt).toLocaleString('vi-VN')}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            lecture.isPublic ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {lecture.isPublic ? 'Công khai' : 'Riêng tư'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-0 sm:ml-4">
                        <button
                          onClick={() => setSelectedLecture(lecture)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-xs sm:text-sm hover:bg-blue-700 w-full sm:w-auto"
                        >
                          Chọn bài này
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
            {selectedLecture ? (
              <>
                <h2 className="text-base sm:text-lg lg:text-xl font-semibold mb-4">Tóm tắt AI - {selectedLecture.originalName}</h2>
                <LectureSummary lectureData={selectedLecture} />
              </>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <div className="text-4xl sm:text-6xl mb-4">📝</div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Chưa chọn bài giảng</h3>
                <p className="text-sm sm:text-base text-gray-600">Vui lòng chọn một bài giảng từ danh sách để xem tóm tắt AI.</p>
                <button
                  onClick={() => setActiveTab('lectures')}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base"
                >
                  Chọn bài giảng
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'flashcards' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
            {selectedLecture ? (
              <>
                <h2 className="text-base sm:text-lg lg:text-xl font-semibold mb-4">Flashcards - {selectedLecture.originalName}</h2>
                <FlashcardCreator lectureData={selectedLecture} />
              </>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <div className="text-4xl sm:text-6xl mb-4">🃏</div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Chưa chọn bài giảng</h3>
                <p className="text-sm sm:text-base text-gray-600">Vui lòng chọn một bài giảng từ danh sách để học flashcards.</p>
                <button
                  onClick={() => setActiveTab('lectures')}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base"
                >
                  Chọn bài giảng
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'study' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
            {selectedLecture ? (
              <>
                <h2 className="text-base sm:text-lg lg:text-xl font-semibold mb-4">Học tập - {selectedLecture.originalName}</h2>
                <AIStudyMode lectureData={selectedLecture} />
              </>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <div className="text-4xl sm:text-6xl mb-4">🎯</div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Chưa chọn bài giảng</h3>
                <p className="text-sm sm:text-base text-gray-600">Vui lòng chọn một bài giảng từ danh sách để bắt đầu học tập.</p>
                <button
                  onClick={() => setActiveTab('lectures')}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base"
                >
                  Chọn bài giảng
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
            {selectedLecture ? (
              <>
                <h2 className="text-base sm:text-lg lg:text-xl font-semibold mb-4">📊 Tiến độ học tập - {selectedLecture.originalName}</h2>
                <StudyProgressBar 
                  userId={user?.id || ''}
                  lectureId={selectedLecture.id}
                />
              </>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <div className="text-4xl sm:text-6xl mb-4">📊</div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Chưa chọn bài giảng</h3>
                <p className="text-sm sm:text-base text-gray-600">Vui lòng chọn một bài giảng từ danh sách để xem tiến độ học tập.</p>
                <button
                  onClick={() => setActiveTab('lectures')}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base"
                >
                  Chọn bài giảng
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
            {selectedLecture ? (
              <>
                <h2 className="text-base sm:text-lg lg:text-xl font-semibold mb-4">Chat AI - {selectedLecture.originalName}</h2>
                <SmartSearch lectureData={selectedLecture} />
              </>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <div className="text-4xl sm:text-6xl mb-4">💬</div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Chưa chọn bài giảng</h3>
                <p className="text-sm sm:text-base text-gray-600">Vui lòng chọn một bài giảng từ danh sách để chat với AI.</p>
                <button
                  onClick={() => setActiveTab('lectures')}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base"
                >
                  Chọn bài giảng
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
  )
}
