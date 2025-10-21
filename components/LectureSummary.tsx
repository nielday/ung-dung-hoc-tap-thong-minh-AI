'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Brain, 
  BookOpen, 
  Target, 
  Lightbulb, 
  FileText, 
  Sparkles,
  Clock,
  TrendingUp,
  CheckCircle,
  Star,
  Map
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

interface LectureSummaryProps {
  lectureData: any
}

interface LearningObjective {
  id: string
  title: string
  description: string
  category: string
  importance: 'high' | 'medium' | 'low'
  completed: boolean
  estimatedTime: number // in minutes
  subObjectives: string[]
  prerequisites: string[]
  notes: string
  progress: number // 0-100
  lastUpdated: string
}

interface KeyPoint {
  id: string
  content: string
  category: string
  difficulty: 'basic' | 'intermediate' | 'advanced'
  relatedConcepts: string[]
  explanation: string
  examples: string[]
  practiceQuestions: string[]
  masteryLevel: number // 0-100
  lastReviewed: string
  isExpanded: boolean
}

interface SummaryLevel {
  id: string
  name: string
  description: string
  detail: 'brief' | 'moderate' | 'detailed'
}

export default function LectureSummary({ lectureData }: LectureSummaryProps) {
  const t = useTranslations()
  const locale = useLocale()
  const [summaryLevel, setSummaryLevel] = useState<'brief' | 'moderate' | 'detailed'>('moderate')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [isLoadingFromDB, setIsLoadingFromDB] = useState(false)
  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([])
  const [keyPoints, setKeyPoints] = useState<KeyPoint[]>([])
  const [summary, setSummary] = useState('')
  const [activeTab, setActiveTab] = useState<'content' | 'summary' | 'objectives' | 'keypoints' | 'insights'>('content')
  const [insights, setInsights] = useState<any>(null)
  const [selectedObjective, setSelectedObjective] = useState<string | null>(null)
  const [objectiveNotes, setObjectiveNotes] = useState<{[key: string]: string}>({})
  const [keyPointMastery, setKeyPointMastery] = useState<{[key: string]: number}>({})
  const [showMindMap, setShowMindMap] = useState(false)

  const summaryLevels: SummaryLevel[] = [
    {
      id: 'brief',
      name: t('summary.summaryLevels.brief'),
      description: t('summary.summaryLevelsDesc.brief'),
      detail: 'brief'
    },
    {
      id: 'moderate',
      name: t('summary.summaryLevels.moderate'),
      description: t('summary.summaryLevelsDesc.moderate'),
      detail: 'moderate'
    },
    {
      id: 'detailed',
      name: t('summary.summaryLevels.detailed'),
      description: t('summary.summaryLevelsDesc.detailed'),
      detail: 'detailed'
    }
  ]

  useEffect(() => {
    console.log('🔍 LectureSummary useEffect triggered')
    console.log('🔍 lectureData:', lectureData)
    console.log('🔍 lectureData.id:', lectureData?.id)
    
    if (lectureData && lectureData.content) {
      // Only clear and load when lectureData changes, not summaryLevel
      setSummary('')
      setLearningObjectives([])
      setKeyPoints([])
      setInsights(null)
      
      // Try to load from database first
      loadSummaryFromDatabase()
    }
  }, [lectureData]) // Removed summaryLevel dependency

  // Separate useEffect for summaryLevel changes
  useEffect(() => {
    if (lectureData && lectureData.content && summary) {
      console.log('🔄 Summary level changed to:', summaryLevel)
      // Only load if we don't have data for this level
      loadSummaryFromDatabase()
    }
  }, [summaryLevel])

  // Initialize enhanced data when API response is received
  useEffect(() => {
    if (learningObjectives.length > 0) {
      const hasInitialized = learningObjectives.some(obj => obj.progress !== undefined)
      if (!hasInitialized) {
        setLearningObjectives(prev => prev.map(obj => ({
          ...obj,
          completed: false,
          progress: 0,
          lastUpdated: new Date().toISOString()
        })))
      }
    }
  }, [learningObjectives])

  useEffect(() => {
    if (keyPoints.length > 0) {
      const hasInitialized = keyPoints.some(point => point.masteryLevel !== undefined)
      if (!hasInitialized) {
        setKeyPoints(prev => prev.map(point => ({
          ...point,
          masteryLevel: 0,
          lastReviewed: new Date().toISOString(),
          isExpanded: false
        })))
      }
    }
  }, [keyPoints])

  const loadSummaryFromDatabase = async (forceLoad = false) => {
    console.log('🔍 loadSummaryFromDatabase - lectureData:', lectureData)
    console.log('🔍 loadSummaryFromDatabase - lectureData.id:', lectureData?.id)
    console.log('🔍 loadSummaryFromDatabase - summaryLevel:', summaryLevel)
    console.log('🔍 loadSummaryFromDatabase - forceLoad:', forceLoad)
    
    if (!lectureData?.id) {
      console.log('❌ No lecture ID, generating new summary')
      generateAISummary(lectureData.content, summaryLevel)
      return
    }

    // If we already have summary data and not forcing, don't reload
    if (!forceLoad && summary && summary.trim()) {
      console.log('✅ Already have summary data, skipping database load')
      return
    }

    // Check if we're currently generating or loading to avoid duplicate requests
    if (isGenerating || isLoadingFromDB) {
      console.log('⏳ Already generating or loading, skipping database load')
      return
    }

    try {
      setIsLoadingFromDB(true)
      console.log('📡 Loading summary from database for lecture:', lectureData.id)
      const response = await fetch(`/api/summary?lectureId=${lectureData.id}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('📦 API Response:', data)
        console.log('📦 summaryData:', data.summaryData)
        
        if (data.summaryData && data.summaryData.analysis) {
          // Load existing summary data
          const summaryData = data.summaryData
          console.log('✅ Found existing summary data in database')
          
          // Check if we have data for current summary level
          const hasDataForLevel = summaryData.analysis?.summary && 
                                 summaryData.analysis.summary.trim() &&
                                 summaryData.metadata?.summaryLevel === summaryLevel
          
          if (hasDataForLevel) {
            console.log('✅ Loading existing summary text for level:', summaryLevel)
            setSummary(summaryData.analysis.summary)
            
            // Set learning objectives
            if (summaryData.analysis?.objectives && summaryData.analysis.objectives.length > 0) {
              console.log('✅ Loading existing objectives:', summaryData.analysis.objectives.length)
              setLearningObjectives(summaryData.analysis.objectives)
            } else {
              setLearningObjectives([])
            }
            
            // Set key points
            if (summaryData.analysis?.keyPoints && summaryData.analysis.keyPoints.length > 0) {
              console.log('✅ Loading existing key points:', summaryData.analysis.keyPoints.length)
              setKeyPoints(summaryData.analysis.keyPoints)
            } else {
              setKeyPoints([])
            }
            
            // Set insights
            if (summaryData.aiInsights) {
              console.log('✅ Loading existing insights')
              setInsights(summaryData.aiInsights)
            } else {
              setInsights(null)
            }
            
            console.log('🎉 Summary loaded successfully from database')
            return
          } else {
            console.log('❌ No data for current level, generating new for level:', summaryLevel)
          }
        } else {
          console.log('❌ No summaryData.analysis found in database')
        }
      } else {
        console.log('❌ API response not ok:', response.status, response.statusText)
      }
      
      // If no data in database, generate new
      console.log('🔄 No summary data in database, generating new')
      generateAISummary(lectureData.content, summaryLevel)
      
    } catch (error) {
      console.error('💥 Error loading summary from database:', error)
      // Fallback to generate new
      generateAISummary(lectureData.content, summaryLevel)
    } finally {
      setIsLoadingFromDB(false)
    }
  }

  const saveSummaryToDatabase = async (summaryData: any) => {
    if (!lectureData?.id) {
      console.log('❌ No lecture ID, cannot save summary')
      return
    }

    try {
      console.log('💾 Saving summary to database for lecture:', lectureData.id)
      console.log('💾 Summary data to save:', summaryData)
      
      const dataToSave = {
        analysis: {
          summary: summaryData.summary || '',
          objectives: summaryData.objectives || [],
          keyPoints: summaryData.keyPoints || [],
          level: summaryLevel,
          generatedAt: new Date().toISOString()
        },
        metadata: {
          ...lectureData.metadata,
          summaryLevel: summaryLevel,
          lastUpdated: new Date().toISOString()
        },
        aiInsights: summaryData.insights || {}
      }
      
      console.log('💾 Formatted data to save:', dataToSave)
      
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lectureId: lectureData.id,
          summaryData: dataToSave
        })
      })

      if (response.ok) {
        console.log('✅ Summary saved to database successfully')
      } else {
        const errorData = await response.json()
        console.error('❌ Failed to save summary to database:', errorData)
      }
    } catch (error) {
      console.error('💥 Error saving summary to database:', error)
    }
  }

  const generateAISummary = async (content: string, level: string) => {
    console.log('Generating summary with locale:', locale)
    console.log('Summary level:', level)
    setIsGenerating(true)
    setGenerationProgress(0)
    
    try {
      // Real-time progress tracking
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      console.log('Sending request with locale:', locale)
      console.log('Request headers:', { 'Accept-Language': locale })
      
      // Gọi API thực tế để tạo tóm tắt
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': locale
        },
        body: JSON.stringify({
          text: content,
          level: level
        })
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate summary')
      }

      const data = await response.json()
      
      console.log('Summary API response:', data)
      console.log('Summary content:', data.summary)
      console.log('Summary length:', data.summary?.length)
      
      // Cập nhật với dữ liệu thật từ AI
      setSummary(data.summary || t('summary.error'))
      setLearningObjectives(data.objectives || [])
      setKeyPoints(data.keyPoints || [])
      setInsights(data.insights || null)
      
      setGenerationProgress(100)
      
      // Save summary to database
      await saveSummaryToDatabase({
        ...data,
        summary: data.summary || t('summary.error'),
        objectives: data.objectives || [],
        keyPoints: data.keyPoints || [],
        insights: data.insights || null
      })
      
    } catch (error) {
      console.error('Error generating summary:', error)
      // Fallback content
              setSummary(`${t('summary.errorGenerating')}: ${error instanceof Error ? error.message : 'Unknown error'}. ${t('summary.pleaseTryAgain')}`)
      setLearningObjectives([])
      setKeyPoints([])
    } finally {
      setIsGenerating(false)
      setTimeout(() => setGenerationProgress(0), 2000)
    }
  }



  const toggleObjectiveCompletion = (id: string) => {
    setLearningObjectives(prev => 
      prev.map(obj => 
        obj.id === id 
          ? { ...obj, completed: !obj.completed, progress: !obj.completed ? 100 : 0 }
          : obj
      )
    )
  }

  const updateObjectiveProgress = (id: string, progress: number) => {
    setLearningObjectives(prev => 
      prev.map(obj => 
        obj.id === id 
          ? { ...obj, progress, completed: progress >= 100 }
          : obj
      )
    )
  }

  const updateObjectiveNotes = (id: string, notes: string) => {
    setObjectiveNotes(prev => ({ ...prev, [id]: notes }))
  }

  const updateKeyPointMastery = (id: string, mastery: number) => {
    setKeyPointMastery(prev => ({ ...prev, [id]: mastery }))
  }

  const toggleKeyPointExpansion = (id: string) => {
    setKeyPoints(prev => 
      prev.map(point => 
        point.id === id 
          ? { ...point, isExpanded: !point.isExpanded }
          : point
      )
    )
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500'
    if (progress >= 60) return 'bg-blue-500'
    if (progress >= 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 80) return 'text-green-600'
    if (mastery >= 60) return 'text-blue-600'
    if (mastery >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'basic': return 'badge-success'
      case 'intermediate': return 'badge-warning'
      case 'advanced': return 'badge-danger'
      default: return 'badge-muted'
    }
  }

  if (isGenerating) {
    return (
      <motion.div 
        className="glass p-8 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500 mx-auto mb-4"></div>
        <h3 className="text-xl font-semibold mb-2">{t('summary.aiProcessingLecture')}</h3>
        <p className="text-gray-600 mb-4">{t('summary.analyzingContent')}</p>
        
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <motion.div 
            className="bg-gradient-to-r from-pink-500 to-purple-500 h-3 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${generationProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="text-sm text-gray-600">
          {Math.round(generationProgress)}% {t('summary.completed')}
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="glass p-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-3 sm:space-y-0">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
          {t('summary.smartSummaryWithAI')}
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          {summaryLevels.map((level) => (
            <button
              key={level.id}
              onClick={() => setSummaryLevel(level.detail)}
              className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
                summaryLevel === level.detail
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title={level.description}
            >
              {level.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTab('content')}
          className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
            activeTab === 'content' 
              ? 'bg-indigo-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">{t('summary.originalContent')}</span>
          <span className="sm:hidden">Nội dung</span>
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
            activeTab === 'summary' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Sparkles className="w-4 h-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">{t('summary.aiSummary')}</span>
          <span className="sm:hidden">Tóm tắt</span>
        </button>
        <button
          onClick={() => setActiveTab('objectives')}
          className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
            activeTab === 'objectives' 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Target className="w-4 h-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">{t('summary.learningObjectives')}</span>
          <span className="sm:hidden">Mục tiêu</span>
        </button>
        <button
          onClick={() => setActiveTab('keypoints')}
          className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
            activeTab === 'keypoints' 
              ? 'bg-purple-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Lightbulb className="w-4 h-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">{t('summary.keyPoints')}</span>
          <span className="sm:hidden">Điểm chính</span>
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
            activeTab === 'insights' 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">{t('summary.aiAnalysis')}</span>
          <span className="sm:hidden">Phân tích</span>
        </button>
      </div>

      {activeTab === 'content' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="card p-4 sm:p-6 mb-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              {t('summary.originalContentFromFile')}
            </h3>
            {lectureData?.content ? (
              <div className="prose max-w-none">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border">
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">{t('summary.file')}: {lectureData.filename}</h4>
                  <div className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                    {t('summary.size')}: {lectureData.size ? (lectureData.size / 1024).toFixed(1) + ' KB' : 'N/A'} | 
                    {t('summary.type')}: {lectureData.type || 'N/A'}
                  </div>
                </div>
                <div className="mt-3 sm:mt-4 whitespace-pre-wrap text-gray-800 leading-relaxed max-h-64 sm:max-h-96 overflow-y-auto border border-gray-200 p-3 sm:p-4 rounded-lg bg-white text-sm sm:text-base">
                  {lectureData.content}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base">{t('summary.noFileContent')}</p>
              </div>
            )}
          </div>

          {lectureData?.metadata && (
            <div className="card p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">{t('summary.fileInfo')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-blue-600">{lectureData.metadata.wordCount || 'N/A'}</div>
                  <div className="text-xs sm:text-sm text-gray-600">{t('summary.wordCount')}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-green-600">{lectureData.metadata.pages || 'N/A'}</div>
                  <div className="text-xs sm:text-sm text-gray-600">{t('summary.pages')}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-purple-600">{lectureData.metadata.language || 'N/A'}</div>
                  <div className="text-xs sm:text-sm text-gray-600">{t('summary.language')}</div>
                </div>
              </div>
              
              {lectureData.metadata.topics && lectureData.metadata.topics.length > 0 && (
                <div className="mt-3 sm:mt-4">
                  <h4 className="font-semibold mb-2 text-sm sm:text-base">{t('summary.topics')}:</h4>
                  <div className="flex flex-wrap gap-1 sm:gap-2">
                    {lectureData.metadata.topics.map((topic: string, idx: number) => (
                      <span key={idx} className="bg-blue-100 text-blue-800 text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'summary' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="card p-4 sm:p-6 mb-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              {t('summary.lectureSummary')}
            </h3>
            <p className="text-gray-700 leading-relaxed text-sm sm:text-base">{summary}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="card p-4 sm:p-6">
              <h4 className="font-semibold mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                {t('summary.readTime')}
              </h4>
              <div className="text-xl sm:text-2xl font-bold text-blue-600">
                {insights?.estimatedReadTime ? `${insights.estimatedReadTime} ${t('summary.minutes')}` : `5-7 ${t('summary.minutes')}`}
              </div>
              <p className="text-xs sm:text-sm text-gray-600">{t('summary.readTimeDesc')}</p>
            </div>
            
            <div className="card p-4 sm:p-6">
              <h4 className="font-semibold mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                <Star className="w-4 h-4 sm:w-5 sm:h-5" />
                {t('summary.difficultyLabel')}
              </h4>
              <div className={`text-xl sm:text-2xl font-bold ${
                insights?.difficulty === 'easy' ? 'text-green-600' :
                insights?.difficulty === 'hard' ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {insights?.difficulty === 'easy' ? t('summary.difficultyEasy') :
                 insights?.difficulty === 'hard' ? t('summary.difficultyHard') : t('summary.difficultyMedium')}
              </div>
              <p className="text-xs sm:text-sm text-gray-600">
                {insights?.difficulty === 'easy' ? t('summary.difficultyEasyDesc') :
                 insights?.difficulty === 'hard' ? t('summary.difficultyHardDesc') : t('summary.difficultyMediumDesc')}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'objectives' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  {t('summary.learningObjectivesTitle')}
                </h3>
                <p className="text-gray-600">
                  {t('summary.learningObjectivesDesc')}
                </p>
              </div>
              
              {/* Overall Progress */}
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {learningObjectives.length > 0 
                    ? Math.round(learningObjectives.reduce((acc, obj) => acc + (obj.progress || 0), 0) / learningObjectives.length)
                    : 0}%
                </div>
                <div className="text-sm text-gray-500">
                  {locale === 'vi' ? 'Tiến độ tổng thể' : 'Overall Progress'}
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              {learningObjectives.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p>{t('study.objectives.noObjectives')}</p>
                </div>
              ) : (
                learningObjectives.map((objective) => (
                <motion.div
                  key={objective.id}
                  className="border border-gray-200 rounded-lg hover:shadow-lg transition-all duration-300"
                  whileHover={{ y: -2 }}
                >
                  {/* Main Objective Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleObjectiveCompletion(objective.id)}
                        className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          objective.completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-green-500'
                        }`}
                      >
                        {objective.completed && <CheckCircle className="w-3 h-3" />}
                      </button>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className={`font-semibold text-lg ${objective.completed ? 'line-through text-gray-500' : ''}`}>
                            {objective.title}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getImportanceColor(objective.importance)}`}>
                            {objective.importance === 'high' ? t('summary.importance.high') : objective.importance === 'medium' ? t('summary.importance.medium') : t('summary.importance.low')}
                          </span>
                        </div>
                        <p className={`text-gray-600 mb-3 ${objective.completed ? 'line-through text-gray-400' : ''}`}>
                          {objective.description}
                        </p>
                        
                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                            <span>{locale === 'vi' ? 'Tiến độ' : 'Progress'}</span>
                            <span>{(objective.progress || 0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(objective.progress || 0)}`}
                              style={{ width: `${objective.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        {/* Meta Info */}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            {objective.category}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {objective.estimatedTime || 30} {locale === 'vi' ? 'phút' : 'min'}
                          </span>
                          {objective.prerequisites.length > 0 && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {objective.prerequisites.length} {locale === 'vi' ? 'điều kiện' : 'prerequisites'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Progress Slider */}
                      <div className="flex flex-col items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={objective.progress || 0}
                          onChange={(e) => updateObjectiveProgress(objective.id, parseInt(e.target.value))}
                          className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        />
                        <span className="text-xs text-gray-500">{(objective.progress || 0)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  <div className="p-4 bg-gray-50">
                    {/* Sub-objectives */}
                    {objective.subObjectives.length > 0 && (
                      <div className="mb-4">
                        <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          {locale === 'vi' ? 'Mục tiêu con' : 'Sub-objectives'}
                        </h5>
                        <ul className="space-y-1">
                          {objective.subObjectives.map((subObj, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                              {subObj}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Prerequisites */}
                    {objective.prerequisites.length > 0 && (
                      <div className="mb-4">
                        <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          {locale === 'vi' ? 'Điều kiện tiên quyết' : 'Prerequisites'}
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {objective.prerequisites.map((prereq, idx) => (
                            <span key={idx} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                              {prereq}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Notes */}
                    <div>
                      <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {locale === 'vi' ? 'Ghi chú cá nhân' : 'Personal Notes'}
                      </h5>
                      <textarea
                        value={objectiveNotes[objective.id] || ''}
                        onChange={(e) => updateObjectiveNotes(objective.id, e.target.value)}
                        placeholder={locale === 'vi' ? 'Ghi chú về mục tiêu này...' : 'Notes about this objective...'}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'keypoints' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  {t('summary.keyPointsTitle')}
                </h3>
                <p className="text-gray-600">
                  {t('summary.keyPointsDesc')}
                </p>
              </div>
              
              {/* View Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMindMap(!showMindMap)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    showMindMap 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {showMindMap ? (locale === 'vi' ? 'Xem danh sách' : 'List View') : (locale === 'vi' ? 'Xem sơ đồ' : 'Mind Map')}
                </button>
              </div>
            </div>
            
            {showMindMap ? (
              /* Mind Map View */
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg">
                <div className="text-center mb-6">
                  <h4 className="text-xl font-bold text-gray-800 mb-2">
                    {locale === 'vi' ? 'Sơ đồ tư duy' : 'Mind Map'}
                  </h4>
                  <p className="text-gray-600">
                    {locale === 'vi' ? 'Mối quan hệ giữa các khái niệm chính' : 'Relationships between key concepts'}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {keyPoints.map((point, index) => (
                    <motion.div
                      key={point.id}
                      className="bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-gray-800">{point.content}</h5>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(point.difficulty)}`}>
                          {point.difficulty === 'basic' ? t('summary.difficulty.basic') : point.difficulty === 'intermediate' ? t('summary.difficulty.intermediate') : t('summary.difficulty.advanced')}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-3">
                        {point.explanation}
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {point.relatedConcepts.slice(0, 3).map((concept, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {concept}
                          </span>
                        ))}
                        {point.relatedConcepts.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            +{point.relatedConcepts.length - 3}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              /* List View */
              <div className="space-y-6">
                {keyPoints.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Lightbulb className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p>{t('study.keypoints.noKeyPoints')}</p>
                  </div>
                ) : (
                  keyPoints.map((point, index) => (
                  <motion.div
                    key={point.id}
                    className="border border-gray-200 rounded-lg hover:shadow-lg transition-all duration-300"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {/* Main Content */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg text-gray-800 mb-2">{point.content}</h4>
                          <p className="text-gray-600 mb-3">{point.explanation}</p>
                          
                          {/* Mastery Level */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                              <span>{locale === 'vi' ? 'Mức độ nắm vững' : 'Mastery Level'}</span>
                              <span className={getMasteryColor(keyPointMastery[point.id] || 0)}>
                                {keyPointMastery[point.id] || 0}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(keyPointMastery[point.id] || 0)}`}
                                style={{ width: `${keyPointMastery[point.id] || 0}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          {/* Meta Info */}
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded">
                              {point.category}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(point.difficulty)}`}>
                              {point.difficulty === 'basic' ? t('summary.difficulty.basic') : point.difficulty === 'intermediate' ? t('summary.difficulty.intermediate') : t('summary.difficulty.advanced')}
                            </span>
                            {point.examples.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                {point.examples.length} {locale === 'vi' ? 'ví dụ' : 'examples'}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Mastery Slider */}
                        <div className="flex flex-col items-center gap-2 ml-4">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={keyPointMastery[point.id] || 0}
                            onChange={(e) => updateKeyPointMastery(point.id, parseInt(e.target.value))}
                            className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                          />
                          <span className="text-xs text-gray-500">{keyPointMastery[point.id] || 0}%</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expandable Content */}
                    <div className="p-4 bg-gray-50">
                      <button
                        onClick={() => toggleKeyPointExpansion(point.id)}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-3"
                      >
                        {point.isExpanded ? (
                          <>
                            <span className="text-sm">▼</span>
                            {locale === 'vi' ? 'Thu gọn' : 'Collapse'}
                          </>
                        ) : (
                          <>
                            <span className="text-sm">▶</span>
                            {locale === 'vi' ? 'Mở rộng' : 'Expand'}
                          </>
                        )}
                      </button>
                      
                      {point.isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.3 }}
                          className="space-y-4"
                        >
                          {/* Examples */}
                          {point.examples.length > 0 && (
                            <div>
                              <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                                <Star className="w-4 h-4" />
                                {locale === 'vi' ? 'Ví dụ minh họa' : 'Examples'}
                              </h5>
                              <ul className="space-y-2">
                                {point.examples.map((example, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 bg-white p-3 rounded border">
                                    <span className="text-blue-500 mt-1">•</span>
                                    <span>{example}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Related Concepts */}
                          <div>
                            <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                              <BookOpen className="w-4 h-4" />
                              {t('summary.relatedConcepts')}
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {point.relatedConcepts.map((concept, idx) => (
                                <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                                  {concept}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          {/* Practice Questions */}
                          {point.practiceQuestions.length > 0 && (
                            <div>
                              <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                {locale === 'vi' ? 'Câu hỏi luyện tập' : 'Practice Questions'}
                              </h5>
                              <div className="space-y-2">
                                {point.practiceQuestions.map((question, idx) => (
                                  <div key={idx} className="bg-white p-3 rounded border">
                                    <p className="text-sm font-medium text-gray-800 mb-2">
                                      {idx + 1}. {question}
                                    </p>
                                    <textarea
                                      placeholder={locale === 'vi' ? 'Viết câu trả lời của bạn...' : 'Write your answer...'}
                                      className="w-full p-2 border border-gray-300 rounded text-sm resize-none"
                                      rows={2}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'insights' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="card p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {locale === 'vi' ? 'Phân tích và đánh giá chi tiết của AI' : 'Detailed AI Analysis and Evaluation'}
            </h3>
            
            {/* Đánh giá tổng quan */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {locale === 'vi' ? 'Điểm mạnh' : 'Strengths'}
                  </h4>
                  <ul className="text-blue-700 text-sm space-y-2">
                    {insights?.strengths?.length > 0 ? (
                      insights.strengths.map((strength: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{strength}</span>
                        </li>
                      ))
                    ) : (
                      <>
                        <li>• {locale === 'vi' ? 'Nội dung có cấu trúc rõ ràng' : 'Content has clear structure'}</li>
                        <li>• {locale === 'vi' ? 'Có nhiều ví dụ minh họa' : 'Has many illustrative examples'}</li>
                        <li>• {locale === 'vi' ? 'Kiến thức cập nhật và thực tế' : 'Updated and practical knowledge'}</li>
                      </>
                    )}
                  </ul>
                </div>
                
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    {locale === 'vi' ? 'Điểm cần cải thiện' : 'Areas for Improvement'}
                  </h4>
                  <ul className="text-yellow-700 text-sm space-y-2">
                    {insights?.improvements?.length > 0 ? (
                      insights.improvements.map((improvement: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-yellow-500 mt-1">•</span>
                          <span>{improvement}</span>
                        </li>
                      ))
                    ) : (
                      <>
                        <li>• {locale === 'vi' ? 'Có thể thêm bài tập thực hành' : 'Can add practical exercises'}</li>
                        <li>• {locale === 'vi' ? 'Cần bổ sung case study' : 'Need to supplement case studies'}</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    {locale === 'vi' ? 'Khuyến nghị học tập' : 'Learning Recommendations'}
                  </h4>
                  <ul className="text-green-700 text-sm space-y-2">
                    {insights?.recommendations?.length > 0 ? (
                      insights.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))
                    ) : (
                      <>
                        <li>• {locale === 'vi' ? 'Tập trung vào khái niệm cơ bản trước' : 'Focus on basic concepts first'}</li>
                        <li>• {locale === 'vi' ? 'Làm bài tập và thực hành' : 'Do exercises and practice'}</li>
                        <li>• {locale === 'vi' ? 'Ôn tập đều đặn' : 'Regular review'}</li>
                      </>
                    )}
                  </ul>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {locale === 'vi' ? 'Thời gian ước tính' : 'Estimated Time'}
                  </h4>
                  <div className="text-2xl font-bold text-purple-600">
                    {insights?.estimatedReadTime ? `${insights.estimatedReadTime} ${locale === 'vi' ? 'phút' : 'minutes'}` : locale === 'vi' ? '2-3 giờ' : '2-3 hours'}
                  </div>
                  <p className="text-sm text-purple-700">{locale === 'vi' ? 'Để nắm vững toàn bộ nội dung' : 'To master all content'}</p>
                </div>
              </div>
            </div>

            {/* Lộ trình học tập */}
            {insights?.learningPath && (
              <div className="mb-8">
                <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  {locale === 'vi' ? 'Lộ trình học tập theo cấp độ' : 'Learning Path by Level'}
                </h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50 rounded-lg">
                    <h5 className="font-semibold text-emerald-800 mb-3">{locale === 'vi' ? 'Người mới bắt đầu' : 'Beginner'}</h5>
                    <ul className="text-emerald-700 text-sm space-y-2">
                      {insights.learningPath.beginner.map((step: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-1 text-xs">→</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h5 className="font-semibold text-blue-800 mb-3">{locale === 'vi' ? 'Trung cấp' : 'Intermediate'}</h5>
                    <ul className="text-blue-700 text-sm space-y-2">
                      {insights.learningPath.intermediate.map((step: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-1 text-xs">→</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h5 className="font-semibold text-purple-800 mb-3">{locale === 'vi' ? 'Nâng cao' : 'Advanced'}</h5>
                    <ul className="text-purple-700 text-sm space-y-2">
                      {insights.learningPath.advanced.map((step: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-500 mt-1 text-xs">→</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Đánh giá và kiểm tra */}
            {insights?.assessment && (
              <div className="mb-8">
                <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  {locale === 'vi' ? 'Đánh giá và kiểm tra kiến thức' : 'Assessment and Knowledge Testing'}
                </h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <h5 className="font-semibold text-orange-800 mb-3">{locale === 'vi' ? 'Kiểm tra kiến thức' : 'Knowledge Check'}</h5>
                    <ul className="text-orange-700 text-sm space-y-2">
                      {insights.assessment.knowledgeCheck.map((question: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-orange-500 mt-1 text-xs">?</span>
                          <span>{question}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-teal-50 rounded-lg">
                    <h5 className="font-semibold text-teal-800 mb-3">{locale === 'vi' ? 'Bài tập thực hành' : 'Practice Exercises'}</h5>
                    <ul className="text-teal-700 text-sm space-y-2">
                      {insights.assessment.practicalTasks.map((task: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-teal-500 mt-1 text-xs">⚡</span>
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <h5 className="font-semibold text-indigo-800 mb-3">{locale === 'vi' ? 'Tư duy phản biện' : 'Critical Thinking'}</h5>
                    <ul className="text-indigo-700 text-sm space-y-2">
                      {insights.assessment.criticalThinking.map((question: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-indigo-500 mt-1 text-xs">💭</span>
                          <span>{question}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Tài nguyên bổ sung */}
            {insights?.resources && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  {locale === 'vi' ? 'Tài nguyên học tập bổ sung' : 'Additional Learning Resources'}
                </h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-rose-50 rounded-lg">
                    <h5 className="font-semibold text-rose-800 mb-3">{locale === 'vi' ? 'Tài liệu tham khảo' : 'References'}</h5>
                    <ul className="text-rose-700 text-sm space-y-2">
                      {insights.resources.additionalReading.map((resource: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-rose-500 mt-1 text-xs">📚</span>
                          <span>{resource}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-cyan-50 rounded-lg">
                    <h5 className="font-semibold text-cyan-800 mb-3">{locale === 'vi' ? 'Công cụ hỗ trợ' : 'Support Tools'}</h5>
                    <ul className="text-cyan-700 text-sm space-y-2">
                      {insights.resources.tools.map((tool: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-cyan-500 mt-1 text-xs">🛠️</span>
                          <span>{tool}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-lime-50 rounded-lg">
                    <h5 className="font-semibold text-lime-800 mb-3">{locale === 'vi' ? 'Cộng đồng học tập' : 'Learning Community'}</h5>
                    <ul className="text-lime-700 text-sm space-y-2">
                      {insights.resources.communities.map((community: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-lime-500 mt-1 text-xs">👥</span>
                          <span>{community}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            {/* Khái niệm chính */}
            {insights?.keyConcepts?.length > 0 && (
              <div className="p-4 bg-indigo-50 rounded-lg">
                <h4 className="font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  {locale === 'vi' ? 'Khái niệm chính cần nắm vững' : 'Key Concepts to Master'}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {insights.keyConcepts.map((concept: string, idx: number) => (
                    <span key={idx} className="bg-indigo-100 text-indigo-800 text-sm px-3 py-1 rounded-full">
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
