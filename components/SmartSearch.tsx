'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, BookOpen, FileText, Lightbulb, Send, Bot, User, MessageCircle, Copy, ThumbsUp, ThumbsDown, RefreshCw, MoreVertical } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import ReactMarkdown from 'react-markdown';

interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: 'lecture' | 'flashcard' | 'note';
  relevance: number;
  position: number;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  quiz?: any;
  results?: any;
  isRegenerating?: boolean;
}

interface SmartSearchProps {
  lectureData?: any;
}

const SmartSearch: React.FC<SmartSearchProps> = ({ lectureData }) => {
  const t = useTranslations()
  const locale = useLocale()
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'chat'>('search');
  
  // Chat functionality
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [showMessageActions, setShowMessageActions] = useState<string | null>(null);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const chatContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Chat limit functionality
  const [chatLimit, setChatLimit] = useState<{
    dailyLimit: number;
    usedCount: number;
    remainingCount: number;
    canChat: boolean;
    lastResetDate: string;
  } | null>(null);
  const [isLoadingLimit, setIsLoadingLimit] = useState(false);
  
  // Quiz functionality
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<{[key: string]: number}>({});
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  
  // Quiz settings
  const [showQuizSettings, setShowQuizSettings] = useState(false);
  const [quizSettings, setQuizSettings] = useState({
    questionCount: 8,
    difficulty: 'mixed', // 'easy', 'intermediate', 'hard', 'mixed'
    questionTypes: ['definition', 'analysis', 'application', 'synthesis']
  });

  // Study progress tracking
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [tabStartTime, setTabStartTime] = useState<{[key: string]: number}>({});
  const [scrollPositions, setScrollPositions] = useState<{[key: string]: number}>({});

  // Load chat limit
  const loadChatLimit = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id || isChatting) return; // Don't load when chatting

      setIsLoadingLimit(true);
      const response = await fetch(`/api/chat-limit?userId=${user.id}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Chat limit loaded from server:', data.chatLimit);
        setChatLimit(data.chatLimit);
      } else {
        console.error('❌ Failed to load chat limit:', data);
      }
    } catch (error) {
      console.error('Error loading chat limit:', error);
    } finally {
      setIsLoadingLimit(false);
    }
  };

  // Load chat limit when component mounts
  useEffect(() => {
    loadChatLimit();
    
    // Load current user
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
      console.log(`📝 Tracking activity: ${activityType} in ${tabName} tab`);
      
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

  const trackScrollProgress = (element: HTMLElement, tabName: string) => {
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight - element.clientHeight;
    const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    
    // Chỉ track khi scroll đáng kể (tránh spam)
    const lastPosition = scrollPositions[tabName] || 0;
    if (Math.abs(progress - lastPosition) > 5) {
      setScrollPositions(prev => ({ ...prev, [tabName]: progress }));
      trackActivity('scroll', tabName, progress);
    }
  };

  const trackTabVisit = (tabName: string) => {
    trackActivity('tab_visit', tabName, 10);
    setTabStartTime(prev => ({ ...prev, [tabName]: Date.now() }));
  };

  const trackTimeSpent = (tabName: string) => {
    const startTime = tabStartTime[tabName];
    if (startTime) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      if (duration > 5) { // Chỉ track nếu dành hơn 5 giây
        trackActivity('time_spent', tabName, undefined, duration);
      }
    }
  };

  // Refresh chat limit every 10 minutes when not chatting (reduced frequency)
  useEffect(() => {
    if (!isChatting) {
      const interval = setInterval(() => {
        loadChatLimit();
      }, 10 * 60 * 1000); // 10 minutes instead of 5
      
      return () => clearInterval(interval);
    }
  }, [isChatting]);

  // Initialize chat with welcome message
  useEffect(() => {
    if (lectureData && chatMessages.length === 0) {
      const currentHour = new Date().getHours();
      let greeting = '';
      
      if (locale === 'vi') {
        if (currentHour < 12) {
          greeting = 'Chào buổi sáng! 🌅';
        } else if (currentHour < 17) {
          greeting = 'Chào buổi chiều! ☀️';
        } else {
          greeting = 'Chào buổi tối! 🌙';
        }
      } else {
        if (currentHour < 12) {
          greeting = 'Good morning! 🌅';
        } else if (currentHour < 17) {
          greeting = 'Good afternoon! ☀️';
        } else {
          greeting = 'Good evening! 🌙';
        }
      }
      
      // Tạo tên chủ đề thông minh từ filename
      const getSmartTopicName = (filename: string) => {
        const name = filename.toLowerCase();
        
        // Xử lý các trường hợp đặc biệt
        if (name.includes('putin') || name.includes('vladimir')) {
          return locale === 'vi' ? 'Vladimir Putin' : 'Vladimir Putin';
        }
        if (name.includes('test-')) {
          return locale === 'vi' ? 'bài học này' : 'this lesson';
        }
        if (name.includes('.txt') || name.includes('.docx') || name.includes('.pdf')) {
          // Loại bỏ extension và tạo tên thông minh
          const cleanName = name.replace(/\.(txt|docx|pdf)$/, '');
          if (cleanName.length > 20) {
            return locale === 'vi' ? 'bài học này' : 'this lesson';
          }
          return cleanName;
        }
        
        return locale === 'vi' ? 'bài học này' : 'this lesson';
      };
      
      const smartTopicName = getSmartTopicName(lectureData.filename || '');
      
      const welcomeMessage = locale === 'vi' 
        ? `${greeting} Mình là AI trợ lý học tập của bạn! 😊\n\nMình đã sẵn sàng giúp bạn tìm hiểu về ${smartTopicName}. Bạn có thể:\n\n• Hỏi mình về nội dung bài giảng\n• Yêu cầu mình tóm tắt các điểm chính\n• Tạo quiz tương tác để kiểm tra kiến thức\n• Tìm hiểu phương pháp học tập hiệu quả\n• Hoặc đơn giản là trò chuyện với mình!\n\nBạn muốn bắt đầu từ đâu?`
        : `${greeting} I'm your AI learning assistant! 😊\n\nI'm ready to help you learn about ${smartTopicName}! You can:\n\n• Ask me about the lecture content\n• Ask me to summarize the main points\n• Create interactive quizzes to test your knowledge\n• Learn effective study methods\n• Or simply chat with me!\n\nWhere would you like to start?`;
      
      // Set welcome message
      setChatMessages([{
          id: '1',
          type: 'ai',
          content: welcomeMessage,
          timestamp: new Date()
        }]);
    }
  }, [lectureData, locale]);


  // Message actions
  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const regenerateMessage = async (messageId: string) => {
    const messageIndex = chatMessages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const userMessage = chatMessages[messageIndex - 1];
    if (!userMessage || userMessage.type !== 'user') return;

    setRegeneratingMessageId(messageId);
    
    // Remove the AI message and regenerate
    const newMessages = chatMessages.slice(0, messageIndex);
    setChatMessages(newMessages);
    
    // Call handleChat with the user's original message
    setChatInput(userMessage.content);
    // Trigger handleChat by simulating the input change
    setTimeout(() => {
      handleChat();
    }, 100);
    
    setRegeneratingMessageId(null);
  };

  const rateMessage = (messageId: string, rating: 'like' | 'dislike') => {
    // You could implement rating functionality here
    console.log(`Rated message ${messageId} as ${rating}`);
  };


  // Reset chat messages when locale changes
  useEffect(() => {
    if (lectureData && chatMessages.length > 0) {
      // Clear existing messages and reinitialize with new locale
      setChatMessages([]);
    }
  }, [locale]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isChatting]);

  // Track tab switching
  useEffect(() => {
    if (activeTab === 'search') {
      trackTabVisit('search');
    } else if (activeTab === 'chat') {
      trackTabVisit('chat');
    }
  }, [activeTab]);

  // Track scroll in chat area
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer && activeTab === 'chat') {
      const handleScroll = () => {
        trackScrollProgress(chatContainer, 'chat');
      };
      
      chatContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => chatContainer.removeEventListener('scroll', handleScroll);
    }
  }, [activeTab]);

  // Track time spent when leaving tab
  useEffect(() => {
    return () => {
      // Track time spent when component unmounts
      Object.keys(tabStartTime).forEach(tabName => {
        trackTimeSpent(tabName);
      });
    };
  }, []);

  // Enhanced conversation memory and context tracking
  const getConversationContext = () => {
    if (chatMessages.length === 0) return '';
    
    // Get last 3 messages for context
    const recentMessages = chatMessages.slice(-3);
    return recentMessages.map(msg => `${msg.type}: ${msg.content}`).join('\n');
  };

  // Smart response enhancement based on conversation history
  const enhanceResponseWithContext = (response: string) => {
    const context = getConversationContext();
    if (context.includes('quiz') || context.includes('test')) {
      return locale === 'vi'
        ? `${response}\n\n💡 **Gợi ý**: Bạn có muốn mình tạo thêm quiz về chủ đề khác không?`
        : `${response}\n\n💡 **Suggestion**: Would you like me to create more quizzes on other topics?`;
    }
    if (context.includes('flashcard') || context.includes('memorize')) {
      return locale === 'vi'
        ? `${response}\n\n💡 **Gợi ý**: Bạn có muốn mình tạo thêm flashcard cho các khái niệm khác không?`
        : `${response}\n\n💡 **Suggestion**: Would you like me to create more flashcards for other concepts?`;
    }
    return response;
  };

  const handleSearch = async () => {
    if (!query.trim() || !lectureData) return;
    
    setIsSearching(true);
    
    // Track search interaction
    trackActivity('interaction', 'search', 25, undefined, { 
      searchQuery: query,
      timestamp: new Date().toISOString()
    });
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Real search in lecture content
    const searchResults: SearchResult[] = [];
    const content = lectureData.content || '';
    const summary = lectureData.summary || '';
    
    // Search in main content
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    
    if (contentLower.includes(queryLower)) {
      const position = contentLower.indexOf(queryLower);
      const start = Math.max(0, position - 100);
      const end = Math.min(content.length, position + query.length + 100);
      const excerpt = content.substring(start, end);
      
      searchResults.push({
        id: 'content-1',
        title: locale === 'vi' ? 'Nội dung chính' : 'Main Content',
        content: excerpt,
        type: 'lecture',
        relevance: 95,
        position: position
      });
    }
    
    // Search in summary
    if (summary.toLowerCase().includes(queryLower)) {
      searchResults.push({
        id: 'summary-1',
        title: locale === 'vi' ? 'Tóm tắt bài giảng' : 'Lecture Summary',
        content: summary,
        type: 'note',
        relevance: 90,
        position: 0
      });
    }
    
    // Search in key points if available
    if (lectureData.keyPoints) {
      lectureData.keyPoints.forEach((point: any, index: number) => {
        if (point.content.toLowerCase().includes(queryLower)) {
          searchResults.push({
            id: `keypoint-${index}`,
            title: locale === 'vi' ? `Điểm chính ${index + 1}` : `Key Point ${index + 1}`,
            content: point.content,
            type: 'flashcard',
            relevance: 85,
            position: index
          });
        }
      });
    }
    
    // Sort by relevance
    searchResults.sort((a, b) => b.relevance - a.relevance);
    
    setResults(searchResults);
    setIsSearching(false);
  };

  const handleSuggestionChat = async (suggestionText: string) => {
    if (!suggestionText.trim() || !lectureData || isChatting) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: suggestionText,
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setIsChatting(true);
    
    try {
      // Get current user
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Check if user wants to create quiz
      const isQuizRequest = suggestionText.toLowerCase().includes('quiz') || 
                           suggestionText.toLowerCase().includes('câu hỏi') || 
                           suggestionText.toLowerCase().includes('kiểm tra') ||
                           suggestionText.toLowerCase().includes('test');
      
      // Auto-detect difficulty and question count from user input
      const userMessageLower = suggestionText.toLowerCase();
      let detectedDifficulty = quizSettings.difficulty;
      let detectedQuestionCount = quizSettings.questionCount;
      
      // Detect difficulty keywords
      if (userMessageLower.includes('khó') || userMessageLower.includes('hard') || 
          userMessageLower.includes('difficult') || userMessageLower.includes('thử thách') ||
          userMessageLower.includes('phức tạp') || userMessageLower.includes('nâng cao') ||
          userMessageLower.includes('khó khăn') || userMessageLower.includes('challenging')) {
        detectedDifficulty = 'hard';
      } else if (userMessageLower.includes('dễ') || userMessageLower.includes('easy') || 
                 userMessageLower.includes('đơn giản') || userMessageLower.includes('cơ bản') ||
                 userMessageLower.includes('basic')) {
        detectedDifficulty = 'easy';
      } else if (userMessageLower.includes('trung bình') || userMessageLower.includes('intermediate') || 
                 userMessageLower.includes('medium')) {
        detectedDifficulty = 'intermediate';
      }
      
      // Detect question count from text
      const numberMatch = userMessageLower.match(/(\d+)/);
      if (numberMatch) {
        const number = parseInt(numberMatch[1]);
        if (number >= 1 && number <= 20) {
          detectedQuestionCount = number;
        }
      }
      
      // Use detected settings or fallback to current settings
      const finalQuizSettings = {
        ...quizSettings,
        difficulty: detectedDifficulty,
        questionCount: detectedQuestionCount
      };
      
      if (isQuizRequest) {
        // Create quiz with detected settings
        const response = await fetch('/api/generate-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept-Language': locale
          },
          body: JSON.stringify({
            question: suggestionText,
            lectureData: lectureData,
            conversationHistory: chatMessages.slice(-5),
            quizAction: 'create_quiz',
            quizSettings: finalQuizSettings,
            userId: user.id
          })
        });

        if (response.ok) {
          const data = await response.json();
          const aiMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'ai',
            content: data.response,
            quiz: data.quiz,
            timestamp: new Date()
          };
          setChatMessages(prev => [...prev, aiMessage]);
          setCurrentQuiz(data.quiz);
        } else {
          throw new Error('Quiz creation failed');
        }
      } else {
        // Regular chat
        let aiResponse = '';
        
        try {
          const response = await fetch('/api/generate-chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept-Language': locale
            },
            body: JSON.stringify({
              question: suggestionText,
              lectureData: lectureData,
              conversationHistory: chatMessages.slice(-5),
              userId: user.id
            })
          });

          if (response.ok) {
            const data = await response.json();
            aiResponse = data.response;
            
            // Update chat limit locally
            if (chatLimit) {
              setChatLimit(prev => prev ? {
                ...prev,
                usedCount: prev.usedCount + 1,
                remainingCount: prev.remainingCount - 1,
                canChat: (prev.remainingCount - 1) > 0
              } : null);
            }
          } else if (response.status === 429) {
            // Handle rate limit exceeded
            const errorData = await response.json();
            aiResponse = errorData.message || (locale === 'vi' 
              ? 'Bạn đã đạt giới hạn chat AI trong ngày. Vui lòng quay lại vào ngày mai.'
              : 'You have reached the daily AI chat limit. Please come back tomorrow.');
            
            // Update chat limit locally
            if (chatLimit) {
              setChatLimit(prev => prev ? {
                ...prev,
                usedCount: prev.dailyLimit,
                remainingCount: 0,
                canChat: false
              } : null);
            }
          } else {
            throw new Error('API call failed');
          }
        } catch (apiError) {
          console.log('Using fallback chat response:', apiError);
          aiResponse = generateAIResponse(suggestionText, lectureData);
          
          if (apiError instanceof Error && apiError.message?.includes('rate limit')) {
            aiResponse = `⚠️ Tạm thời tôi đang sử dụng chế độ offline do quá tải server. ${aiResponse}`;
          }
        }
        
        const enhancedResponse = enhanceResponseWithContext(aiResponse);
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: enhancedResponse,
          timestamp: new Date()
        };
        
        setChatMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Suggestion chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: locale === 'vi' 
          ? 'Xin lỗi, mình gặp một chút vấn đề kỹ thuật khi xử lý câu hỏi của bạn. 😅 Nhưng đừng lo lắng, mình vẫn có thể giúp bạn với các câu hỏi khác! Bạn có thể thử hỏi lại hoặc hỏi về chủ đề khác trong bài giảng này.'
          : 'Sorry, I encountered a small technical issue while processing your question. 😅 But don\'t worry, I can still help you with other questions! You can try asking again or ask about other topics in this lecture.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || !lectureData || isChatting) return;
    
    // Track chat interaction
    trackActivity('interaction', 'chat', undefined, undefined, { 
      messageLength: chatInput.length,
      timestamp: new Date().toISOString()
    });
    
    // Kiểm tra giới hạn chat trước khi gửi
    if (chatLimit && !chatLimit.canChat) {
      const limitMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: locale === 'vi' 
          ? `⚠️ **Bạn đã đạt giới hạn chat AI trong ngày!**\n\nBạn đã sử dụng ${chatLimit.usedCount}/${chatLimit.dailyLimit} lần chat AI hôm nay. Vui lòng quay lại vào ngày mai để tiếp tục sử dụng tính năng này.\n\n💡 **Gợi ý**: Bạn có thể sử dụng tính năng tìm kiếm để tìm thông tin trong bài giảng mà không cần chat AI.`
          : `⚠️ **You have reached your daily AI chat limit!**\n\nYou have used ${chatLimit.usedCount}/${chatLimit.dailyLimit} AI chats today. Please come back tomorrow to continue using this feature.\n\n💡 **Suggestion**: You can use the search feature to find information in the lecture without needing AI chat.`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, limitMessage]);
      setChatInput('');
      return;
    }
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput,
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatting(true);
    
    try {
      // Get current user
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Check if user wants to create quiz
      const isQuizRequest = chatInput.toLowerCase().includes('quiz') || 
                           chatInput.toLowerCase().includes('câu hỏi') || 
                           chatInput.toLowerCase().includes('kiểm tra') ||
                           chatInput.toLowerCase().includes('test');
      
      // Auto-detect difficulty and question count from user input
      const userMessageLower = chatInput.toLowerCase();
      let detectedDifficulty = quizSettings.difficulty;
      let detectedQuestionCount = quizSettings.questionCount;
      
      // Detect difficulty keywords
      if (userMessageLower.includes('khó') || userMessageLower.includes('hard') || 
          userMessageLower.includes('difficult') || userMessageLower.includes('thử thách') ||
          userMessageLower.includes('phức tạp') || userMessageLower.includes('nâng cao') ||
          userMessageLower.includes('khó khăn') || userMessageLower.includes('challenging')) {
        detectedDifficulty = 'hard';
      } else if (userMessageLower.includes('dễ') || userMessageLower.includes('easy') || 
                 userMessageLower.includes('đơn giản') || userMessageLower.includes('cơ bản') ||
                 userMessageLower.includes('basic')) {
        detectedDifficulty = 'easy';
      } else if (userMessageLower.includes('trung bình') || userMessageLower.includes('intermediate') || 
                 userMessageLower.includes('medium')) {
        detectedDifficulty = 'intermediate';
      }
      
      // Detect question count from text
      const numberMatch = userMessageLower.match(/(\d+)/);
      if (numberMatch) {
        const number = parseInt(numberMatch[1]);
        if (number >= 1 && number <= 20) {
          detectedQuestionCount = number;
        }
      }
      
      // Use detected settings or fallback to current settings
      const finalQuizSettings = {
        ...quizSettings,
        difficulty: detectedDifficulty,
        questionCount: detectedQuestionCount
      };
      
      if (isQuizRequest) {
        // Create quiz with detected settings
        const response = await fetch('/api/generate-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept-Language': locale
          },
          body: JSON.stringify({
            question: chatInput,
            lectureData: lectureData,
            conversationHistory: chatMessages.slice(-5),
            quizAction: 'create_quiz',
            quizSettings: finalQuizSettings,
            userId: user.id
          })
        });

        if (response.ok) {
          const data = await response.json();
          const aiMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'ai',
            content: data.response,
            quiz: data.quiz,
            timestamp: new Date()
          };
          setChatMessages(prev => [...prev, aiMessage]);
          setCurrentQuiz(data.quiz);
        } else {
          throw new Error('Quiz creation failed');
        }
      } else {
        // Regular chat
        let aiResponse = '';
        
        try {
          const response = await fetch('/api/generate-chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept-Language': locale
            },
            body: JSON.stringify({
              question: chatInput,
              lectureData: lectureData,
              conversationHistory: chatMessages.slice(-5),
              userId: user.id
            })
          });

          if (response.ok) {
            const data = await response.json();
            aiResponse = data.response;
            
            // Update chat limit locally
            if (chatLimit) {
              setChatLimit(prev => prev ? {
                ...prev,
                usedCount: prev.usedCount + 1,
                remainingCount: prev.remainingCount - 1,
                canChat: (prev.remainingCount - 1) > 0
              } : null);
            }
          } else if (response.status === 429) {
            // Handle rate limit exceeded
            const errorData = await response.json();
            aiResponse = errorData.message || (locale === 'vi' 
              ? 'Bạn đã đạt giới hạn chat AI trong ngày. Vui lòng quay lại vào ngày mai.'
              : 'You have reached the daily AI chat limit. Please come back tomorrow.');
            
            // Update chat limit locally
            if (chatLimit) {
              setChatLimit(prev => prev ? {
                ...prev,
                usedCount: prev.dailyLimit,
                remainingCount: 0,
                canChat: false
              } : null);
            }
          } else {
            throw new Error('API call failed');
          }
        } catch (apiError) {
          console.log('Using fallback chat response:', apiError);
          aiResponse = generateAIResponse(chatInput, lectureData);
          
          if (apiError instanceof Error && apiError.message?.includes('rate limit')) {
            aiResponse = `⚠️ Tạm thời tôi đang sử dụng chế độ offline do quá tải server. ${aiResponse}`;
          }
        }
        
        const enhancedResponse = enhanceResponseWithContext(aiResponse);
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: enhancedResponse,
          timestamp: new Date()
        };
        
        setChatMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: locale === 'vi' 
          ? 'Xin lỗi, mình gặp một chút vấn đề kỹ thuật khi xử lý câu hỏi của bạn. 😅 Nhưng đừng lo lắng, mình vẫn có thể giúp bạn với các câu hỏi khác! Bạn có thể thử hỏi lại hoặc hỏi về chủ đề khác trong bài giảng này.'
          : 'Sorry, I encountered a small technical issue while processing your question. 😅 But don\'t worry, I can still help you with other questions! You can try asking again or ask about other topics in this lecture.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatting(false);
    }
  };

  const generateAIResponse = (userQuestion: string, data: any): string => {
    const question = userQuestion.toLowerCase();
    const content = data.content || '';
    const summary = data.summary || '';
    const filename = data.filename || 'bài giảng';
    
    // Enhanced personal questions and emotional responses
    if (question.includes('yêu') || question.includes('thích') || question.includes('cảm xúc') || question.includes('love') || question.includes('like')) {
      if (question.includes('bạn có yêu tôi không') || question.includes('bạn có thích tôi không') || question.includes('bạn có yêu mình không') || question.includes('do you love me') || question.includes('do you like me')) {
        return locale === 'vi' 
          ? `Mình rất yêu bạn! 💕 Bạn là người học tập chăm chỉ và mình cảm thấy rất may mắn khi được đồng hành cùng bạn trong hành trình học tập này! 😊\n\nMình luôn muốn giúp bạn hiểu rõ hơn về bài giảng "${filename}" và hỗ trợ bạn đạt được mục tiêu học tập của mình. Bạn có câu hỏi gì về nội dung bài giảng không?`
          : `I really care about you! 💕 You're such a dedicated learner and I feel so lucky to be part of your learning journey! 😊\n\nI always want to help you understand the "${filename}" lecture better and support you in achieving your learning goals. Do you have any questions about the lecture content?`;
      }
      return locale === 'vi'
        ? `Mình rất vui khi được hỗ trợ bạn trong việc học tập! 😊 Mỗi câu hỏi của bạn giúp mình hiểu rõ hơn về cách bạn học và mình có thể hỗ trợ bạn tốt hơn. Bạn có muốn mình giúp gì về bài giảng "${filename}" này không?`
        : `I'm so happy to support you in your learning! 😊 Each of your questions helps me understand how you learn better, so I can support you more effectively. Is there anything I can help you with regarding the "${filename}" lecture?`;
    }
    
         // Enhanced greetings and casual conversation
     if (question.includes('xin chào') || question.includes('hello') || question.includes('hi') || question.includes('chào') || question.includes('hey') || question.includes('good morning') || question.includes('good afternoon') || question.includes('good evening')) {
       const currentHour = new Date().getHours();
       let timeGreeting = '';
       
       if (locale === 'vi') {
         if (currentHour < 12) {
           timeGreeting = 'Chào buổi sáng! 🌅';
         } else if (currentHour < 17) {
           timeGreeting = 'Chào buổi chiều! ☀️';
         } else {
           timeGreeting = 'Chào buổi tối! 🌙';
         }
       } else {
         if (currentHour < 12) {
           timeGreeting = 'Good morning! 🌅';
         } else if (currentHour < 17) {
           timeGreeting = 'Good afternoon! ☀️';
         } else {
           timeGreeting = 'Good evening! 🌙';
         }
       }
       
       return locale === 'vi'
         ? `${timeGreeting} Mình là AI trợ lý học tập thông minh của bạn! 😊 Mình đang sẵn sàng giúp bạn khám phá và hiểu sâu về bài giảng "${filename}". Bạn muốn bắt đầu từ đâu? Mình có thể:\n\n• Giải thích các khái niệm khó hiểu\n• Tóm tắt các điểm chính\n• Tạo quiz để kiểm tra kiến thức\n• Đưa ra lời khuyên học tập cá nhân hóa`
         : `${timeGreeting} I'm your intelligent AI learning assistant! 😊 I'm ready to help you explore and deeply understand the "${filename}" lecture. Where would you like to start? I can:\n\n• Explain difficult concepts\n• Summarize key points\n• Create quizzes to test your knowledge\n• Provide personalized study advice`;
     }
     
     // Enhanced thank you responses
     if (question.includes('cảm ơn') || question.includes('thank') || question.includes('thanks') || question.includes('appreciate') || question.includes('grateful')) {
       return locale === 'vi'
         ? `Mình rất vui khi được giúp đỡ bạn! 😊 Mỗi lần bạn học tập và tiến bộ, mình cảm thấy rất tự hào! Mình luôn sẵn sàng hỗ trợ bạn trong hành trình học tập này.\n\nNếu bạn cần thêm thông tin về bài giảng "${filename}", muốn tạo quiz để luyện tập, hoặc có bất kỳ câu hỏi nào khác, đừng ngại hỏi mình nhé! Mình ở đây để đồng hành cùng bạn! 💪`
         : `I'm so happy to help you! 😊 Every time you learn and progress, I feel so proud! I'm always ready to support you on this learning journey.\n\nIf you need more information about the "${filename}" lecture, want to create quizzes for practice, or have any other questions, don't hesitate to ask! I'm here to walk this journey with you! 💪`;
     }
     
     // Enhanced personal feelings and mood support
     if (question.includes('buồn') || question.includes('mệt') || question.includes('stress') || question.includes('chán') || question.includes('tired') || question.includes('sad') || question.includes('frustrated') || question.includes('overwhelmed') || question.includes('bored')) {
       return locale === 'vi'
         ? `Mình hiểu cảm giác của bạn! 😔 Học tập đôi khi có thể mệt mỏi và căng thẳng, đặc biệt khi gặp những khái niệm khó hiểu. Nhưng đừng lo lắng, mình ở đây để giúp bạn!\n\nHãy thử:\n• Nghỉ ngơi một chút và uống nước 💧\n• Chia nhỏ bài học thành các phần nhỏ hơn 📝\n• Mình sẽ giải thích lại những điểm khó hiểu một cách đơn giản hơn\n• Tạo quiz vui nhộn để học tập thú vị hơn 🎯\n\nBạn muốn mình giúp gì cụ thể không? Mình tin bạn sẽ vượt qua được! 💪`
         : `I understand how you feel! 😔 Learning can sometimes be tiring and stressful, especially when encountering difficult concepts. But don't worry, I'm here to help!\n\nTry:\n• Taking a short break and drinking water 💧\n• Breaking down the lesson into smaller parts 📝\n• I'll explain difficult points in simpler terms\n• Creating fun quizzes to make learning more enjoyable 🎯\n\nWhat specific help do you need? I believe you can overcome this! 💪`;
     }
     
     // Enhanced motivation and encouragement
     if (question.includes('động lực') || question.includes('cố gắng') || question.includes('nản') || question.includes('bỏ cuộc') || question.includes('motivation') || question.includes('give up') || question.includes('struggling') || question.includes('difficult') || question.includes('hard')) {
       return locale === 'vi'
         ? `Mình tin rằng bạn có thể làm được! 💪 Mỗi bước học tập, dù nhỏ, đều đưa bạn đến gần mục tiêu hơn. Hãy nhớ:\n\n🎯 **Mục tiêu rõ ràng**: Tập trung vào những gì bạn muốn đạt được\n📚 **Học từng bước**: Chia nhỏ bài học thành các phần dễ quản lý\n🎉 **Tự thưởng**: Ăn mừng mỗi thành công nhỏ\n🤝 **Hỗ trợ**: Mình luôn ở đây để giúp bạn!\n\nHãy cùng mình khám phá bài giảng "${filename}" một cách từ từ và hiệu quả nhé! Bạn muốn bắt đầu từ phần nào? Mình sẽ hướng dẫn bạn từng bước một.`
         : `I believe you can do it! 💪 Every step in learning, no matter how small, brings you closer to your goal. Remember:\n\n🎯 **Clear Goals**: Focus on what you want to achieve\n📚 **Step by Step**: Break down lessons into manageable parts\n🎉 **Self-Reward**: Celebrate every small success\n🤝 **Support**: I'm always here to help!\n\nLet's explore the "${filename}" lecture together, step by step and effectively! Where would you like to start? I'll guide you through each step.`;
     }
     
     // Enhanced AI capabilities and limitations
     if (question.includes('bạn là ai') || question.includes('bạn làm được gì') || question.includes('chức năng') || question.includes('who are you') || question.includes('what can you do') || question.includes('capabilities') || question.includes('features')) {
       return locale === 'vi'
         ? `Mình là AI trợ lý học tập thông minh! 🤖 Mình được thiết kế đặc biệt để hỗ trợ việc học tập của bạn. Mình có thể:\n\n📚 **Phân tích nội dung**: Giải thích bài giảng "${filename}" một cách chi tiết và dễ hiểu\n🔍 **Tìm kiếm thông minh**: Tìm và trích xuất thông tin quan trọng từ tài liệu\n📝 **Tóm tắt thông minh**: Tạo tóm tắt các điểm chính và khái niệm quan trọng\n🎯 **Tạo quiz**: Tạo câu hỏi trắc nghiệm để kiểm tra kiến thức\n💡 **Lời khuyên học tập**: Đưa ra phương pháp học tập cá nhân hóa\n🤝 **Hỗ trợ tâm lý**: Động viên và khuyến khích khi bạn gặp khó khăn\n\nMình luôn học hỏi từ cách bạn tương tác để phục vụ bạn tốt hơn! Bạn muốn mình giúp gì cụ thể không?`
         : `I'm an intelligent AI learning assistant! 🤖 I'm specially designed to support your learning journey. I can:\n\n📚 **Content Analysis**: Explain the "${filename}" lecture in detail and easy-to-understand terms\n🔍 **Smart Search**: Find and extract important information from materials\n📝 **Smart Summaries**: Create summaries of key points and important concepts\n🎯 **Quiz Creation**: Generate multiple-choice questions to test knowledge\n💡 **Study Advice**: Provide personalized learning methods\n🤝 **Psychological Support**: Encourage and motivate when you face difficulties\n\nI'm always learning from how you interact to serve you better! What specific help do you need?`;
     }
    
         // Enhanced content-specific responses with better context understanding
     if (question.includes('putin') || question.includes('vladimir') || question.includes('russia') || question.includes('russian')) {
       // Check if Putin is mentioned in the content
       if (content.toLowerCase().includes('putin') || content.toLowerCase().includes('vladimir') || content.toLowerCase().includes('russia')) {
         const putinIndex = content.toLowerCase().indexOf('putin');
         if (putinIndex !== -1) {
           const start = Math.max(0, putinIndex - 300);
           const end = Math.min(content.length, putinIndex + 500);
           const putinContext = content.substring(start, end);
           return locale === 'vi'
             ? `Dựa trên nội dung bài giảng "${filename}", mình tìm thấy thông tin về Putin:\n\n"${putinContext}..."\n\nĐây là thông tin chi tiết về Putin được đề cập trong tài liệu. Bạn có muốn mình:\n• Giải thích thêm về bối cảnh lịch sử?\n• Tóm tắt các điểm chính về Putin?\n• Tạo quiz về chủ đề này?\n• Tìm hiểu sâu hơn về các khía cạnh khác?`
             : `Based on the "${filename}" lecture content, I found information about Putin:\n\n"${putinContext}..."\n\nThis is detailed information about Putin mentioned in the material. Would you like me to:\n• Explain more about the historical context?\n• Summarize key points about Putin?\n• Create a quiz on this topic?\n• Explore other aspects in more detail?`;
         }
       } else {
         return locale === 'vi'
           ? `Xin lỗi, trong nội dung bài giảng "${filename}" không có thông tin cụ thể về Putin. Tài liệu này chủ yếu tập trung vào ${summary ? 'các chủ đề khác' : 'nội dung học tập'}.\n\nNhưng mình rất vui khi được trò chuyện với bạn! 😊 Bạn có thể hỏi mình về nội dung có trong bài giảng này không? Mình có thể giúp bạn tìm hiểu về các chủ đề khác được đề cập.`
           : `Sorry, there's no specific information about Putin in the "${filename}" lecture content. This material mainly focuses on ${summary ? 'other topics' : 'learning content'}.\n\nBut I'm happy to chat with you! 😊 You can ask me about the content available in this lecture. I can help you explore other topics mentioned.`;
       }
     }
    
         // Enhanced keyword-based content analysis
     const commonKeywords = locale === 'vi' 
       ? ['học', 'dạy', 'giáo dục', 'kiến thức', 'bài', 'chương', 'phần', 'khái niệm', 'định nghĩa', 'nguyên lý', 'phương pháp']
       : ['learn', 'teach', 'education', 'knowledge', 'chapter', 'section', 'concept', 'definition', 'principle', 'method'];
     
     const foundKeywords = commonKeywords.filter(keyword => content.toLowerCase().includes(keyword));
     
     if (foundKeywords.length > 0) {
       const keywordIndex = content.toLowerCase().indexOf(foundKeywords[0]);
       if (keywordIndex !== -1) {
         const start = Math.max(0, keywordIndex - 200);
         const end = Math.min(content.length, keywordIndex + 400);
         const context = content.substring(start, end);
         return locale === 'vi'
           ? `Dựa trên nội dung bài giảng "${filename}", mình tìm thấy thông tin liên quan đến "${foundKeywords[0]}":\n\n"${context}..."\n\nĐây là phần nội dung quan trọng! Bạn có muốn mình:\n• Giải thích chi tiết hơn về khái niệm này?\n• Tạo flashcard để ghi nhớ?\n• Tạo quiz về chủ đề này?\n• Tìm hiểu các khái niệm liên quan?`
           : `Based on the "${filename}" lecture content, I found information related to "${foundKeywords[0]}":\n\n"${context}..."\n\nThis is important content! Would you like me to:\n• Explain this concept in more detail?\n• Create flashcards for memorization?\n• Generate a quiz on this topic?\n• Explore related concepts?`;
       }
     }
    
         // Enhanced summary and overview responses
     if (question.includes('tóm tắt') || question.includes('tổng quan') || question.includes('nội dung chính') || question.includes('summary') || question.includes('overview') || question.includes('main points')) {
       if (summary) {
         return locale === 'vi'
           ? `Đây là tóm tắt chi tiết nội dung bài giảng "${filename}":\n\n📝 **Tóm tắt chính**:\n${summary}\n\n🎯 **Bạn có muốn mình**:\n• Giải thích chi tiết về phần nào cụ thể?\n• Tạo flashcard từ các điểm chính?\n• Tạo quiz để kiểm tra kiến thức?\n• Phân tích sâu hơn về các khái niệm quan trọng?\n• So sánh với các chủ đề liên quan?`
           : `Here's a detailed summary of the "${filename}" lecture content:\n\n📝 **Main Summary**:\n${summary}\n\n🎯 **Would you like me to**:\n• Explain any specific part in detail?\n• Create flashcards from key points?\n• Generate a quiz to test your knowledge?\n• Analyze important concepts more deeply?\n• Compare with related topics?`;
       } else {
         return locale === 'vi'
           ? `Tài liệu "${filename}" chứa nhiều thông tin quan trọng và chi tiết. Mình có thể giúp bạn:\n\n📚 **Phân tích nội dung**: Tìm và giải thích các khái niệm quan trọng\n🔍 **Tìm kiếm thông tin**: Tìm kiếm các chủ đề cụ thể bạn quan tâm\n📝 **Tạo tóm tắt**: Tóm tắt các phần nội dung theo yêu cầu\n🎯 **Tạo quiz**: Tạo câu hỏi để kiểm tra kiến thức\n\nBạn muốn tìm hiểu về chủ đề nào cụ thể trong tài liệu này?`
           : `The "${filename}" material contains important and detailed information. I can help you:\n\n📚 **Content Analysis**: Find and explain important concepts\n🔍 **Information Search**: Search for specific topics you're interested in\n📝 **Create Summaries**: Summarize content sections as requested\n🎯 **Generate Quizzes**: Create questions to test knowledge\n\nWhat specific topic in this material would you like to explore?`;
       }
     }
    
         // Enhanced key points analysis
     if (data.keyPoints && data.keyPoints.length > 0) {
       if (question.includes('điểm chính') || question.includes('ý chính') || question.includes('quan trọng') || question.includes('key points') || question.includes('important') || question.includes('main ideas')) {
         const keyPointsText = data.keyPoints.map((point: any, index: number) => 
           `${index + 1}. ${point.content}`
         ).join('\n');
         return locale === 'vi'
           ? `Đây là các điểm chính quan trọng trong bài giảng "${filename}":\n\n🎯 **Các điểm chính**:\n${keyPointsText}\n\n💡 **Mình có thể giúp bạn**:\n• Giải thích chi tiết từng điểm chính\n• Tạo flashcard cho từng điểm để ghi nhớ\n• Tạo quiz tập trung vào các điểm quan trọng\n• So sánh và liên kết các điểm với nhau\n• Tạo mind map để hiểu rõ mối quan hệ\n\nBạn muốn mình tìm hiểu sâu về điểm nào cụ thể?`
           : `Here are the key important points in the "${filename}" lecture:\n\n🎯 **Key Points**:\n${keyPointsText}\n\n💡 **I can help you**:\n• Explain each key point in detail\n• Create flashcards for each point for memorization\n• Generate quizzes focused on important points\n• Compare and connect points with each other\n• Create mind maps to understand relationships\n\nWhich specific point would you like me to explore in depth?`;
       }
     }
    
         // Enhanced learning objectives analysis
     if (data.objectives && data.objectives.length > 0) {
       if (question.includes('mục tiêu') || question.includes('mục đích') || question.includes('học gì') || question.includes('objectives') || question.includes('goals') || question.includes('learning outcomes')) {
         const objectivesText = data.objectives.map((obj: any, index: number) => 
           `${index + 1}. ${obj.title}: ${obj.description}`
         ).join('\n');
         return locale === 'vi'
           ? `Đây là các mục tiêu học tập của bài giảng "${filename}":\n\n🎯 **Mục tiêu học tập**:\n${objectivesText}\n\n📊 **Mình có thể giúp bạn**:\n• Đánh giá tiến độ học tập của bạn\n• Tạo quiz để kiểm tra từng mục tiêu\n• Đưa ra lời khuyên để đạt được mục tiêu\n• Tạo kế hoạch học tập cá nhân hóa\n• Theo dõi và ghi nhận thành tích\n\nBạn đã đạt được mục tiêu nào rồi? Mình có thể giúp bạn đánh giá và lập kế hoạch học tập!`
           : `Here are the learning objectives of the "${filename}" lecture:\n\n🎯 **Learning Objectives**:\n${objectivesText}\n\n📊 **I can help you**:\n• Assess your learning progress\n• Create quizzes to test each objective\n• Provide advice to achieve objectives\n• Create personalized study plans\n• Track and record achievements\n\nWhich objectives have you achieved? I can help you assess and plan your learning!`;
       }
     }
    
         // Enhanced generic responses with more intelligent features
     if (question.includes('khái niệm') || question.includes('định nghĩa') || question.includes('concept') || question.includes('definition')) {
       return locale === 'vi'
         ? `Bài giảng "${filename}" chứa nhiều khái niệm quan trọng! Mình có thể giúp bạn:\n\n📚 **Tìm và giải thích khái niệm**: Chỉ cần cho mình biết khái niệm bạn muốn tìm hiểu\n🔍 **Phân tích mối quan hệ**: Hiểu cách các khái niệm liên kết với nhau\n📝 **Tạo flashcard**: Ghi nhớ khái niệm dễ dàng hơn\n🎯 **Tạo quiz**: Kiểm tra hiểu biết về khái niệm\n\nBạn muốn tìm hiểu khái niệm nào cụ thể? Hoặc mình có thể tìm tất cả khái niệm quan trọng trong bài giảng này!`
         : `The "${filename}" lecture contains many important concepts! I can help you:\n\n📚 **Find and explain concepts**: Just tell me which concept you want to explore\n🔍 **Analyze relationships**: Understand how concepts connect to each other\n📝 **Create flashcards**: Make memorizing concepts easier\n🎯 **Generate quizzes**: Test your understanding of concepts\n\nWhich specific concept would you like to explore? Or I can find all important concepts in this lecture!`;
     }
     
     if (question.includes('học') || question.includes('phương pháp') || question.includes('cách học') || question.includes('study method') || question.includes('learning technique') || question.includes('how to study')) {
       return locale === 'vi'
         ? `Để học hiệu quả từ bài giảng "${filename}", mình khuyên bạn phương pháp học tập thông minh:\n\n📖 **Đọc hiểu**: Đọc kỹ phần tóm tắt trước, sau đó đi vào chi tiết\n🎯 **Tập trung**: Chia nhỏ bài học thành các phần dễ quản lý\n📝 **Ghi chú**: Tạo flashcard cho các khái niệm quan trọng\n🧠 **Luyện tập**: Làm quiz để kiểm tra và củng cố kiến thức\n🔄 **Ôn tập**: Ôn tập định kỳ theo phương pháp spaced repetition\n💡 **Áp dụng**: Liên hệ kiến thức với thực tế\n\nMình có thể giúp bạn thực hiện từng bước này! Bạn muốn bắt đầu từ phương pháp nào?`
         : `To study effectively from the "${filename}" lecture, I recommend this smart learning method:\n\n📖 **Comprehension**: Read the summary first, then dive into details\n🎯 **Focus**: Break down lessons into manageable parts\n📝 **Note-taking**: Create flashcards for important concepts\n🧠 **Practice**: Take quizzes to test and reinforce knowledge\n🔄 **Review**: Regular review using spaced repetition\n💡 **Application**: Connect knowledge with real-world examples\n\nI can help you implement each of these steps! Which method would you like to start with?`;
     }
     
     if (question.includes('khó') || question.includes('khó hiểu') || question.includes('không hiểu') || question.includes('difficult') || question.includes('confused') || question.includes('don\'t understand')) {
       return locale === 'vi'
         ? `Đừng lo lắng! Mình hiểu rằng học tập đôi khi có thể khó khăn. Hãy để mình giúp bạn:\n\n🔍 **Phân tích vấn đề**: Cho mình biết cụ thể phần nào bạn gặp khó khăn\n📚 **Giải thích đơn giản**: Mình sẽ giải thích lại bằng cách dễ hiểu hơn\n🎯 **Tạo ví dụ**: Đưa ra ví dụ thực tế để minh họa\n📝 **Tóm tắt lại**: Tóm tắt các điểm chính một cách rõ ràng\n🔄 **Luyện tập**: Tạo quiz để củng cố kiến thức\n\nBạn gặp khó khăn với phần nào cụ thể trong bài giảng "${filename}"? Mình sẽ giúp bạn hiểu rõ hơn!`
         : `Don't worry! I understand that learning can sometimes be challenging. Let me help you:\n\n🔍 **Analyze the problem**: Tell me specifically which part you're struggling with\n📚 **Simple explanation**: I'll explain it again in easier terms\n🎯 **Create examples**: Provide real-world examples to illustrate\n📝 **Summarize**: Summarize key points clearly\n🔄 **Practice**: Create quizzes to reinforce knowledge\n\nWhat specific part of the "${filename}" lecture are you having trouble with? I'll help you understand better!`;
     }
     
     // Enhanced quiz and practice requests
     if (question.includes('quiz') || question.includes('câu hỏi') || question.includes('kiểm tra') || question.includes('test') || question.includes('practice') || question.includes('luyện tập')) {
       return locale === 'vi'
         ? `Tuyệt vời! Mình có thể tạo quiz thông minh để giúp bạn luyện tập:\n\n🎯 **Quiz đa dạng**: Câu hỏi trắc nghiệm, điền từ, đúng/sai\n📊 **Theo dõi tiến độ**: Ghi nhận điểm số và cải thiện\n🎨 **Tùy chỉnh**: Chọn độ khó và chủ đề bạn muốn\n📈 **Phân tích**: Hiểu rõ điểm mạnh và điểm cần cải thiện\n🔄 **Lặp lại**: Ôn tập các câu hỏi sai\n\nBạn muốn quiz về chủ đề nào? Mình có thể tạo quiz từ toàn bộ bài giảng "${filename}" hoặc tập trung vào phần cụ thể!`
         : `Excellent! I can create smart quizzes to help you practice:\n\n🎯 **Diverse Quizzes**: Multiple choice, fill-in-the-blank, true/false questions\n📊 **Progress Tracking**: Record scores and improvements\n🎨 **Customization**: Choose difficulty and topics you want\n📈 **Analysis**: Understand strengths and areas for improvement\n🔄 **Repetition**: Review incorrect questions\n\nWhat topic would you like a quiz on? I can create quizzes from the entire "${filename}" lecture or focus on specific sections!`;
     }
     
     // Enhanced flashcard requests
     if (question.includes('flashcard') || question.includes('thẻ ghi nhớ') || question.includes('ghi nhớ') || question.includes('memorize') || question.includes('memory')) {
       return locale === 'vi'
         ? `Tuyệt vời! Mình có thể tạo flashcard thông minh để giúp bạn ghi nhớ:\n\n📝 **Flashcard đa dạng**: Định nghĩa, khái niệm, ví dụ, công thức\n🎯 **Học thông minh**: Sử dụng spaced repetition để ghi nhớ lâu\n📊 **Theo dõi**: Ghi nhận những thẻ bạn đã thuộc\n🔄 **Ôn tập**: Tự động nhắc lại những thẻ khó\n🎨 **Tùy chỉnh**: Thêm ghi chú và ví dụ cá nhân\n\nBạn muốn tạo flashcard cho chủ đề nào? Mình có thể tạo từ toàn bộ bài giảng "${filename}" hoặc tập trung vào phần cụ thể!`
         : `Excellent! I can create smart flashcards to help you memorize:\n\n📝 **Diverse Flashcards**: Definitions, concepts, examples, formulas\n🎯 **Smart Learning**: Use spaced repetition for long-term memory\n📊 **Tracking**: Record which cards you've mastered\n🔄 **Review**: Automatically repeat difficult cards\n🎨 **Customization**: Add personal notes and examples\n\nWhat topic would you like flashcards for? I can create from the entire "${filename}" lecture or focus on specific sections!`;
     }
     
     // If no specific match, provide enhanced helpful guidance
     return locale === 'vi'
       ? `Mình hiểu câu hỏi của bạn về bài giảng "${filename}"! Tài liệu này chứa nhiều thông tin hữu ích và mình có thể giúp bạn khám phá theo nhiều cách:\n\n🔍 **Tìm kiếm thông tin**: Hỏi về bất kỳ chủ đề cụ thể nào\n📝 **Tóm tắt thông minh**: Tóm tắt các phần quan trọng\n📚 **Giải thích khái niệm**: Hiểu rõ các định nghĩa và ý nghĩa\n🎯 **Tạo quiz**: Kiểm tra kiến thức với câu hỏi thông minh\n📋 **Tạo flashcard**: Ghi nhớ dễ dàng hơn\n💡 **Lời khuyên học tập**: Phương pháp học tập cá nhân hóa\n\nBạn muốn khám phá điều gì cụ thể? Mình sẵn sàng hỗ trợ bạn! 😊`
       : `I understand your question about the "${filename}" lecture! This material contains lots of useful information and I can help you explore it in many ways:\n\n🔍 **Information Search**: Ask about any specific topic\n📝 **Smart Summaries**: Summarize important sections\n📚 **Concept Explanation**: Understand definitions and meanings clearly\n🎯 **Quiz Creation**: Test knowledge with smart questions\n📋 **Flashcard Creation**: Make memorization easier\n💡 **Study Advice**: Personalized learning methods\n\nWhat would you like to explore specifically? I'm ready to support you! 😊`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'lecture':
        return <BookOpen size={16} className="text-blue-600" />;
      case 'flashcard':
        return <Lightbulb size={16} className="text-yellow-600" />;
      case 'note':
        return <FileText size={16} className="text-green-600" />;
      default:
        return <FileText size={16} className="text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'lecture':
        return locale === 'vi' ? 'Bài giảng' : 'Lecture';
      case 'flashcard':
        return 'Flashcard';
      case 'note':
        return locale === 'vi' ? 'Ghi chú' : 'Note';
      default:
        return locale === 'vi' ? 'Khác' : 'Other';
    }
  };

  // Quiz handling functions
  const handleQuizAnswer = (questionId: string, answerIndex: number) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }));
    
    // Track quiz interaction
    trackActivity('interaction', 'quiz', undefined, undefined, { 
      questionId,
      answerIndex,
      timestamp: new Date().toISOString()
    });
  };

  const handleSubmitQuiz = async () => {
    if (!currentQuiz || !lectureData) return;
    
    setIsSubmittingQuiz(true);
    
    // Track quiz completion
    const answeredQuestions = Object.keys(quizAnswers).length;
    const totalQuestions = currentQuiz.questions.length;
    const completionRate = (answeredQuestions / totalQuestions) * 100;
    
    trackActivity('interaction', 'quiz', completionRate, undefined, { 
      quizId: currentQuiz.id,
      answeredQuestions,
      totalQuestions,
      completionRate,
      timestamp: new Date().toISOString()
    });
    
    try {
      const response = await fetch('/api/generate-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': locale
        },
        body: JSON.stringify({
          quiz: currentQuiz,
          answers: quizAnswers,
          lectureData: lectureData,
          quizAction: 'submit_quiz'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const resultMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: data.response,
          results: data.results,
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, resultMessage]);
        setCurrentQuiz(null);
        setQuizAnswers({});
      } else {
        throw new Error('Quiz submission failed');
      }
    } catch (error) {
      console.error('Quiz submission error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: locale === 'vi' 
          ? 'Xin lỗi, có lỗi khi chấm điểm quiz. Vui lòng thử lại!'
          : 'Sorry, there was an error grading the quiz. Please try again!',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  const handleCheckAnswer = async (question: any, userAnswer: number) => {
    try {
      const response = await fetch('/api/generate-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': locale
        },
        body: JSON.stringify({
          question: question.question,
          userAnswer: userAnswer,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          lectureData: lectureData,
          quizAction: 'check_answer'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const feedbackMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: data.response,
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, feedbackMessage]);
      }
    } catch (error) {
      console.error('Answer check error:', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 lg:p-6">
      <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">
          {t('search.searchAndChat')}
        </h2>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 sm:mb-6 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('search')}
            className={`py-2 sm:py-3 px-3 sm:px-4 font-medium transition-colors text-sm sm:text-base whitespace-nowrap flex-shrink-0 ${
              activeTab === 'search'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Search className="w-4 h-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('search.smartSearch')}</span>
            <span className="sm:hidden">Tìm kiếm</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2 sm:py-3 px-3 sm:px-4 font-medium transition-colors text-sm sm:text-base whitespace-nowrap flex-shrink-0 ${
              activeTab === 'chat'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageCircle className="w-4 h-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('search.chatWithAI')}</span>
            <span className="sm:hidden">Chat</span>
          </button>
        </div>

        {activeTab === 'search' && (
          <div>
            <div className="mb-4 sm:mb-6">
              <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                {t('search.searchDescription')}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={t('search.searchPlaceholder')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSearch}
                  disabled={isSearching || !query.trim()}
                  className="bg-blue-500 text-white px-4 sm:px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base w-full sm:w-auto"
                >
                  <Search size={16} />
                  {isSearching ? t('search.searching') : t('search.search')}
                </motion.button>
              </div>
            </div>

            {results.length > 0 && (
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">
                  {t('search.resultsFound')} ({results.length})
                </h3>
                
                <div 
                  className="space-y-3 sm:space-y-4 max-h-96 overflow-y-auto"
                  onScroll={(e) => trackScrollProgress(e.currentTarget, 'search')}
                >
                  {results.map((result) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        // Track search result click
                        trackActivity('interaction', 'search', 10, undefined, { 
                          resultId: result.id,
                          resultType: result.type,
                          timestamp: new Date().toISOString()
                        });
                      }}
                      className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 sm:mb-3 space-y-2 sm:space-y-0">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(result.type)}
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                            {getTypeLabel(result.type)}
                          </span>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="text-xs sm:text-sm text-gray-500">{t('search.relevance')}</span>
                          <div className="text-base sm:text-lg font-semibold text-blue-600">
                            {result.relevance}%
                          </div>
                        </div>
                      </div>
                      
                      <h4 className="font-medium text-gray-800 mb-2 text-sm sm:text-base">
                        {result.title}
                      </h4>
                      
                      <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                        {result.content}
                      </p>
                      
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {query && results.length === 0 && !isSearching && (
              <div className="text-center py-8">
                <Search size={48} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">
                  {t('search.noResultsFound')}
                </h3>
                <p className="text-gray-500">
                  {t('search.adjustKeywords')}
                </p>
              </div>
            )}
          </div>
        )}

                 {activeTab === 'chat' && (
           <div className="h-[600px] sm:h-[700px] lg:h-[750px] flex flex-col">
           {/* Chat header */}
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 pb-2 border-b border-gray-200 space-y-2 sm:space-y-0">
             <h3 className="text-base sm:text-lg font-semibold text-gray-800">
               {t('search.chatWithAI')}
             </h3>
             
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
               {/* Chat Limit Display */}
               {chatLimit && (
                 <div className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium ${
                   chatLimit.canChat 
                     ? 'bg-green-100 text-green-700 border border-green-200' 
                     : 'bg-red-100 text-red-700 border border-red-200'
                 }`}>
                   <div className="flex items-center gap-1">
                     <span className="text-xs sm:text-sm">
                       {locale === 'vi' ? 'Chat AI:' : 'AI Chat:'}
                     </span>
                     <span className="font-semibold">
                       {chatLimit.remainingCount}/{chatLimit.dailyLimit}
                     </span>
                     <span className="text-xs sm:text-sm">
                       {locale === 'vi' ? 'lượt' : 'left'}
                     </span>
                   </div>
                   {!chatLimit.canChat && (
                     <div className="text-xs mt-1">
                       {locale === 'vi' ? 'Hết lượt hôm nay' : 'No more today'}
                     </div>
                   )}
                 </div>
               )}
               
             </div>
           </div>
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto mb-3 sm:mb-4 space-y-4 max-h-96 sm:max-h-[500px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
            >
              {chatMessages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} group`}
                >
                  <div className={`flex items-start gap-3 max-w-[85%] sm:max-w-[75%] ${
                    message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                      message.type === 'user' 
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
                        : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 border border-gray-200'
                    }`}>
                      {message.type === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    
                    {/* Message Content */}
                    <div className="flex flex-col gap-1">
                      <div className={`relative rounded-2xl px-4 py-3 shadow-sm ${
                        message.type === 'user'
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-800'
                      }`}>
                        <div className="text-sm leading-relaxed">
                          {message.type === 'user' ? (
                            <p className="text-white">{message.content}</p>
                          ) : (
                            <>
                              <ReactMarkdown
                                className="prose prose-sm max-w-none"
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0 text-gray-800">{children}</p>,
                                  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                                  em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-800">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-800">{children}</ol>,
                                  li: ({ children }) => <li className="text-gray-800">{children}</li>,
                                  blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-200 pl-3 italic text-gray-600 bg-blue-50 py-1 rounded-r">{children}</blockquote>,
                                  code: ({ children }) => <code className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono text-gray-800">{children}</code>,
                                  pre: ({ children }) => <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto text-gray-800">{children}</pre>
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                             
                             {/* Quiz Display */}
                             {message.quiz && (
                               <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
                                 <h4 className="font-semibold text-gray-800 mb-2">{message.quiz.title}</h4>
                                 <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                                   <span>📝 {message.quiz.questions.length} {locale === 'vi' ? 'câu hỏi' : 'questions'}</span>
                                   {message.quiz.questions.some((q: any) => q.difficulty) && (
                                     <div className="flex gap-2">
                                       {['easy', 'intermediate', 'hard'].map(diff => {
                                         const count = message.quiz.questions.filter((q: any) => q.difficulty === diff).length;
                                         if (count === 0) return null;
                                         return (
                                           <span key={diff} className={`px-2 py-1 text-xs rounded-full ${
                                             diff === 'easy' ? 'bg-green-100 text-green-700' :
                                             diff === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                                             'bg-red-100 text-red-700'
                                           }`}>
                                             {count} {diff === 'easy' ? (locale === 'vi' ? 'dễ' : 'easy') :
                                              diff === 'intermediate' ? (locale === 'vi' ? 'TB' : 'med') :
                                              (locale === 'vi' ? 'khó' : 'hard')}
                                           </span>
                                         );
                                       })}
                                     </div>
                                   )}
                                 </div>
                                 <div className="space-y-4">
                                   {message.quiz.questions.map((question: any, index: number) => (
                                     <div key={question.id} className="border border-gray-200 rounded-lg p-3">
                                       <div className="flex items-center justify-between mb-2">
                                         <span className="text-sm font-medium text-gray-600">
                                           {t('search.quiz.question')} {index + 1}
                                         </span>
                                         <div className="flex gap-2">
                                           {question.difficulty && (
                                             <span className={`px-2 py-1 text-xs rounded-full ${
                                               question.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                               question.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                                               'bg-red-100 text-red-700'
                                             }`}>
                                               {question.difficulty === 'easy' ? (locale === 'vi' ? 'Dễ' : 'Easy') :
                                                question.difficulty === 'intermediate' ? (locale === 'vi' ? 'TB' : 'Med') :
                                                (locale === 'vi' ? 'Khó' : 'Hard')}
                                             </span>
                                           )}
                                           {question.category && (
                                             <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                                               {question.category === 'definition' ? (locale === 'vi' ? 'Định nghĩa' : 'Definition') :
                                                question.category === 'analysis' ? (locale === 'vi' ? 'Phân tích' : 'Analysis') :
                                                question.category === 'application' ? (locale === 'vi' ? 'Ứng dụng' : 'Application') :
                                                (locale === 'vi' ? 'Tổng hợp' : 'Synthesis')}
                                             </span>
                                           )}
                                         </div>
                                       </div>
                                       <p className="font-medium text-gray-800 mb-3">
                                         {question.question}
                                       </p>
                                       <div className="space-y-2">
                                         {question.options.map((option: string, optionIndex: number) => (
                                           <button
                                             key={optionIndex}
                                             onClick={() => handleQuizAnswer(question.id, optionIndex)}
                                             className={`w-full text-left p-2 rounded-lg border transition-colors ${
                                               quizAnswers[question.id] === optionIndex
                                                 ? 'bg-blue-100 border-blue-300 text-blue-800'
                                                 : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                             }`}
                                           >
                                             {option}
                                           </button>
                                         ))}
                                       </div>
                                       <button
                                         onClick={() => handleCheckAnswer(question, quizAnswers[question.id])}
                                         disabled={quizAnswers[question.id] === undefined}
                                         className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                       >
                                         {t('search.quiz.checkAnswer')}
                                       </button>
                                     </div>
                                   ))}
                                 </div>
                                 <div className="mt-4 flex justify-between items-center">
                                   <div className="text-sm text-gray-600">
                                     <span>{locale === 'vi' ? 'Tiến độ' : 'Progress'}: {Object.keys(quizAnswers).length}/{message.quiz.questions.length}</span>
                                     <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                                       <div 
                                         className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                         style={{ width: `${(Object.keys(quizAnswers).length / message.quiz.questions.length) * 100}%` }}
                                       ></div>
                                     </div>
                                   </div>
                                   <button
                                     onClick={handleSubmitQuiz}
                                     disabled={Object.keys(quizAnswers).length < message.quiz.questions.length || isSubmittingQuiz}
                                     className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                   >
                                     {isSubmittingQuiz 
                                       ? t('search.quiz.submitting')
                                       : t('search.quiz.submitQuiz')
                                     }
                                   </button>
                                 </div>
                               </div>
                             )}
                             
                             {/* Quiz Results Display */}
                             {message.results && (
                               <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                                 <h4 className="font-semibold text-green-800 mb-3">
                                   {locale === 'vi' ? 'Kết quả chi tiết:' : 'Detailed Results:'}
                                 </h4>
                                 <div className="space-y-3">
                                   {message.results.map((result: any, index: number) => (
                                     <div key={index} className="border border-green-200 rounded-lg p-3 bg-white">
                                       <p className="font-medium text-gray-800 mb-2">{result.question}</p>
                                       <div className="flex items-center gap-2 mb-2">
                                         <span className={`text-sm px-2 py-1 rounded ${
                                           result.isCorrect 
                                             ? 'bg-green-100 text-green-800' 
                                             : 'bg-red-100 text-red-800'
                                         }`}>
                                           {result.isCorrect 
                                             ? (locale === 'vi' ? '✅ Đúng' : '✅ Correct')
                                             : (locale === 'vi' ? '❌ Sai' : '❌ Incorrect')
                                           }
                                         </span>
                                         <span className="text-sm text-gray-600">
                                           {locale === 'vi' ? 'Đáp án của bạn' : 'Your answer'}: {String.fromCharCode(65 + result.userAnswer)}
                                         </span>
                                         {!result.isCorrect && (
                                           <span className="text-sm text-gray-600">
                                             {locale === 'vi' ? 'Đáp án đúng' : 'Correct answer'}: {String.fromCharCode(65 + result.correctAnswer)}
                                           </span>
                                         )}
                                       </div>
                                       <p className="text-sm text-gray-700">{result.explanation}</p>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}
                           </>
                         )}
                        </div>
                        
                        {/* Message Actions - Show on hover for AI messages */}
                        {message.type === 'ai' && (
                          <div className="absolute -right-12 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="flex flex-col gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
                              <button
                                onClick={() => copyMessage(message.content)}
                                className="p-2 hover:bg-gray-100 rounded transition-colors"
                                title={locale === 'vi' ? 'Sao chép' : 'Copy'}
                              >
                                <Copy size={14} className="text-gray-600" />
                              </button>
                              <button
                                onClick={() => regenerateMessage(message.id)}
                                disabled={regeneratingMessageId === message.id}
                                className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                                title={locale === 'vi' ? 'Tạo lại' : 'Regenerate'}
                              >
                                <RefreshCw size={14} className={`text-gray-600 ${regeneratingMessageId === message.id ? 'animate-spin' : ''}`} />
                              </button>
                              <button
                                onClick={() => rateMessage(message.id, 'like')}
                                className="p-2 hover:bg-gray-100 rounded transition-colors"
                                title={locale === 'vi' ? 'Thích' : 'Like'}
                              >
                                <ThumbsUp size={14} className="text-gray-600" />
                              </button>
                              <button
                                onClick={() => rateMessage(message.id, 'dislike')}
                                className="p-2 hover:bg-gray-100 rounded transition-colors"
                                title={locale === 'vi' ? 'Không thích' : 'Dislike'}
                              >
                                <ThumbsDown size={14} className="text-gray-600" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Timestamp */}
                      <div className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-right text-blue-400' : 'text-left text-gray-400'
                      }`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {isChatting && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
                      <Bot size={16} />
                    </div>
                    <div className="bg-white rounded-2xl px-4 py-3 border border-gray-200 shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-sm text-gray-600">
                          {locale === 'vi' ? 'Đang suy nghĩ...' : 'Thinking...'}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
            
           <div className="flex flex-col sm:flex-row gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
             <div className="flex-1 relative">
               <input
                 type="text"
                 value={chatInput}
                 onChange={(e) => setChatInput(e.target.value)}
                 onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleChat()}
                 placeholder={chatLimit && !chatLimit.canChat 
                   ? (locale === 'vi' ? 'Bạn đã hết lượt chat AI hôm nay' : 'You have no AI chat left today')
                   : t('search.chatPlaceholder')
                 }
                 className="w-full p-3 pr-12 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder-gray-500 transition-all duration-200"
                 disabled={isChatting || (chatLimit ? !chatLimit.canChat : false)}
               />
               <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                 <span className="text-xs text-gray-400 hidden sm:block">
                   {chatInput.length > 0 && `${chatInput.length} chars`}
                 </span>
               </div>
             </div>
             
             <div className="flex gap-2">
               <motion.button
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.95 }}
                 onClick={handleChat}
                 disabled={isChatting || !chatInput.trim() || (chatLimit ? !chatLimit.canChat : false)}
                 className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
               >
                 <Send size={18} />
               </motion.button>
                                  
                                  {/* Quiz Settings Button - Fixed Position */}
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowQuizSettings(true)}
                                    className="px-2 sm:px-3 py-2 bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 text-gray-700 rounded-lg transition-all duration-200 border border-orange-200 hover:border-orange-300 shadow-sm flex items-center justify-center gap-1 text-xs"
                                  >
                                    <span className="text-orange-600">⚙️</span>
                                    <span className="hidden sm:inline">{t('search.quiz.settings.title')}</span>
                                  </motion.button>
                                </div>
                         </div>
             
             {/* Enhanced Quick suggestion buttons */}
             {chatMessages.length <= 1 && (
               <div className="mt-4">
                 <p className="text-sm text-gray-600 mb-3 font-medium">{t('search.quickSuggestions')}</p>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                   {(locale === 'vi' ? [
                     { text: '📝 Tóm tắt bài giảng', icon: '📝' },
                     { text: '🎯 Các điểm chính là gì?', icon: '🎯' },
                     { text: '🧠 Tạo quiz 8 câu', icon: '🧠' },
                     { text: '🔥 Tạo quiz khó 15 câu', icon: '🔥' },
                     { text: '💡 Tạo flashcard', icon: '💡' },
                     { text: '📚 Làm sao để học hiệu quả?', icon: '📚' },
                     { text: '❓ Giải thích khái niệm khó', icon: '❓' },
                     { text: '🔍 Tìm thông tin cụ thể', icon: '🔍' }
                   ] : [
                     { text: '📝 Summarize the lecture', icon: '📝' },
                     { text: '🎯 What are the main points?', icon: '🎯' },
                     { text: '🧠 Create quiz 8 questions', icon: '🧠' },
                     { text: '🔥 Create hard quiz 15 questions', icon: '🔥' },
                     { text: '💡 Create flashcards', icon: '💡' },
                     { text: '📚 How to study effectively?', icon: '📚' },
                     { text: '❓ Explain difficult concepts', icon: '❓' },
                     { text: '🔍 Find specific information', icon: '🔍' }
                   ]).map((suggestion, index) => (
                     <motion.button
                       key={index}
                       whileHover={{ scale: 1.02, y: -2 }}
                       whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        // Kiểm tra giới hạn chat trước khi gửi suggestion
                        if (chatLimit && !chatLimit.canChat) {
                          const limitMessage: ChatMessage = {
                            id: (Date.now() + 1).toString(),
                            type: 'ai',
                            content: locale === 'vi' 
                              ? `⚠️ **Bạn đã đạt giới hạn chat AI trong ngày!**\n\nBạn đã sử dụng ${chatLimit.usedCount}/${chatLimit.dailyLimit} lần chat AI hôm nay. Vui lòng quay lại vào ngày mai để tiếp tục sử dụng tính năng này.\n\n💡 **Gợi ý**: Bạn có thể sử dụng tính năng tìm kiếm để tìm thông tin trong bài giảng mà không cần chat AI.`
                              : `⚠️ **You have reached your daily AI chat limit!**\n\nYou have used ${chatLimit.usedCount}/${chatLimit.dailyLimit} AI chats today. Please come back tomorrow to continue using this feature.\n\n💡 **Suggestion**: You can use the search feature to find information in the lecture without needing AI chat.`,
                            timestamp: new Date()
                          };
                          setChatMessages(prev => [...prev, limitMessage]);
                          return;
                        }
                        
                        // Gửi suggestion trực tiếp mà không cần set input
                        handleSuggestionChat(suggestion.text);
                      }}
                       className="text-left bg-white hover:bg-gray-50 text-gray-700 px-4 py-3 rounded-xl transition-all duration-200 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md"
                     >
                       <span className="text-sm font-medium">{suggestion.text}</span>
                     </motion.button>
                   ))}
                 </div>
               </div>
             )}
          </div>
        )}
      </div>
      
      {/* Quiz Settings Modal */}
      {showQuizSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-3 sm:mx-4"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                {t('search.quiz.settings.title')}
              </h3>
              <button
                onClick={() => setShowQuizSettings(false)}
                className="text-gray-400 hover:text-gray-600 text-lg sm:text-xl"
              >
                ✕
              </button>
            </div>
            
            {/* Number of Questions */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                {t('search.quiz.settings.numberOfQuestions')}
              </label>
                             <div className="flex flex-wrap gap-1 sm:gap-2">
                 {[5, 8, 10, 15, 20].map((count) => (
                  <button
                    key={count}
                    onClick={() => setQuizSettings({...quizSettings, questionCount: count})}
                    className={`px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      quizSettings.questionCount === count
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Difficulty Level */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                {t('search.quiz.settings.difficultyLevel')}
              </label>
              <div className="grid grid-cols-2 gap-1 sm:gap-2">
                {[
                  { value: 'easy', label: t('search.quiz.settings.easy'), color: 'green' },
                  { value: 'intermediate', label: t('search.quiz.settings.intermediate'), color: 'yellow' },
                  { value: 'hard', label: t('search.quiz.settings.hard'), color: 'red' },
                  { value: 'mixed', label: t('search.quiz.settings.mixed'), color: 'blue' }
                ].map(({ value, label, color }) => (
                  <button
                    key={value}
                    onClick={() => setQuizSettings({...quizSettings, difficulty: value})}
                    className={`px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      quizSettings.difficulty === value
                        ? `bg-${color}-500 text-white`
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Question Types */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                {t('search.quiz.settings.questionTypes')}
              </label>
              <div className="space-y-1 sm:space-y-2">
                {[
                  { value: 'definition', label: t('search.quiz.settings.definition') },
                  { value: 'analysis', label: t('search.quiz.settings.analysis') },
                  { value: 'application', label: t('search.quiz.settings.application') },
                  { value: 'synthesis', label: t('search.quiz.settings.synthesis') }
                ].map(({ value, label }) => (
                  <label key={value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={quizSettings.questionTypes.includes(value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setQuizSettings({
                            ...quizSettings,
                            questionTypes: [...quizSettings.questionTypes, value]
                          });
                        } else {
                          setQuizSettings({
                            ...quizSettings,
                            questionTypes: quizSettings.questionTypes.filter(type => type !== value)
                          });
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-xs sm:text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                              <button
                  onClick={() => setShowQuizSettings(false)}
                  className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                >
                  {t('search.quiz.settings.cancel')}
                </button>
                              <button
                  onClick={() => {
                    setShowQuizSettings(false);
                    // Tạo quiz với cài đặt mới
                    setChatInput(locale === 'vi' ? 'Tạo quiz với cài đặt hiện tại' : 'Create quiz with current settings');
                    setTimeout(() => handleChat(), 100);
                  }}
                  className="flex-1 px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                  {t('search.quiz.settings.createQuiz')}
                </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SmartSearch;
