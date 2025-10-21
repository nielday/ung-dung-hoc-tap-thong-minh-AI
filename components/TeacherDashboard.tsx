'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import FileUpload from './FileUpload'
import LectureSummary from './LectureSummary'
import FlashcardCreator from './FlashcardCreator'
import SettingsModal from './SettingsModal'
import ChatLimitManager from './ChatLimitManager'

interface Student {
  id: string
  name: string
  email: string
  username: string
  role?: string
}

interface Lecture {
  id: string
  filename: string
  originalName: string
  content: string
  isPublic: boolean
  permissions: string[]
  createdAt: string
  summaryData?: any
}

export default function TeacherDashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('upload')
  const [students, setStudents] = useState<Student[]>([])
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [showAddStudentModal, setShowAddStudentModal] = useState(false)
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [availableStudents, setAvailableStudents] = useState<Student[]>([])
  const [studentSearchTerm, setStudentSearchTerm] = useState('')
  const [selectedStudentsToAdd, setSelectedStudentsToAdd] = useState<string[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [showChatLimitManager, setShowChatLimitManager] = useState(false)
  
  // Quiz states
  const [quizSettings, setQuizSettings] = useState({
    numQuestions: 10,
    difficulty: 'mixed' as 'easy' | 'medium' | 'hard' | 'mixed',
    language: 'vi'
  })
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false)
  const [generatedQuiz, setGeneratedQuiz] = useState<any>(null)
  const [isSavingQuiz, setIsSavingQuiz] = useState(false)
  const [quizMessage, setQuizMessage] = useState('')
  const [existingQuizzes, setExistingQuizzes] = useState<any[]>([])
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false)
  const [isRefreshingStudents, setIsRefreshingStudents] = useState(false)
  const [lastStudentCount, setLastStudentCount] = useState(0)
  const [newStudentsNotification, setNewStudentsNotification] = useState<string | null>(null)
  const [isRefreshingLectures, setIsRefreshingLectures] = useState(false)
  const [permissionsNotification, setPermissionsNotification] = useState<string | null>(null)

  useEffect(() => {
    loadStudents()
    loadLectures()
    loadAllStudents()
    
    // Auto-refresh students disabled - only manual refresh via button
    // const studentInterval = setInterval(() => {
    //   loadAllStudents()
    // }, 15000) // 15 seconds
    
    // Auto-refresh lectures disabled - only manual refresh via button
    // const lectureInterval = setInterval(() => {
    //   loadLectures()
    // }, 20000) // 20 seconds
    
    // Focus refresh disabled - only manual refresh via buttons
    // const handleFocus = () => {
    //   console.log('🔄 Window focused - refreshing students only')
    //   loadAllStudents(true)
    //   // loadLectures(true) // Disabled - only manual refresh for lectures
    // }
    
    // window.addEventListener('focus', handleFocus) // Disabled - only manual refresh
    
    return () => {
      // clearInterval(studentInterval) // DISABLED - only manual refresh
      // clearInterval(lectureInterval) // DISABLED - only manual refresh
      // window.removeEventListener('focus', handleFocus) // DISABLED - only manual refresh
    }
  }, [])

  // Load quizzes when selected lecture changes
  useEffect(() => {
    if (selectedLecture) {
      loadExistingQuizzes(selectedLecture.id)
    } else {
      setExistingQuizzes([])
    }
  }, [selectedLecture])

  // Filter students based on search term
  const getFilteredStudents = () => {
    if (!studentSearchTerm.trim()) {
      return availableStudents
    }
    
    const searchLower = studentSearchTerm.toLowerCase()
    return availableStudents.filter(student => 
      student.name.toLowerCase().includes(searchLower) ||
      student.email.toLowerCase().includes(searchLower) ||
      student.username.toLowerCase().includes(searchLower)
    )
  }

  const loadAllStudents = async (forceRefresh = false) => {
    try {
      setIsRefreshingStudents(true)
      
      // Add timestamp and random number to prevent caching
      const timestamp = Date.now()
      const random = Math.random()
      const cacheBuster = forceRefresh ? `&force=${timestamp}&r=${random}` : `&t=${timestamp}`
      
      const response = await fetch(`/api/students/fresh?${cacheBuster}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        }
      })
      
      const data = await response.json()
      console.log('📊 Students API Response:', data)
      
      if (data.success) {
        // Filter out any users that might have been created with wrong role
        const validStudents = data.students.filter((s: Student) => 
          s.role === 'student'
        )
        
        console.log('👥 Valid students:', validStudents.length)
        console.log('📋 All students:', validStudents)
        
        // Check if there are new students
        if (lastStudentCount > 0 && validStudents.length > lastStudentCount) {
          const newCount = validStudents.length - lastStudentCount
          console.log(`🎉 Có ${newCount} sinh viên mới!`)
          
          // Show notification for new students
          if (forceRefresh) {
            setNewStudentsNotification(`🎉 Phát hiện ${newCount} sinh viên mới!`)
            setTimeout(() => setNewStudentsNotification(null), 5000)
          }
        }
        
        setAllStudents(validStudents)
        setLastStudentCount(validStudents.length)
        
        // Filter out students already in class
        const enrolledStudentIds = students.map(s => s.id)
        const available = validStudents.filter((s: Student) => !enrolledStudentIds.includes(s.id))
        setAvailableStudents(available)
        
        console.log('✅ Available students:', available.length)
        console.log('🔍 Enrolled student IDs:', enrolledStudentIds)
        console.log('📝 Available after filter:', available.map((s: Student) => s.username))
      } else {
        console.error('❌ API Error:', data.error)
      }
    } catch (error) {
      console.error('❌ Error loading all students:', error)
    } finally {
      setIsRefreshingStudents(false)
    }
  }

  // Add multiple students to class
  const addMultipleStudentsToClass = async (studentIds: string[]) => {
    try {
      const promises = studentIds.map(studentId => 
        fetch('/api/teacher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacherId: user?.id,
            studentId: studentId
          })
        })
      )
      
      const responses = await Promise.allSettled(promises)
      let successCount = 0
      let errorCount = 0
      
      responses.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          successCount++
        } else {
          errorCount++
        }
      })
      
      // Reload data
      await loadStudents()
      await loadAllStudents()
      
      if (successCount > 0) {
        alert(`Đã thêm thành công ${successCount} sinh viên!${errorCount > 0 ? ` (${errorCount} sinh viên đã tồn tại)` : ''}`)
      } else {
        alert('Tất cả sinh viên đã tồn tại trong lớp!')
      }
      
      // Clear selection
      setSelectedStudentsToAdd([])
      
    } catch (error) {
      console.error('Error adding multiple students:', error)
      alert('Lỗi khi thêm sinh viên')
    }
  }

  const addStudentToClass = async (studentId: string) => {
    try {
      const response = await fetch('/api/teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: user?.id,
          studentId: studentId
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        console.log('Student added successfully:', data)
        await loadStudents() // Reload enrolled students
        await loadAllStudents() // Reload available students
        alert('Thêm sinh viên thành công!')
      } else {
        console.error('Failed to add student:', data)
        const errorMessage = data.error || 'Unknown error'
        if (errorMessage.includes('already enrolled')) {
          alert('Sinh viên này đã có trong lớp rồi!')
          // Reload data to update the UI
          await loadStudents()
          await loadAllStudents()
        } else {
          alert('Lỗi khi thêm sinh viên: ' + errorMessage)
        }
      }
    } catch (error) {
      console.error('Error adding student:', error)
      alert('Lỗi khi thêm sinh viên')
    }
  }

  const removeStudentFromClass = async (studentId: string) => {
    try {
      const response = await fetch(`/api/teacher?teacherId=${user?.id}&studentId=${studentId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        console.log('Student removed successfully:', data)
        await loadStudents() // Reload enrolled students
        await loadAllStudents() // Reload available students
        alert('Xóa sinh viên thành công!')
      } else {
        console.error('Failed to remove student:', data)
        alert('Lỗi khi xóa sinh viên: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error removing student:', error)
      alert('Lỗi khi xóa sinh viên')
    }
  }

  const loadStudents = async () => {
    try {
      const response = await fetch(`/api/teacher?teacherId=${user?.id}`)
      const data = await response.json()
      if (data.success) {
        const enrolledStudents = data.students.map((s: any) => s.student)
        setStudents(enrolledStudents)
        
        // Update available students after loading enrolled students
        const enrolledStudentIds = enrolledStudents.map((s: Student) => s.id)
        const available = allStudents.filter((s: Student) => !enrolledStudentIds.includes(s.id))
        setAvailableStudents(available)
      }
    } catch (error) {
      console.error('Error loading students:', error)
    }
  }

  const loadLectures = async (forceRefresh = false) => {
    try {
      setIsRefreshingLectures(true)
      
      // Add timestamp and random number to prevent caching
      const timestamp = Date.now()
      const random = Math.random()
      const cacheBuster = forceRefresh ? `&force=${timestamp}&r=${random}` : `&t=${timestamp}`
      
      const response = await fetch(`/api/lectures?teacherId=${user?.id}${cacheBuster}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        }
      })
      
      const data = await response.json()
      console.log('📚 Lectures API Response:', data)
      
      if (data.success) {
        setLectures(data.lectures)
        console.log('✅ Loaded lectures:', data.lectures.length)
      } else {
        console.error('❌ Lectures API Error:', data.error)
      }
    } catch (error) {
      console.error('❌ Error loading lectures:', error)
    } finally {
      setIsRefreshingLectures(false)
      setLoading(false)
    }
  }

  const updateLecturePermissions = async (lectureId: string, permissions: string[], isPublic: boolean) => {
    try {
      console.log('🔄 Updating permissions for lecture:', lectureId)
      console.log('📝 New permissions:', permissions)
      console.log('🌐 New isPublic:', isPublic)
      
      const response = await fetch('/api/lectures/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lectureId, permissions, isPublic })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Permissions update response:', data)
        
        // Update lectures state immediately for better UX
        setLectures(prevLectures => 
          prevLectures.map(lecture => 
            lecture.id === lectureId 
              ? { ...lecture, permissions, isPublic }
              : lecture
          )
        )
        
        // Update selected lecture if it's the one being updated
        if (selectedLecture?.id === lectureId) {
          setSelectedLecture(prev => prev ? { ...prev, permissions, isPublic } : null)
        }
        
        // Also reload from server to ensure consistency
        setTimeout(() => {
          loadLectures(true)
        }, 500)
        
        console.log('🎉 Permissions updated successfully!')
        
        // Show success notification
        setPermissionsNotification(`✅ Đã cập nhật quyền truy cập thành công!`)
        setTimeout(() => setPermissionsNotification(null), 3000)
      } else {
        console.error('❌ Failed to update permissions:', await response.text())
      }
    } catch (error) {
      console.error('❌ Error updating permissions:', error)
    }
  }

  const deleteLecture = async (lectureId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài giảng này?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/lectures?lectureId=${lectureId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.success) {
        alert('Xóa bài giảng thành công!')
        loadLectures(true) // Force reload lectures list
        if (selectedLecture?.id === lectureId) {
          setSelectedLecture(null) // Clear selected lecture if it was deleted
        }
      } else {
        alert('Lỗi khi xóa bài giảng: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to delete lecture:', error)
      alert('Lỗi khi xóa bài giảng')
    }
  }

  const handleFileProcessed = async (data: any) => {
    try {
      console.log('📚 TeacherDashboard received file processed:', data)
      console.log('📚 Data ID:', data?.id)
      console.log('📚 Data filename:', data?.filename)
      
      // FileUpload component already saved the lecture to database
      // We just need to update the UI with the new lecture
      if (data.id) {
        // Add the new lecture to the list
        setLectures(prev => {
          console.log('📚 Current lectures count:', prev.length)
          console.log('📚 Adding new lecture to list')
          return [data, ...prev]
        })
        setSelectedLecture(data)
        setActiveTab('manage')
        console.log('✅ Lecture added to UI:', data.id)
      } else {
        console.error('❌ No lecture ID provided from FileUpload')
        // Fallback: reload lectures from server
        console.log('🔄 Reloading lectures from server...')
        await loadLectures(true)
      }
    } catch (error) {
      console.error('❌ Error handling file processed:', error)
    }
  }

  // Quiz functions
  const generateQuiz = async () => {
    if (!selectedLecture) return
    
    setIsGeneratingQuiz(true)
    setQuizMessage('')
    
    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: selectedLecture.content,
          numQuestions: quizSettings.numQuestions,
          difficulty: quizSettings.difficulty,
          locale: quizSettings.language
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate quiz')
      }

      const data = await response.json()
      
      if (data.success && data.questions) {
        const quiz = {
          id: `quiz_${Date.now()}`,
          title: `Quiz - ${selectedLecture.originalName}`,
          description: `Câu hỏi trắc nghiệm cho bài giảng: ${selectedLecture.originalName}`,
          questions: data.questions,
          createdAt: new Date().toISOString(),
          teacherId: user?.id || '',
          lectureId: selectedLecture.id
        }
        setGeneratedQuiz(quiz)
      } else {
        throw new Error(data.error || 'Failed to generate quiz')
      }
    } catch (error) {
      console.error('Error generating quiz:', error)
      setQuizMessage('Lỗi khi tạo quiz: ' + (error as Error).message)
    } finally {
      setIsGeneratingQuiz(false)
    }
  }

  const saveQuizToDatabase = async () => {
    if (!generatedQuiz) return
    
    setIsSavingQuiz(true)
    setQuizMessage('')
    
    try {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: generatedQuiz.title,
          description: generatedQuiz.description,
          questions: generatedQuiz.questions,
          lectureId: generatedQuiz.lectureId,
          difficulty: quizSettings.difficulty,
          teacherId: user?.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save quiz')
      }

      const data = await response.json()
      
      if (data.success) {
        setQuizMessage('✅ Quiz đã được lưu thành công vào database!')
        setGeneratedQuiz(null) // Clear generated quiz
        // Reload existing quizzes
        if (selectedLecture) {
          loadExistingQuizzes(selectedLecture.id)
        }
      } else {
        throw new Error(data.error || 'Failed to save quiz')
      }
    } catch (error) {
      console.error('Error saving quiz:', error)
      setQuizMessage('❌ Lỗi khi lưu quiz: ' + (error as Error).message)
    } finally {
      setIsSavingQuiz(false)
    }
  }

  // Load existing quizzes for selected lecture
  const loadExistingQuizzes = async (lectureId: string) => {
    setIsLoadingQuizzes(true)
    try {
      const response = await fetch(`/api/quiz?lectureId=${lectureId}`)
      const data = await response.json()
      
      if (data.success) {
        setExistingQuizzes(data.quizzes || [])
      } else {
        console.error('Failed to load quizzes:', data.error)
        setExistingQuizzes([])
      }
    } catch (error) {
      console.error('Error loading quizzes:', error)
      setExistingQuizzes([])
    } finally {
      setIsLoadingQuizzes(false)
    }
  }

  // Delete quiz
  const deleteQuiz = async (quizId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa quiz này?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/quiz?quizId=${quizId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setQuizMessage('✅ Quiz đã được xóa thành công!')
        // Reload existing quizzes
        if (selectedLecture) {
          loadExistingQuizzes(selectedLecture.id)
        }
      } else {
        throw new Error(data.error || 'Failed to delete quiz')
      }
    } catch (error) {
      console.error('Error deleting quiz:', error)
      setQuizMessage('❌ Lỗi khi xóa quiz: ' + (error as Error).message)
    }
  }

  const tabs = [
    { id: 'upload', label: '📤 Upload Bài giảng', icon: '📤' },
    { id: 'manage', label: '📚 Quản lý Bài giảng', icon: '📚' },
    { id: 'students', label: '👥 Quản lý Sinh viên', icon: '👥' },
    { id: 'summary', label: '📝 Tóm tắt AI', icon: '📝' },
    { id: 'flashcards', label: '🃏 Flashcards', icon: '🃏' },
    { id: 'quiz', label: '📋 Tạo Quiz', icon: '📋' }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
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
                  <span className="text-base sm:text-lg lg:text-2xl">👨‍🏫</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-gray-900 truncate">Teacher Dashboard</h1>
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

      {/* Notifications */}
      {newStudentsNotification && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse">
          {newStudentsNotification}
        </div>
      )}
      
      {permissionsNotification && (
        <div className="fixed top-16 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse">
          {permissionsNotification}
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4 lg:py-6 xl:py-8">
        {activeTab === 'upload' && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Upload Bài giảng mới</h2>
            <FileUpload onFileProcessed={handleFileProcessed} />
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
              <h2 className="text-base sm:text-lg lg:text-xl font-semibold">Quản lý Bài giảng</h2>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <div className="text-xs sm:text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded text-center">
                  Tổng: {lectures.length} bài giảng
                </div>
                <button
                  onClick={async () => {
                    await loadLectures(true) // Force refresh lectures
                  }}
                  disabled={isRefreshingLectures}
                  className={`px-3 sm:px-4 py-2 rounded text-sm transition-colors ${
                    isRefreshingLectures 
                      ? 'bg-gray-400 text-white cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isRefreshingLectures ? '🔄 Đang cập nhật...' : '🔄 Refresh'}
                </button>
              </div>
            </div>
            {lectures.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="text-4xl sm:text-6xl mb-4">📚</div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Chưa có bài giảng nào</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">Hãy upload bài giảng đầu tiên của bạn.</p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base"
                >
                  Upload bài giảng
                </button>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {lectures.map((lecture) => (
                  <div key={lecture.id} className="border rounded-lg p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-base sm:text-lg truncate">{lecture.originalName}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                          Tạo lúc: {new Date(lecture.createdAt).toLocaleString('vi-VN')}
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 mt-2">
                          <span className={`px-2 py-1 rounded text-xs w-fit ${
                            lecture.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {lecture.isPublic ? 'Công khai' : 'Riêng tư'}
                          </span>
                          <span className="text-xs text-gray-600">
                            {lecture.isPublic 
                              ? 'Tất cả sinh viên có thể truy cập' 
                              : `${lecture.permissions?.length || 0} sinh viên được phép truy cập`
                            }
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">
                        <button
                          onClick={() => {
                            setSelectedLecture(lecture)
                            setSelectedStudents(lecture.permissions)
                          }}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-xs sm:text-sm hover:bg-blue-700"
                        >
                          Quản lý
                        </button>
                        <button
                          onClick={() => {
                            const newIsPublic = !lecture.isPublic
                            updateLecturePermissions(lecture.id, lecture.permissions, newIsPublic)
                          }}
                          className="bg-gray-600 text-white px-3 py-1 rounded text-xs sm:text-sm hover:bg-gray-700"
                        >
                          {lecture.isPublic ? 'Ẩn' : 'Hiện'}
                        </button>
                        <button
                          onClick={() => deleteLecture(lecture.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-xs sm:text-sm hover:bg-red-700"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lecture Management Modal */}
            {selectedLecture && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
                <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold mb-4">Quản lý: {selectedLecture.originalName}</h3>
                  
                  {/* Public/Private Toggle */}
                  <div className="mb-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedLecture.isPublic}
                        onChange={(e) => {
                          const newIsPublic = e.target.checked
                          setSelectedLecture(prev => prev ? { ...prev, isPublic: newIsPublic } : null)
                        }}
                        className="rounded"
                      />
                      <span>Công khai cho tất cả sinh viên</span>
                    </label>
                  </div>

                  {/* Student Selection */}
                  {!selectedLecture.isPublic && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Chọn sinh viên được phép truy cập:</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {students.map((student) => (
                          <label key={student.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(student.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudents(prev => [...prev, student.id])
                                } else {
                                  setSelectedStudents(prev => prev.filter(id => id !== student.id))
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{student.name} ({student.email})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setSelectedLecture(null)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={() => {
                        updateLecturePermissions(
                          selectedLecture.id,
                          selectedStudents,
                          selectedLecture.isPublic
                        )
                        setSelectedLecture(null)
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Lưu thay đổi
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'students' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
              <h2 className="text-base sm:text-lg lg:text-xl font-semibold">Quản lý Sinh viên</h2>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <div className="text-xs sm:text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded text-center">
                  Tổng: {allStudents.length} | Có thể thêm: {availableStudents.length}
                </div>
                <button
                  onClick={async () => {
                    await loadStudents() // Load enrolled students first
                    await loadAllStudents(true) // Force refresh all students
                  }}
                  disabled={isRefreshingStudents}
                  className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                    isRefreshingStudents 
                      ? 'bg-gray-400 text-white cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isRefreshingStudents ? '🔄 Đang cập nhật...' : '🔄 Force Refresh'}
                </button>
                <button
                  onClick={() => setShowAddStudentModal(true)}
                  className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm"
                >
                  + Thêm sinh viên
                </button>
                <button
                  onClick={() => setShowChatLimitManager(true)}
                  className="bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm"
                >
                  ⚙️ Giới hạn Chat AI
                </button>
              </div>
            </div>
            
            {students.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="text-4xl sm:text-6xl mb-4">👥</div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Chưa có sinh viên nào</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">Hãy thêm sinh viên vào lớp học của bạn.</p>
                <button
                  onClick={() => setShowAddStudentModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base"
                >
                  Thêm sinh viên đầu tiên
                </button>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {students.map((student) => (
                  <div key={student.id} className="border rounded-lg p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-base sm:text-lg truncate">{student.name}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{student.email}</p>
                        <p className="text-xs text-gray-500 truncate">@{student.username}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs w-fit">
                          Đã thêm
                        </span>
                        <button
                          onClick={() => removeStudentFromClass(student.id)}
                          className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs hover:bg-red-200 w-fit"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Student Modal */}
            {showAddStudentModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
                <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold mb-4">Thêm sinh viên vào lớp</h3>
                  
                  {/* Search Input */}
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Tìm kiếm sinh viên theo tên, email hoặc username..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* Bulk Actions */}
                  {getFilteredStudents().length > 0 && (
                    <div className="mb-4 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedStudentsToAdd.length === getFilteredStudents().length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentsToAdd(getFilteredStudents().map(s => s.id))
                            } else {
                              setSelectedStudentsToAdd([])
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-600">
                          Chọn tất cả ({selectedStudentsToAdd.length}/{getFilteredStudents().length})
                        </span>
                      </div>
                      {selectedStudentsToAdd.length > 0 && (
                        <button
                          onClick={() => addMultipleStudentsToClass(selectedStudentsToAdd)}
                          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                        >
                          Thêm {selectedStudentsToAdd.length} sinh viên
                        </button>
                      )}
                    </div>
                  )}
                  
                  {getFilteredStudents().length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-4">🔍</div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        {studentSearchTerm.trim() ? 'Không tìm thấy sinh viên' : 'Không có sinh viên nào để thêm'}
                      </h4>
                      <p className="text-gray-600">
                        {studentSearchTerm.trim() 
                          ? 'Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc để xem tất cả sinh viên.'
                          : 'Tất cả sinh viên đã được thêm vào lớp hoặc chưa có sinh viên nào trong hệ thống.'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {getFilteredStudents().map((student) => (
                        <div key={student.id} className="border rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={selectedStudentsToAdd.includes(student.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudentsToAdd([...selectedStudentsToAdd, student.id])
                                  } else {
                                    setSelectedStudentsToAdd(selectedStudentsToAdd.filter(id => id !== student.id))
                                  }
                                }}
                                className="rounded"
                              />
                              <div>
                                <h4 className="font-medium">{student.name}</h4>
                                <p className="text-sm text-gray-600">{student.email}</p>
                                <p className="text-xs text-gray-500">@{student.username}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                addStudentToClass(student.id)
                                setShowAddStudentModal(false)
                                setStudentSearchTerm('')
                              }}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                            >
                              Thêm
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end mt-6">
                    <button
                      onClick={() => {
                        setShowAddStudentModal(false)
                        setStudentSearchTerm('')
                        setSelectedStudentsToAdd([])
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Tóm tắt AI</h2>
              {lectures.length > 0 && (
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Chọn bài giảng:</label>
                  <select
                    value={selectedLecture?.id || ''}
                    onChange={(e) => {
                      const lecture = lectures.find(l => l.id === e.target.value)
                      setSelectedLecture(lecture || null)
                    }}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn bài giảng --</option>
                    {lectures.map(lecture => (
                      <option key={lecture.id} value={lecture.id}>
                        {lecture.originalName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {selectedLecture ? (
              <LectureSummary lectureData={selectedLecture} />
            ) : lectures.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có bài giảng nào</h3>
                <p className="text-gray-600 mb-4">Hãy tải lên bài giảng đầu tiên để sử dụng tính năng tóm tắt AI.</p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Tải lên Bài giảng
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Chọn bài giảng</h3>
                <p className="text-gray-600">Vui lòng chọn một bài giảng từ dropdown ở trên để xem tóm tắt AI.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'flashcards' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Flashcards</h2>
              {lectures.length > 0 && (
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Chọn bài giảng:</label>
                  <select
                    value={selectedLecture?.id || ''}
                    onChange={(e) => {
                      const lecture = lectures.find(l => l.id === e.target.value)
                      setSelectedLecture(lecture || null)
                    }}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn bài giảng --</option>
                    {lectures.map(lecture => (
                      <option key={lecture.id} value={lecture.id}>
                        {lecture.originalName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {selectedLecture ? (
              <FlashcardCreator lectureData={selectedLecture} />
            ) : lectures.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🃏</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có bài giảng nào</h3>
                <p className="text-gray-600 mb-4">Hãy tải lên bài giảng đầu tiên để tạo flashcards.</p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Tải lên Bài giảng
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🃏</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Chọn bài giảng</h3>
                <p className="text-gray-600">Vui lòng chọn một bài giảng từ dropdown ở trên để xem flashcards.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'quiz' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Tạo Quiz</h2>
              {lectures.length > 0 && (
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Chọn bài giảng:</label>
                  <select
                    value={selectedLecture?.id || ''}
                    onChange={(e) => {
                      const lecture = lectures.find(l => l.id === e.target.value)
                      setSelectedLecture(lecture || null)
                    }}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn bài giảng --</option>
                    {lectures.map(lecture => (
                      <option key={lecture.id} value={lecture.id}>
                        {lecture.originalName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {selectedLecture ? (
              <div className="space-y-6">
                {/* Existing Quizzes */}
                <div className="bg-white rounded-lg border p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">📋 Quiz đã có</h3>
                    {isLoadingQuizzes && (
                      <div className="flex items-center space-x-2 text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span>Đang tải...</span>
                      </div>
                    )}
                  </div>

                  {existingQuizzes.length > 0 ? (
                    <div className="space-y-4">
                      {existingQuizzes.map((quiz, index) => (
                        <div key={quiz.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{quiz.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">{quiz.description}</p>
                              <div className="flex items-center space-x-4 mt-2">
                                <span className="text-sm text-gray-500">
                                  {quiz.questions?.length || 0} câu hỏi
                                </span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  quiz.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                                  quiz.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  quiz.difficulty === 'hard' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {quiz.difficulty === 'easy' ? 'Dễ' :
                                   quiz.difficulty === 'medium' ? 'Trung bình' :
                                   quiz.difficulty === 'hard' ? 'Khó' : 'Hỗn hợp'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Tạo: {new Date(quiz.createdAt).toLocaleString('vi-VN')}
                                </span>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => deleteQuiz(quiz.id)}
                                className="bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200"
                              >
                                🗑️ Xóa
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-4">📋</div>
                      <h4 className="font-medium text-gray-900 mb-2">Chưa có quiz nào</h4>
                      <p className="text-gray-600">Tạo quiz đầu tiên cho bài giảng này.</p>
                    </div>
                  )}
                </div>

                {/* Quiz Settings */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">⚙️ Tạo Quiz mới</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Số câu hỏi
                      </label>
                      <select 
                        value={quizSettings.numQuestions}
                        onChange={(e) => setQuizSettings(prev => ({ 
                          ...prev, 
                          numQuestions: parseInt(e.target.value) 
                        }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={5}>5 câu</option>
                        <option value={10}>10 câu</option>
                        <option value={15}>15 câu</option>
                        <option value={20}>20 câu</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Độ khó
                      </label>
                      <select 
                        value={quizSettings.difficulty}
                        onChange={(e) => setQuizSettings(prev => ({ 
                          ...prev, 
                          difficulty: e.target.value as any 
                        }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="mixed">Hỗn hợp</option>
                        <option value="easy">Dễ</option>
                        <option value="medium">Trung bình</option>
                        <option value="hard">Khó</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ngôn ngữ
                      </label>
                      <select 
                        value={quizSettings.language}
                        onChange={(e) => setQuizSettings(prev => ({ 
                          ...prev, 
                          language: e.target.value 
                        }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="vi">Tiếng Việt</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button 
                      onClick={generateQuiz}
                      disabled={isGeneratingQuiz}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isGeneratingQuiz ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Đang tạo quiz...</span>
                        </>
                      ) : (
                        <>
                          <span>🎯</span>
                          <span>Tạo Quiz</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Generated Quiz Preview */}
                {generatedQuiz ? (
                  <div className="bg-white rounded-lg border p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">📋 Quiz đã tạo</h3>
                      <div className="flex space-x-2">
                        <button
                          onClick={saveQuizToDatabase}
                          disabled={isSavingQuiz}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          {isSavingQuiz ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Đang lưu...</span>
                            </>
                          ) : (
                            <>
                              <span>💾</span>
                              <span>Lưu vào Database</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setGeneratedQuiz(null)}
                          className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                        >
                          ❌ Hủy
                        </button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900">{generatedQuiz.title}</h4>
                      <p className="text-sm text-gray-600">{generatedQuiz.description}</p>
                      <p className="text-sm text-gray-500">
                        {generatedQuiz.questions.length} câu hỏi • 
                        Độ khó: {quizSettings.difficulty} • 
                        Ngôn ngữ: {quizSettings.language === 'vi' ? 'Tiếng Việt' : 'English'}
                      </p>
                    </div>

                    {/* Questions Preview */}
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {generatedQuiz.questions.map((question: any, index: number) => (
                        <div key={question.id} className="border rounded-lg p-4">
                          <div className="flex items-start space-x-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                              {index + 1}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 mb-2">{question.question}</p>
                              <div className="space-y-1">
                                {question.options.map((option: string, optIndex: number) => (
                                  <div 
                                    key={optIndex}
                                    className={`text-sm ${
                                      optIndex === question.correctAnswer 
                                        ? 'text-green-600 font-medium' 
                                        : 'text-gray-600'
                                    }`}
                                  >
                                    {option}
                                    {optIndex === question.correctAnswer && ' ✓'}
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 flex items-center space-x-4">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                                  question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {question.difficulty === 'easy' ? 'Dễ' :
                                   question.difficulty === 'medium' ? 'Trung bình' : 'Khó'}
                                </span>
                                <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                                  {question.category}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">📋 Quiz Preview</h3>
                    <p className="text-gray-600">Chọn bài giảng và nhấn "Tạo Quiz" để xem preview và lưu vào database.</p>
                  </div>
                )}

                {/* Quiz Message */}
                {quizMessage && (
                  <div className={`p-4 rounded-lg ${
                    quizMessage.includes('✅') 
                      ? 'bg-green-50 text-green-800 border border-green-200' 
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {quizMessage}
                  </div>
                )}
              </div>
            ) : lectures.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có bài giảng nào</h3>
                <p className="text-gray-600 mb-4">Hãy tải lên bài giảng đầu tiên để tạo quiz.</p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Tải lên Bài giảng
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Chọn bài giảng</h3>
                <p className="text-gray-600">Vui lòng chọn một bài giảng từ dropdown ở trên để tạo quiz.</p>
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

      {/* Chat Limit Manager Modal */}
      <ChatLimitManager 
        isOpen={showChatLimitManager} 
        onClose={() => setShowChatLimitManager(false)} 
      />
    </div>
  )
}
