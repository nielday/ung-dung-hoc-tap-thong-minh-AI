import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Settings, RefreshCw, AlertCircle } from 'lucide-react';

interface ChatLimitManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StudentLimit {
  id: string;
  name: string;
  email: string;
  dailyLimit: number;
  usedCount: number;
  remainingCount: number;
  canChat: boolean;
  lastResetDate: string;
}

const ChatLimitManager: React.FC<ChatLimitManagerProps> = ({ isOpen, onClose }) => {
  const [students, setStudents] = useState<StudentLimit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState<number>(3);

  // Load students with their chat limits
  const loadStudents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/students');
      const data = await response.json();
      
      if (data.success) {
        // Load chat limits for each student
        const studentsWithLimits = await Promise.all(
          data.students.map(async (student: any) => {
            try {
              const limitResponse = await fetch(`/api/chat-limit?userId=${student.id}&t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                  'Pragma': 'no-cache',
                  'Expires': '0'
                }
              });
              const limitData = await limitResponse.json();
              
              console.log(`🔍 Chat limit for student ${student.id}:`, limitData);
              
              return {
                id: student.id,
                name: student.name,
                email: student.email,
                dailyLimit: limitData.success ? limitData.chatLimit.dailyLimit : 3,
                usedCount: limitData.success ? limitData.chatLimit.usedCount : 0,
                remainingCount: limitData.success ? limitData.chatLimit.remainingCount : 3,
                canChat: limitData.success ? limitData.chatLimit.canChat : true,
                lastResetDate: limitData.success ? limitData.chatLimit.lastResetDate : new Date().toISOString()
              };
            } catch (error) {
              console.error(`Error loading limit for student ${student.id}:`, error);
              return {
                id: student.id,
                name: student.name,
                email: student.email,
                dailyLimit: 3,
                usedCount: 0,
                remainingCount: 3,
                canChat: true,
                lastResetDate: new Date().toISOString()
              };
            }
          })
        );
        
        setStudents(studentsWithLimits);
      }
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Force refresh all chat limits
  const forceRefresh = async () => {
    await loadStudents();
  };

  // Update student's chat limit
  const updateStudentLimit = async (studentId: string, limit: number) => {
    try {
      const response = await fetch('/api/chat-limit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: studentId,
          dailyLimit: limit
        })
      });

      if (response.ok) {
        // Reload students
        await loadStudents();
        setEditingStudent(null);
      }
    } catch (error) {
      console.error('Error updating student limit:', error);
    }
  };

  // Reset all students' limits
  const resetAllLimits = async () => {
    try {
      setIsLoading(true);
      await Promise.all(
        students.map(student => 
          fetch('/api/chat-limit', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: student.id,
              dailyLimit: student.dailyLimit
            })
          })
        )
      );
      
      await loadStudents();
    } catch (error) {
      console.error('Error resetting limits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStudents();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-4xl mx-3 sm:mx-4 max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800">
              Quản lý giới hạn Chat AI
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={forceRefresh}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-1 text-xs sm:text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm sm:text-base text-blue-800">
              <p className="font-medium mb-1">Thông tin về giới hạn Chat AI:</p>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                <li>Mỗi sinh viên được phép chat AI tối đa 3 lần/ngày (có thể điều chỉnh)</li>
                <li>Giới hạn sẽ tự động reset vào 00:00 mỗi ngày</li>
                <li>Tính năng tìm kiếm không bị giới hạn</li>
                <li>Quiz và các tính năng khác không bị ảnh hưởng</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-6">
          <button
            onClick={loadStudents}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          
          <button
            onClick={resetAllLimits}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Reset tất cả
          </button>
        </div>

        {/* Students List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Đang tải...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Chưa có sinh viên nào</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {students.map((student) => (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    {/* Student Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-800 text-sm sm:text-base truncate">
                        {student.name}
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">
                        {student.email}
                      </p>
                    </div>

                    {/* Chat Limit Info */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                      <div className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium ${
                        student.canChat 
                          ? 'bg-green-100 text-green-700 border border-green-200' 
                          : 'bg-red-100 text-red-700 border border-red-200'
                      }`}>
                        <div className="flex items-center gap-1">
                          <span>Chat AI:</span>
                          <span className="font-semibold">
                            {student.remainingCount}/{student.dailyLimit}
                          </span>
                          <span>lượt</span>
                        </div>
                        {!student.canChat && (
                          <div className="text-xs mt-1">
                            Hết lượt hôm nay
                          </div>
                        )}
                      </div>

                      {/* Edit Limit */}
                      {editingStudent === student.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={newLimit}
                            onChange={(e) => setNewLimit(parseInt(e.target.value))}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <button
                            onClick={() => updateStudentLimit(student.id, newLimit)}
                            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingStudent(null)}
                            className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingStudent(student.id);
                            setNewLimit(student.dailyLimit);
                          }}
                          className="px-2 sm:px-3 py-1 bg-blue-500 text-white rounded text-xs sm:text-sm hover:bg-blue-600 transition-colors"
                        >
                          Chỉnh sửa
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-3">
            <p className="text-xs sm:text-sm text-gray-600">
              Tổng số sinh viên: {students.length}
            </p>
            <button
              onClick={onClose}
              className="px-4 sm:px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              Đóng
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ChatLimitManager;
