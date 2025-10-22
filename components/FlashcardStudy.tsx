'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, CheckCircle, XCircle, ArrowLeft, ArrowRight, BookOpen, Brain, Target, Plus } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import FlashcardManager from './FlashcardManager';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

interface FlashcardStudyProps {
  lectureData?: any;
}

const FlashcardStudy: React.FC<FlashcardStudyProps> = ({ lectureData }) => {
  const t = useTranslations()
  const locale = useLocale()
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState<'study' | 'review' | 'test' | 'manage'>('study');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [studyProgress, setStudyProgress] = useState({
    totalCards: 0,
    studiedCards: 0,
    correctAnswers: 0,
    incorrectAnswers: 0
  });
  const [cardResults, setCardResults] = useState<{[key: string]: 'correct' | 'incorrect' | 'unknown'}>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Management states
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [editingFlashcard, setEditingFlashcard] = useState<Flashcard | null>(null);

  // Load current user
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
  }, []);

  // Study progress tracking functions
  const trackActivity = async (activityType: string, tabName: string, progressValue?: number, duration?: number, metadata?: any) => {
    if (!currentUser?.id || !lectureData?.id) {
      console.log('⚠️ Cannot track activity: missing user or lecture data');
      return;
    }

    try {
      console.log(`📝 Tracking activity: ${activityType} in ${tabName} tab with progressValue: ${progressValue}`);
      
      const response = await fetch('/api/study-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.id,
          lectureId: lectureData.id,
          activityType,
          tabName,
          progressValue,
          duration,
          metadata
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('✅ Activity tracked successfully:', data.studyProgress);
        } else {
          console.error('❌ Failed to track activity:', data.message);
        }
      } else {
        console.error('❌ HTTP error tracking activity:', response.status);
      }
    } catch (error) {
      console.error('❌ Error tracking activity:', error);
    }
  };

  const trackTabVisit = (tabName: string) => {
    trackActivity('tab_visit', tabName, 50);
  };

  const trackFlashcardStudy = (action: string, cardId?: string) => {
    let progressValue = 5; // Default for other actions
    
    if (action === 'flip_card') {
      progressValue = 10; // Flipping a card = 10%
    } else if (action === 'mark_correct') {
      progressValue = 15; // Marking correct = 15%
    } else if (action === 'mark_incorrect') {
      progressValue = 5; // Marking incorrect = 5%
    } else if (action === 'complete_study') {
      progressValue = 25; // Completing study = 25%
    }
    
    trackActivity('interaction', 'flashcard', progressValue, undefined, { 
      action,
      cardId,
      timestamp: new Date().toISOString()
    });
  };

  // Track tab visit when component mounts
  useEffect(() => {
    if (lectureData?.id && currentUser?.id) {
      trackTabVisit('flashcard');
    }
  }, [lectureData?.id, currentUser?.id]);

  // Load flashcards from database
  useEffect(() => {
    const loadFlashcards = async () => {
      if (!lectureData?.id) return;
      
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.id) return;
        
        console.log('🔍 Loading flashcards for lecture:', lectureData.id, 'user:', user.id);
        const response = await fetch(`/api/flashcards?lectureId=${lectureData.id}&userId=${user.id}`);
        const data = await response.json();
        
        console.log('📊 Flashcards API response:', data);
        
        if (data.success && data.flashcards) {
          const convertedFlashcards = data.flashcards.map((card: any) => ({
            id: card.id,
            front: card.frontContent,
            back: card.backContent,
            category: card.category || 'general',
            difficulty: card.difficulty || 'medium',
            tags: []
          }));
          setFlashcards(convertedFlashcards);
          setStudyProgress(prev => ({ ...prev, totalCards: convertedFlashcards.length }));
        }
      } catch (error) {
        console.error('Error loading flashcards:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFlashcards();
  }, [lectureData?.id]);

  const currentCard = flashcards[currentCardIndex];

  const flipCard = () => {
    setIsFlipped(!isFlipped);
    if (!isFlipped) {
      trackFlashcardStudy('flip_card', currentCard?.id);
    }
  };

  const markCard = (result: 'correct' | 'incorrect') => {
    if (!currentCard) return;
    
    setCardResults(prev => ({ ...prev, [currentCard.id]: result }));
    
    if (result === 'correct') {
      setStudyProgress(prev => ({
        ...prev,
        studiedCards: prev.studiedCards + 1,
        correctAnswers: prev.correctAnswers + 1
      }));
      trackFlashcardStudy('mark_correct', currentCard.id);
    } else {
      setStudyProgress(prev => ({
        ...prev,
        studiedCards: prev.studiedCards + 1,
        incorrectAnswers: prev.incorrectAnswers + 1
      }));
      trackFlashcardStudy('mark_incorrect', currentCard.id);
    }
    
    // Auto move to next card after marking
    setTimeout(() => {
      if (currentCardIndex < flashcards.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
        setIsFlipped(false);
      }
    }, 1000); // Wait 1 second before moving
  };

  const nextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  };

  const resetStudy = () => {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setCardResults({});
    setStudyProgress(prev => ({
      ...prev,
      studiedCards: 0,
      correctAnswers: 0,
      incorrectAnswers: 0
    }));
  };

  const completeStudy = () => {
    trackFlashcardStudy('complete_study');
  };

  // Management functions
  const handleAddFlashcard = async (flashcard: Flashcard) => {
    try {
      const response = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          lectureId: lectureData.id,
          front: flashcard.front,
          back: flashcard.back,
          category: flashcard.category,
          difficulty: flashcard.difficulty
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const newFlashcard = {
            id: data.flashcard.id,
            front: data.flashcard.frontContent,
            back: data.flashcard.backContent,
            category: data.flashcard.category,
            difficulty: data.flashcard.difficulty,
            tags: []
          };
          setFlashcards(prev => [...prev, newFlashcard]);
          setStudyProgress(prev => ({ ...prev, totalCards: prev.totalCards + 1 }));
          trackFlashcardStudy('create', newFlashcard.id);
        }
      }
    } catch (error) {
      console.error('Error adding flashcard:', error);
    }
  };

  const handleUpdateFlashcard = async (flashcard: Flashcard) => {
    try {
      const response = await fetch(`/api/flashcards/${flashcard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          front: flashcard.front,
          back: flashcard.back,
          category: flashcard.category,
          difficulty: flashcard.difficulty
        })
      });
      
      if (response.ok) {
        setFlashcards(prev => prev.map(card => 
          card.id === flashcard.id ? flashcard : card
        ));
        trackFlashcardStudy('update', flashcard.id);
      }
    } catch (error) {
      console.error('Error updating flashcard:', error);
    }
  };

  const handleDeleteFlashcard = async (cardId: string) => {
    try {
      const response = await fetch(`/api/flashcards/${cardId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setFlashcards(prev => prev.filter(card => card.id !== cardId));
        setStudyProgress(prev => ({ ...prev, totalCards: prev.totalCards - 1 }));
        trackFlashcardStudy('delete', cardId);
      }
    } catch (error) {
      console.error('Error deleting flashcard:', error);
    }
  };

  const openManager = (flashcard?: Flashcard) => {
    setEditingFlashcard(flashcard || null);
    setIsManagerOpen(true);
  };

  const closeManager = () => {
    setIsManagerOpen(false);
    setEditingFlashcard(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Đang tải flashcards...</span>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🃏</div>
        <h3 className="text-xl font-semibold mb-2">Chưa có flashcards</h3>
        <p className="text-gray-600 mb-4">Giáo viên chưa tạo flashcards cho bài giảng này.</p>
        <p className="text-sm text-gray-500">Vui lòng liên hệ giáo viên để được tạo flashcards.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Study Progress */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Tiến độ học tập</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setStudyMode('study')}
              className={`px-3 py-1 rounded text-sm ${studyMode === 'study' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}
            >
              <BookOpen className="w-4 h-4 inline mr-1" />
              Học
            </button>
            <button
              onClick={() => setStudyMode('review')}
              className={`px-3 py-1 rounded text-sm ${studyMode === 'review' ? 'bg-green-100 text-green-700' : 'text-gray-600'}`}
            >
              <Brain className="w-4 h-4 inline mr-1" />
              Ôn tập
            </button>
            <button
              onClick={() => setStudyMode('test')}
              className={`px-3 py-1 rounded text-sm ${studyMode === 'test' ? 'bg-red-100 text-red-700' : 'text-gray-600'}`}
            >
              <Target className="w-4 h-4 inline mr-1" />
              Kiểm tra
            </button>
            <button
              onClick={() => setStudyMode('manage')}
              className={`px-3 py-1 rounded text-sm ${studyMode === 'manage' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'}`}
            >
              <BookOpen className="w-4 h-4 inline mr-1" />
              Quản lý
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{studyProgress.totalCards}</div>
            <div className="text-sm text-gray-600">Tổng số card</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{studyProgress.studiedCards}</div>
            <div className="text-sm text-gray-600">Đã học</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{studyProgress.correctAnswers}</div>
            <div className="text-sm text-gray-600">Đúng</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{studyProgress.incorrectAnswers}</div>
            <div className="text-sm text-gray-600">Sai</div>
          </div>
        </div>
      </div>

      {/* Flashcard */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="text-center mb-4">
          <span className="text-sm text-gray-500">
            Card {currentCardIndex + 1} / {flashcards.length}
          </span>
        </div>

        <motion.div
          className="relative h-64 cursor-pointer"
          onClick={flipCard}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg border-2 border-blue-200 p-6 flex items-center justify-center"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.6 }}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="text-center">
              <div className="text-sm text-blue-600 mb-2">Mặt trước</div>
              <div className="text-lg font-medium">{currentCard?.front}</div>
            </div>
          </motion.div>
          
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg border-2 border-green-200 p-6 flex items-center justify-center"
            animate={{ rotateY: isFlipped ? 0 : 180 }}
            transition={{ duration: 0.6 }}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="text-center">
              <div className="text-sm text-green-600 mb-2">Mặt sau</div>
              <div className="text-lg font-medium">{currentCard?.back}</div>
            </div>
          </motion.div>
        </motion.div>

        <div className="text-center mt-4">
          <button
            onClick={flipCard}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            {isFlipped ? 'Xem câu hỏi' : 'Xem đáp án'}
          </button>
        </div>
      </div>

      {/* Study Actions */}
      {isFlipped && (
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="text-center mb-4">
            <p className="text-gray-600">Bạn có nhớ đáp án này không?</p>
          </div>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => markCard('incorrect')}
              className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Không nhớ
            </button>
            <button
              onClick={() => markCard('correct')}
              className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Nhớ rồi
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={prevCard}
          disabled={currentCardIndex === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4" />
          Trước
        </button>

        <div className="flex gap-2">
          <button
            onClick={resetStudy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            <RotateCcw className="w-4 h-4" />
            Làm lại
          </button>
          
          {studyProgress.studiedCards === studyProgress.totalCards && studyProgress.totalCards > 0 && (
            <button
              onClick={completeStudy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600"
            >
              <CheckCircle className="w-4 h-4" />
              Hoàn thành
            </button>
          )}
        </div>

        <button
          onClick={nextCard}
          disabled={currentCardIndex === flashcards.length - 1}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Sau
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Management Mode */}
      {studyMode === 'manage' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Quản lý Flashcards</h3>
            <button
              onClick={() => openManager()}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Quản lý Flashcards
            </button>
          </div>

          {/* Flashcards List */}
          <div className="space-y-4">
            {flashcards.map((card, index) => (
              <div key={card.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Mặt trước</div>
                        <div className="font-medium">{card.front}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Mặt sau</div>
                        <div className="font-medium">{card.back}</div>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-3 text-sm text-gray-500">
                      <span>Danh mục: {card.category}</span>
                      <span>Độ khó: {card.difficulty}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => openManager(card)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="Chỉnh sửa"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteFlashcard(card.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Xóa"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flashcard Manager Modal */}
      <FlashcardManager
        isOpen={isManagerOpen}
        onClose={closeManager}
        onSave={handleAddFlashcard}
        onUpdate={handleUpdateFlashcard}
        onDelete={handleDeleteFlashcard}
        editingFlashcard={editingFlashcard}
        flashcards={flashcards}
      />
    </div>
  );
};

export default FlashcardStudy;
