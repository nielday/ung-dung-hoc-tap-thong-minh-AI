'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Edit3, Trash2, Save, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

interface FlashcardManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (flashcard: Flashcard) => void;
  onUpdate: (flashcard: Flashcard) => void;
  onDelete: (id: string) => void;
  editingFlashcard?: Flashcard | null;
  flashcards: Flashcard[];
}

const FlashcardManager: React.FC<FlashcardManagerProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onDelete,
  editingFlashcard,
  flashcards
}) => {
  const t = useTranslations();
  const [front, setFront] = useState(editingFlashcard?.front || '');
  const [back, setBack] = useState(editingFlashcard?.back || '');
  const [category, setCategory] = useState(editingFlashcard?.category || '');
  const [difficulty, setDifficulty] = useState(editingFlashcard?.difficulty || 'medium');
  const [tags, setTags] = useState(editingFlashcard?.tags?.join(', ') || '');

  const handleSave = () => {
    if (front.trim() && back.trim()) {
      const flashcardData: Flashcard = {
        id: editingFlashcard?.id || Date.now().toString(),
        front: front.trim(),
        back: back.trim(),
        category: category.trim() || undefined,
        difficulty: difficulty as 'easy' | 'medium' | 'hard',
        tags: tags.trim() ? tags.split(',').map(tag => tag.trim()) : []
      };

      if (editingFlashcard) {
        onUpdate(flashcardData);
      } else {
        onSave(flashcardData);
      }

      // Reset form
      setFront('');
      setBack('');
      setCategory('');
      setDifficulty('medium');
      setTags('');
      onClose();
    }
  };

  const handleCancel = () => {
    setFront('');
    setBack('');
    setCategory('');
    setDifficulty('medium');
    setTags('');
    onClose();
  };

  const handleDelete = (id: string) => {
    if (confirm(t('flashcards.confirmDelete'))) {
      onDelete(id);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <Edit3 className="w-5 h-5" />
                {editingFlashcard ? t('flashcards.editFlashcard') : t('flashcards.addNewFlashcard')}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Front and Back */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('flashcards.frontSide')} *
                  </label>
                  <textarea
                    value={front}
                    onChange={(e) => setFront(e.target.value)}
                    placeholder={t('flashcards.enterQuestion')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('flashcards.backSide')} *
                  </label>
                  <textarea
                    value={back}
                    onChange={(e) => setBack(e.target.value)}
                    placeholder={t('flashcards.enterAnswer')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>
              </div>

              {/* Category and Difficulty */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('flashcards.category')}
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder={t('flashcards.enterCategory')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('flashcards.difficulty')}
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="easy">{t('flashcards.easy')}</option>
                    <option value="medium">{t('flashcards.medium')}</option>
                    <option value="hard">{t('flashcards.hard')}</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('flashcards.tags')}
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder={t('flashcards.enterTags')}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">{t('flashcards.tagsHint')}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={!front.trim() || !back.trim()}
                  className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {editingFlashcard ? t('flashcards.updateFlashcard') : t('flashcards.addFlashcard')}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCancel}
                  className="flex-1 bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('common.cancel')}
                </motion.button>
              </div>
            </div>

            {/* Existing Flashcards List */}
            {flashcards.length > 0 && (
              <div className="border-t border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {t('flashcards.existingFlashcards')} ({flashcards.length})
                </h3>
                
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {flashcards.map((flashcard) => (
                    <div
                      key={flashcard.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-2 mb-2">
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
                          
                          <div className="mb-2">
                            <h4 className="font-medium text-gray-800 text-sm mb-1">{t('flashcards.question')}:</h4>
                            <p className="text-gray-600 text-sm">{flashcard.front}</p>
                          </div>
                          
                          <div className="mb-2">
                            <h4 className="font-medium text-gray-800 text-sm mb-1">{t('flashcards.answer')}:</h4>
                            <p className="text-gray-600 text-sm">{flashcard.back}</p>
                          </div>

                          {flashcard.tags && flashcard.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {flashcard.tags.map((tag, idx) => (
                                <span key={idx} className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => {
                              setFront(flashcard.front);
                              setBack(flashcard.back);
                              setCategory(flashcard.category || '');
                              setDifficulty(flashcard.difficulty || 'medium');
                              setTags(flashcard.tags?.join(', ') || '');
                            }}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                            title={t('flashcards.edit')}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(flashcard.id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                            title={t('flashcards.delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FlashcardManager;
