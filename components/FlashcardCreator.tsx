'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit3, Trash2, Sparkles, Brain } from 'lucide-react';
import LoadingProgress from './LoadingProgress';
import { useTranslations, useLocale } from 'next-intl';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

interface FlashcardCreatorProps {
  lectureData?: any;
}

const FlashcardCreator: React.FC<FlashcardCreatorProps> = ({ lectureData }) => {
  const t = useTranslations()
  const locale = useLocale()
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [hasLectureData, setHasLectureData] = useState(false);
  const [loadingState, setLoadingState] = useState({
    isVisible: false,
    currentStep: 'generating',
    progress: 0,
    estimatedTime: 30
  });

  // Load flashcards from database
  const loadFlashcardsFromDatabase = async () => {
    if (!lectureData?.id) return false
    
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (!user.id) return false
      
      const response = await fetch(`/api/flashcards?lectureId=${lectureData.id}&userId=${user.id}`)
      const data = await response.json()
      
      if (data.success && data.flashcards) {
        const convertedFlashcards = data.flashcards.map((card: any) => ({
          id: card.id,
          front: card.frontContent,
          back: card.backContent,
          category: card.category || 'general',
          difficulty: card.difficulty || 'medium',
          tags: []
        }))
        
        setFlashcards(convertedFlashcards)
        console.log('Flashcards loaded from database:', convertedFlashcards.length)
        return true
      }
    } catch (error) {
      console.error('Failed to load flashcards from database:', error)
    }
    return false
  }

  // Save flashcards to database
  const saveFlashcardsToDatabase = async (flashcardsToSave: Flashcard[]) => {
    if (!lectureData?.id) return
    
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (!user.id) return
      
      // Delete existing flashcards first
      const existingResponse = await fetch(`/api/flashcards?lectureId=${lectureData.id}&userId=${user.id}`)
      const existingData = await existingResponse.json()
      
      if (existingData.success && existingData.flashcards) {
        for (const card of existingData.flashcards) {
          await fetch(`/api/flashcards?flashcardId=${card.id}`, {
            method: 'DELETE'
          })
        }
      }
      
      // Save new flashcards
      for (const card of flashcardsToSave) {
        await fetch('/api/flashcards', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            lectureId: lectureData.id,
            front: card.front,
            back: card.back,
            category: card.category || 'general',
            difficulty: card.difficulty || 'medium'
          })
        })
      }
      
      console.log('Flashcards saved to database:', flashcardsToSave.length)
    } catch (error) {
      console.error('Failed to save flashcards to database:', error)
    }
  }

  // Tự động load flashcards từ database khi có lecture data mới
  useEffect(() => {
    const loadFlashcards = async () => {
      if (lectureData && lectureData.content && lectureData.content.length > 100) {
        setHasLectureData(true);
        
        // Try to load from database first
        const loaded = await loadFlashcardsFromDatabase();
        
        // If no flashcards in database, generate new ones
        if (!loaded) {
          console.log('No flashcards in database, generating new ones');
          generateFlashcardsFromContent();
        }
      }
    }
    
    loadFlashcards();
  }, [lectureData]);

  const generateFlashcardsFromContent = async () => {
    if (!lectureData?.content) {
      alert(t('flashcards.noLectureContent'));
      return;
    }

    setIsGeneratingFlashcards(true);
    
    // Show loading progress
    setLoadingState({
      isVisible: true,
      currentStep: 'generating',
      progress: 0,
      estimatedTime: 30
    });

    // Progress simulation
    const progressInterval = setInterval(() => {
      setLoadingState(prev => ({
        ...prev,
        progress: Math.min(prev.progress + 10, 90)
      }));
    }, 2000);

    try {
      const response = await fetch('/api/generate-flashcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': locale
        },
        body: JSON.stringify({
          text: lectureData.content,
          numCards: 9
        })
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Failed to generate flashcards');
      }

      const data = await response.json();
      
      if (data.flashcards && data.flashcards.length > 0) {
        const convertedFlashcards: Flashcard[] = data.flashcards.map((card: any) => ({
          id: card.id || Date.now() + Math.random().toString(),
          front: card.question || card.front || t('flashcards.question'),
          back: card.answer || card.back || t('flashcards.answer'),
          category: card.category || 'Tổng quan',
          difficulty: card.difficulty || 'medium',
          tags: card.tags || []
        }));
        
        setFlashcards(convertedFlashcards);
        
        // Save flashcards to database
        await saveFlashcardsToDatabase(convertedFlashcards);
      }

      // Update loading state to complete
      setLoadingState(prev => ({
        ...prev,
        currentStep: 'complete',
        progress: 100
      }));

      // Hide loading after a short delay
      setTimeout(() => {
        setLoadingState(prev => ({ ...prev, isVisible: false }));
      }, 1000);

    } catch (error) {
      clearInterval(progressInterval);
      console.error('Error generating flashcards:', error);
      alert(t('flashcards.errorCreatingFlashcards'));
      
      // Hide loading on error
      setLoadingState(prev => ({ ...prev, isVisible: false }));
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const addFlashcard = async () => {
    if (front.trim() && back.trim()) {
      const newFlashcard: Flashcard = {
        id: Date.now().toString(),
        front: front.trim(),
        back: back.trim(),
      };
      const updatedFlashcards = [...flashcards, newFlashcard];
      setFlashcards(updatedFlashcards);
      setFront('');
      setBack('');
      
      // Save to database
      await saveFlashcardsToDatabase(updatedFlashcards);
    }
  };

  const deleteFlashcard = async (id: string) => {
    const updatedFlashcards = flashcards.filter(card => card.id !== id);
    setFlashcards(updatedFlashcards);
    
    // Save to database
    await saveFlashcardsToDatabase(updatedFlashcards);
  };

  const startEditing = (flashcard: Flashcard) => {
    setEditingId(flashcard.id);
    setFront(flashcard.front);
    setBack(flashcard.back);
  };

  const saveEdit = async () => {
    if (editingId && front.trim() && back.trim()) {
      const updatedFlashcards = flashcards.map(card =>
        card.id === editingId
          ? { ...card, front: front.trim(), back: back.trim() }
          : card
      );
      setFlashcards(updatedFlashcards);
      setEditingId(null);
      setFront('');
      setBack('');
      
      // Save to database
      await saveFlashcardsToDatabase(updatedFlashcards);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFront('');
    setBack('');
  };

  if (isGeneratingFlashcards) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold mb-2 flex items-center justify-center gap-2">
            <Brain className="w-6 h-6" />
            {t('flashcards.aiCreatingSmartFlashcards')}
          </h3>
          <p className="text-gray-600">{t('flashcards.analyzingContent')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6">
      <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            {t('flashcards.title')} {t('common.with')} AI
          </h2>
          {hasLectureData && (
            <button
              onClick={generateFlashcardsFromContent}
              disabled={isGeneratingFlashcards}
              className="bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm sm:text-base w-full sm:w-auto"
            >
              <Brain className="w-4 h-4" />
              {t('flashcards.createWithAI')}
            </button>
          )}
        </div>
        
        {hasLectureData && flashcards.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg">
            <p className="text-green-700 text-xs sm:text-sm">
              ✨ AI {t('common.has')} {t('flashcards.generate')} {flashcards.length} {t('flashcards.title').toLowerCase()} {t('common.from')} {t('common.content')} {t('common.of')} {t('common.your')} {t('common.lecture')}!
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('flashcards.frontSide')}
            </label>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder={t('flashcards.enterQuestion')}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
              rows={3}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('flashcards.backSide')}
            </label>
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder={t('flashcards.enterAnswer')}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
              rows={3}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {editingId ? (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={saveEdit}
                className="bg-green-500 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base w-full sm:w-auto"
              >
                <Edit3 size={16} />
                {t('flashcards.saveChanges')}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={cancelEdit}
                className="bg-gray-500 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors text-sm sm:text-base w-full sm:w-auto"
              >
                {t('common.cancel')}
              </motion.button>
            </>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={addFlashcard}
              className="bg-blue-500 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base w-full sm:w-auto"
            >
              <Plus size={16} />
              {t('flashcards.addFlashcard')}
            </motion.button>
          )}
        </div>
      </div>

      {flashcards.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 lg:p-6">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">
            {t('flashcards.createdFlashcards')} ({flashcards.length})
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {flashcards.map((flashcard) => (
              <motion.div
                key={flashcard.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200 hover:shadow-md transition-shadow"
              >
                {/* Header with category and difficulty */}
                {(flashcard.category || flashcard.difficulty) && (
                  <div className="flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3">
                    {flashcard.category && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {flashcard.category}
                      </span>
                    )}
                    {flashcard.difficulty && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        flashcard.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                        flashcard.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {flashcard.difficulty === 'easy' ? t('flashcards.easy') : 
                         flashcard.difficulty === 'medium' ? t('flashcards.medium') : t('flashcards.hard')}
                      </span>
                    )}
                  </div>
                )}

                <div className="mb-2 sm:mb-3">
                  <h4 className="font-medium text-gray-800 mb-1 sm:mb-2 text-sm sm:text-base">{t('flashcards.question')}:</h4>
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{flashcard.front}</p>
                </div>
                
                <div className="mb-3 sm:mb-4">
                  <h4 className="font-medium text-gray-800 mb-1 sm:mb-2 text-sm sm:text-base">{t('flashcards.answer')}:</h4>
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{flashcard.back}</p>
                </div>

                {/* Tags */}
                {flashcard.tags && flashcard.tags.length > 0 && (
                  <div className="mb-2 sm:mb-3">
                    <div className="flex flex-wrap gap-1">
                      {flashcard.tags.map((tag, idx) => (
                        <span key={idx} className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditing(flashcard)}
                    className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                    title="Edit"
                  >
                    <Edit3 size={14} className="sm:w-4 sm:h-4" />
                  </button>
                  <button
                    onClick={() => deleteFlashcard(flashcard.id)}
                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} className="sm:w-4 sm:h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Loading Progress Modal */}
      <LoadingProgress
        isVisible={loadingState.isVisible}
        currentStep={loadingState.currentStep}
        progress={loadingState.progress}
        estimatedTime={loadingState.estimatedTime}
        onCancel={() => {
          setLoadingState(prev => ({ ...prev, isVisible: false }))
          // TODO: Implement actual cancellation logic
        }}
      />
    </div>
  );
};

export default FlashcardCreator;
