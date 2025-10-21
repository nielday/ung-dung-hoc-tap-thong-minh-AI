import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Lấy ngôn ngữ từ Accept-Language header
    const acceptLanguage = request.headers.get('accept-language') || 'vi'
    const language = acceptLanguage.startsWith('en') ? 'en' : 'vi'
    
    console.log('Chat request language:', language)
    console.log('Accept-Language header:', acceptLanguage)
    
    // Parse request body once
    const body = await request.json();
    const { question, lectureData, conversationHistory, quizAction, quizSettings, userId } = body;

    // Check if GROQ API key is available
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'GROQ API key not configured' },
        { status: 500 }
      );
    }

    // Kiểm tra giới hạn chat AI cho sinh viên (chỉ áp dụng cho chat thông thường, không áp dụng cho quiz)
    if (!quizAction && userId) {
      try {
        // Kiểm tra chat limit trực tiếp từ database
        const result = await prisma.$queryRaw`
          SELECT * FROM chat_limits WHERE user_id = ${userId}
        ` as any[];
        
        let chatLimit = null;
        if (result && result.length > 0) {
          const row = result[0];
          chatLimit = {
            userId: row.user_id,
            dailyLimit: parseInt(row.daily_limit),
            usedCount: parseInt(row.used_count),
            lastResetDate: new Date(row.last_reset_date)
          };
        }
        
        // Nếu chưa có record, tạo mới
        if (!chatLimit) {
          const id = `cl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await prisma.$executeRaw`
            INSERT INTO chat_limits (id, user_id, daily_limit, used_count, last_reset_date, created_at, updated_at)
            VALUES (${id}, ${userId}, 3, 0, NOW(), NOW(), NOW())
          `;
          chatLimit = { userId, dailyLimit: 3, usedCount: 0, lastResetDate: new Date() };
        }
        
        // Kiểm tra xem có cần reset daily count không
        const today = new Date();
        const lastReset = new Date(chatLimit.lastResetDate);
        
        if (today.toDateString() !== lastReset.toDateString()) {
          await prisma.$executeRaw`
            UPDATE chat_limits 
            SET used_count = 0, last_reset_date = ${today}, updated_at = NOW()
            WHERE user_id = ${userId}
          `;
          chatLimit.usedCount = 0;
        }
        
        // Kiểm tra xem còn lượt chat không
        if (chatLimit.usedCount >= chatLimit.dailyLimit) {
          return NextResponse.json({
            error: 'Daily chat limit exceeded',
            message: language === 'vi' 
              ? 'Bạn đã đạt giới hạn 3 lần chat AI trong ngày. Vui lòng quay lại vào ngày mai để tiếp tục sử dụng tính năng này.'
              : 'You have reached the daily limit of 3 AI chats. Please come back tomorrow to continue using this feature.',
            chatLimit: {
              dailyLimit: chatLimit.dailyLimit,
              usedCount: chatLimit.usedCount,
              remainingCount: 0,
              canChat: false,
              lastResetDate: chatLimit.lastResetDate
            }
          }, { status: 429 });
        }
      } catch (limitError) {
        console.error('Error checking chat limit:', limitError);
        // Tiếp tục xử lý nếu không thể kiểm tra giới hạn
      }
    }

    // Handle quiz creation request
    if (quizAction === 'create_quiz') {
      return await handleQuizCreation(lectureData, language, quizSettings);
    }

    // Handle quiz submission and grading
    if (quizAction === 'submit_quiz') {
      return await handleQuizSubmission(body, lectureData, language);
    }

    // Handle quiz answer check
    if (quizAction === 'check_answer') {
      return await handleAnswerCheck(body, lectureData, language);
    }

    if (!question || !lectureData) {
      return NextResponse.json(
        { error: 'Missing required fields: question and lectureData' },
        { status: 400 }
      );
    }

    // Prepare context from lecture data
    const content = lectureData.content || '';
    const summary = lectureData.summary || '';
    const filename = lectureData.filename || 'bài giảng';
    const keyPoints = lectureData.keyPoints || [];
    const objectives = lectureData.objectives || [];

    // Create context string - chỉ đưa thông tin cần thiết
    let context = `${language === 'vi' ? 'Tên tài liệu' : 'Document name'}: ${filename}\n\n`;
    if (summary) {
      context += `${language === 'vi' ? 'Tóm tắt' : 'Summary'}: ${summary}\n\n`;
    }
    if (keyPoints.length > 0) {
      context += `${language === 'vi' ? 'Các điểm chính' : 'Key points'}:\n${keyPoints.map((point: any, index: number) => `${index + 1}. ${point.content}`).join('\n')}\n\n`;
    }
    if (objectives.length > 0) {
      context += `${language === 'vi' ? 'Mục tiêu học tập' : 'Learning objectives'}:\n${objectives.map((obj: any, index: number) => `${index + 1}. ${obj.title}: ${obj.description}`).join('\n')}\n\n`;
    }
    
    // Chỉ đưa nội dung chi tiết nếu cần thiết, không đưa toàn bộ
    const contentPreview = content.length > 500 ? content.substring(0, 500) + '...' : content;
    context += `${language === 'vi' ? 'Nội dung chính' : 'Main content'}: ${contentPreview}`;

    // Prepare conversation history
    const historyText = conversationHistory
      ?.map((msg: any) => `${msg.type === 'user' ? (language === 'vi' ? 'Người dùng' : 'User') : 'AI'}: ${msg.content}`)
      .join('\n') || '';

         // Create prompt for AI
     const prompt = `Bạn là một trợ lý AI học tập thông minh và thân thiện. Hãy trả lời câu hỏi của người dùng một cách tự nhiên, hữu ích và có cảm xúc phù hợp.

NGÔN NGỮ YÊU CẦU: ${language === 'vi' ? 'Tiếng Việt' : 'English'}
${language === 'vi' ? 'Luôn xưng "mình" và gọi người dùng là "bạn"' : 'Use natural, friendly English'}

⚠️ QUAN TRỌNG VỀ NGÔN NGỮ:
- TẤT CẢ câu trả lời PHẢI bằng ${language === 'vi' ? 'Tiếng Việt' : 'English'}
- KHÔNG được trộn lẫn ngôn ngữ
- Nếu language='en' thì TẤT CẢ phải bằng English
- Nếu language='vi' thì TẤT CẢ phải bằng Tiếng Việt

NỘI DUNG BÀI GIẢNG:
${context}

${historyText ? `${language === 'vi' ? 'LỊCH SỬ HỘI THOẠI GẦN ĐÂY' : 'RECENT CONVERSATION HISTORY'}:
${historyText}

` : ''}${language === 'vi' ? 'CÂU HỎI HIỆN TẠI' : 'CURRENT QUESTION'}: ${question}

${language === 'vi' ? 'HƯỚNG DẪN TRẢ LỜI THÔNG MINH' : 'SMART RESPONSE GUIDELINES'}:
1. ${language === 'vi' ? 'KHÔNG đưa toàn bộ nội dung file vào câu trả lời' : 'DO NOT include entire file content in the response'}
2. ${language === 'vi' ? 'Chỉ trích dẫn thông tin cần thiết và liên quan' : 'Only quote necessary and relevant information'}
3. ${language === 'vi' ? 'Nếu là nhân vật lịch sử: Chỉ nêu tên và thông tin quan trọng nhất' : 'If it\'s a historical figure: Only mention name and most important information'}
4. ${language === 'vi' ? 'Nếu là khái niệm: Giải thích ngắn gọn và dễ hiểu' : 'If it\'s a concept: Explain briefly and understandably'}
5. ${language === 'vi' ? 'Nếu câu hỏi cá nhân: Trả lời thân thiện và đồng cảm' : 'If personal questions: Respond friendly and empathetically'}
6. ${language === 'vi' ? 'Sử dụng ngôn ngữ tự nhiên, thân thiện' : 'Use natural, friendly language'}
7. ${language === 'vi' ? 'Có thể sử dụng emoji phù hợp để tạo cảm giác gần gũi' : 'You can use appropriate emojis to create a friendly feeling'}
8. ${language === 'vi' ? 'Luôn khuyến khích người dùng học tập và tìm hiểu thêm' : 'Always encourage users to study and learn more'}
9. ${language === 'vi' ? 'Nếu không biết câu trả lời: Thành thật thừa nhận và đề xuất hướng khác' : 'If you don\'t know the answer: Honestly admit and suggest alternatives'}

${language === 'vi' ? 'TÍNH NĂNG QUIZ TƯƠNG TÁC' : 'INTERACTIVE QUIZ FEATURES'}:
- ${language === 'vi' ? 'Nếu người dùng yêu cầu tạo quiz: Tạo 3-5 câu hỏi trắc nghiệm với đáp án' : 'If user requests quiz: Create 3-5 multiple choice questions with answers'}
- ${language === 'vi' ? 'Nếu người dùng trả lời quiz: Chấm điểm và giải thích đáp án' : 'If user answers quiz: Grade and explain answers'}
- ${language === 'vi' ? 'Sử dụng format đặc biệt để hiển thị quiz tương tác' : 'Use special format to display interactive quiz'}

${language === 'vi' ? 'VÍ DỤ TRẢ LỜI THÔNG MINH' : 'SMART RESPONSE EXAMPLES'}:
${language === 'vi' ? 
'- Nếu hỏi về Putin: "Vladimir Putin là Tổng thống Nga từ năm 2000, nổi tiếng với chính sách đối ngoại mạnh mẽ..."' :
'- If asking about Putin: "Vladimir Putin has been President of Russia since 2000, known for his strong foreign policy..."'}

${language === 'vi' ? 'TRẢ LỜI' : 'RESPONSE'}:`;

    // Call Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
                 messages: [
           {
                           role: 'system',
              content: `Bạn là một trợ lý AI học tập thông minh và thân thiện. Bạn có những đặc điểm sau:

1. VAI TRÒ: Hỗ trợ học tập và nghiên cứu
2. TÍNH CÁCH: Thân thiện, đồng cảm, khuyến khích
3. NGÔN NGỮ: ${language === 'vi' ? 'Tiếng Việt tự nhiên, xưng "mình" và gọi người dùng là "bạn"' : 'Natural English, friendly and encouraging'}${language === 'vi' ? ', có thể dùng emoji phù hợp' : ', you can use appropriate emojis'}

⚠️ QUAN TRỌNG: TẤT CẢ câu trả lời PHẢI bằng ${language === 'vi' ? 'Tiếng Việt' : 'English'}. KHÔNG được trộn lẫn ngôn ngữ.

4. KHẢ NĂNG: 
   - ${language === 'vi' ? 'Giải thích nội dung bài giảng một cách thông minh' : 'Explain lecture content intelligently'}
   - ${language === 'vi' ? 'Trả lời câu hỏi học tập ngắn gọn và chính xác' : 'Answer study questions concisely and accurately'}
   - ${language === 'vi' ? 'Động viên và khuyến khích học tập' : 'Encourage and motivate learning'}
   - ${language === 'vi' ? 'Trò chuyện thân thiện về cảm xúc học tập' : 'Have friendly conversations about learning emotions'}
   - ${language === 'vi' ? 'Tạo quiz tương tác và chấm điểm' : 'Create interactive quizzes and grade them'}

5. XỬ LÝ CÂU HỎI THÔNG MINH:
   - ${language === 'vi' ? 'KHÔNG đưa toàn bộ nội dung file vào câu trả lời' : 'DO NOT include entire file content in the response'}
   - ${language === 'vi' ? 'Chỉ trích dẫn thông tin cần thiết và liên quan' : 'Only quote necessary and relevant information'}
   - ${language === 'vi' ? 'Nếu là nhân vật lịch sử: Chỉ nêu tên và thông tin quan trọng nhất' : 'If it\'s a historical figure: Only mention name and most important information'}
   - ${language === 'vi' ? 'Nếu là khái niệm: Giải thích ngắn gọn và dễ hiểu' : 'If it\'s a concept: Explain briefly and understandably'}
   - ${language === 'vi' ? 'Câu hỏi cá nhân: Thân thiện, đồng cảm, hướng về học tập' : 'Personal questions: Friendly, empathetic, focused on learning'}

6. NGUYÊN TẮC: ${language === 'vi' ? 'Luôn hướng về mục tiêu hỗ trợ học tập hiệu quả, trả lời thông minh và không thô' : 'Always focus on the goal of effective learning support, respond intelligently and not crudely'}`
           },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        top_p: 1,
        stream: false
      })
    });

         if (!response.ok) {
       if (response.status === 429) {
         throw new Error('Rate limit exceeded. Please try again in a moment.');
       }
       throw new Error(`Groq API error: ${response.status}`);
     }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || 'Xin lỗi, tôi không thể tạo câu trả lời. Vui lòng thử lại.';

    // Cập nhật giới hạn chat sau khi chat thành công (chỉ cho chat thông thường)
    if (!quizAction && userId) {
      try {
        console.log('🔄 Updating chat limit for user:', userId);
        
        // Tăng usedCount lên 1
        await prisma.$executeRaw`
          UPDATE chat_limits 
          SET used_count = used_count + 1, updated_at = NOW()
          WHERE user_id = ${userId}
        `;
        
        console.log('✅ Chat limit updated successfully for user:', userId);
      } catch (limitError) {
        console.error('Error updating chat limit:', limitError);
        // Không throw error để không ảnh hưởng đến response
      }
    }

    return NextResponse.json({
      response: aiResponse,
      success: true
    });

  } catch (error) {
    console.error('Chat generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate chat response',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle quiz creation
async function handleQuizCreation(lectureData: any, language: string, quizSettings?: any) {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: 'GROQ API key not configured' }, { status: 500 });
    }

    const content = lectureData.content || '';
    const summary = lectureData.summary || '';
    const filename = lectureData.filename || 'bài giảng';

    // Use quiz settings if provided, otherwise use defaults
    const settings = quizSettings || {
      questionCount: 8,
      difficulty: 'mixed',
      questionTypes: ['definition', 'analysis', 'application', 'synthesis']
    };

         const prompt = `${language === 'vi' ? 'Bạn là chuyên gia tạo câu hỏi trắc nghiệm. Tạo một quiz tương tác với' : 'You are a quiz creation expert. Create an interactive quiz with'} ${settings.questionCount} ${language === 'vi' ? 'câu hỏi thông minh và đa dạng' : 'smart and diverse questions'} ${language === 'vi' ? 'dựa trên nội dung sau' : 'based on the following content'}:

${language === 'vi' ? '⚠️ QUAN TRỌNG: Bạn PHẢI tạo đúng' : '⚠️ IMPORTANT: You MUST create exactly'} ${settings.questionCount} ${language === 'vi' ? 'câu hỏi, không ít hơn và không nhiều hơn' : 'questions, no less and no more'}.

${language === 'vi' ? 'Tên tài liệu' : 'Document name'}: ${filename}
${language === 'vi' ? 'Tóm tắt' : 'Summary'}: ${summary}
${language === 'vi' ? 'Nội dung' : 'Content'}: ${content.substring(0, 3000)}

${language === 'vi' ? 'YÊU CẦU CHI TIẾT' : 'DETAILED REQUIREMENTS'}:

1. ${language === 'vi' ? 'Tạo' : 'Create'} ${settings.questionCount} ${language === 'vi' ? 'câu hỏi với độ khó:' : 'questions with difficulty:'} ${settings.difficulty === 'mixed' ? 
  (language === 'vi' ? 'Hỗn hợp (dễ, trung bình, khó)' : 'Mixed (easy, intermediate, hard)') : 
  settings.difficulty === 'easy' ? (language === 'vi' ? 'Dễ' : 'Easy') :
  settings.difficulty === 'intermediate' ? (language === 'vi' ? 'Trung bình' : 'Intermediate') :
  (language === 'vi' ? 'Khó' : 'Hard')}

2. ${language === 'vi' ? 'Loại câu hỏi:' : 'Question types:'} ${settings.questionTypes.map((type: string) => {
    switch(type) {
      case 'definition': return language === 'vi' ? 'Định nghĩa' : 'Definition';
      case 'analysis': return language === 'vi' ? 'Phân tích' : 'Analysis';
      case 'application': return language === 'vi' ? 'Ứng dụng' : 'Application';
      case 'synthesis': return language === 'vi' ? 'Tổng hợp' : 'Synthesis';
      default: return type;
    }
  }).join(', ')}

3. ${language === 'vi' ? 'Mỗi câu có 4 lựa chọn (A, B, C, D) thông minh' : 'Each question has 4 smart options (A, B, C, D)'}:
   - ${language === 'vi' ? '1 đáp án đúng rõ ràng dựa trên nội dung thực tế' : '1 clearly correct answer based on actual content'}
   - ${language === 'vi' ? '2-3 đáp án sai hợp lý (có thể gây nhầm lẫn)' : '2-3 plausible wrong answers (potentially confusing)'}
   - ${language === 'vi' ? 'Tránh đáp án quá rõ ràng sai' : 'Avoid obviously wrong answers'}

4. ${language === 'vi' ? 'Dựa trên nội dung THỰC TẾ của tài liệu - KHÔNG tạo câu hỏi chung chung' : 'Based on ACTUAL content of the document - DO NOT create generic questions'}
5. ${language === 'vi' ? 'Giải thích chi tiết cho mỗi câu hỏi' : 'Detailed explanation for each question'}
6. ${language === 'vi' ? 'TẤT CẢ nội dung phải bằng' : 'ALL content must be in'} ${language === 'vi' ? 'TIẾNG VIỆT' : 'ENGLISH'}

7. ${language === 'vi' ? 'QUAN TRỌNG: Mỗi câu hỏi PHẢI khác nhau hoàn toàn, không được lặp lại nội dung, từ khóa, hoặc cấu trúc câu hỏi' : 'IMPORTANT: Each question MUST be completely different, no repetition of content, keywords, or question structure'}
8. ${language === 'vi' ? 'Sử dụng các từ khóa và khái niệm khác nhau cho mỗi câu hỏi' : 'Use different keywords and concepts for each question'}
9. ${language === 'vi' ? 'Tạo câu hỏi về các khía cạnh khác nhau của nội dung tài liệu' : 'Create questions about different aspects of the document content'}
10. ${language === 'vi' ? 'MỖI CÂU HỎI PHẢI SỬ DỤNG TỪ KHÓA KHÁC NHAU - KHÔNG ĐƯỢC LẶP LẠI TỪ KHÓA' : 'EACH QUESTION MUST USE DIFFERENT KEYWORDS - NO KEYWORD REPETITION'}
11. ${language === 'vi' ? 'Tạo câu hỏi về các sự kiện, con người, địa điểm, thời gian, khái niệm KHÁC NHAU' : 'Create questions about DIFFERENT events, people, places, times, concepts'}
12. ${language === 'vi' ? 'Sử dụng các cấu trúc câu hỏi đa dạng: "Khi nào...?", "Tại sao...?", "Làm thế nào...?", "Ai...?", "Ở đâu...?", "Cái gì...?"' : 'Use diverse question structures: "When...?", "Why...?", "How...?", "Who...?", "Where...?", "What...?"'}

13. ${language === 'vi' ? 'ĐỘ KHÓ CÂU HỎI:' : 'QUESTION DIFFICULTY:'}
    ${language === 'vi' ? '- DỄ: Câu hỏi cơ bản, trực tiếp từ nội dung, đáp án rõ ràng' : '- EASY: Basic questions, directly from content, clear answers'}
    ${language === 'vi' ? '- TRUNG BÌNH: Câu hỏi yêu cầu hiểu và phân tích, đáp án cần suy luận' : '- INTERMEDIATE: Questions requiring understanding and analysis, answers need reasoning'}
    ${language === 'vi' ? '- KHÓ: Câu hỏi phức tạp, yêu cầu tổng hợp, so sánh, đánh giá, đáp án không rõ ràng' : '- HARD: Complex questions requiring synthesis, comparison, evaluation, unclear answers'}

${language === 'vi' ? 'VÍ DỤ CÂU HỎI THÔNG MINH VÀ ĐA DẠNG' : 'SMART AND DIVERSE QUESTION EXAMPLES'}:
${language === 'vi' ? 
'- Nếu tài liệu về Hồ Chí Minh: "Hồ Chí Minh sinh năm nào và ở đâu?" (định nghĩa), "Tại sao Hồ Chí Minh được coi là lãnh tụ vĩ đại?" (phân tích), "Làm thế nào để áp dụng tư tưởng Hồ Chí Minh trong cuộc sống?" (ứng dụng), "Tư tưởng Hồ Chí Minh đóng góp gì cho cách mạng Việt Nam?" (tổng hợp), "Ai là người đã ảnh hưởng đến tư tưởng của Hồ Chí Minh?" (định nghĩa), "Khi nào Hồ Chí Minh bắt đầu hoạt động cách mạng?" (định nghĩa), "Ở đâu Hồ Chí Minh đã học tập và rèn luyện?" (định nghĩa), "Cái gì là đặc điểm nổi bật trong phong cách lãnh đạo của Hồ Chí Minh?" (phân tích)' :
'- If document about Ho Chi Minh: "When and where was Ho Chi Minh born?" (definition), "Why is Ho Chi Minh considered a great leader?" (analysis), "How can Ho Chi Minh\'s ideology be applied in life?" (application), "What does Ho Chi Minh\'s ideology contribute to the Vietnamese revolution?" (synthesis), "Who influenced Ho Chi Minh\'s ideology?" (definition), "When did Ho Chi Minh begin revolutionary activities?" (definition), "Where did Ho Chi Minh study and train?" (definition), "What are the outstanding characteristics of Ho Chi Minh\'s leadership style?" (analysis)'}

${language === 'vi' ? 'TRẢ LỜI BẮT BUỘC BẰNG JSON FORMAT SAU:' : 'MUST RESPOND WITH THIS JSON FORMAT:'}
{
  "quiz": {
    "title": "${language === 'vi' ? 'Quiz về' : 'Quiz about'} ${filename}",
    "questions": [
      {
        "id": "q1",
        "question": "${language === 'vi' ? 'Câu hỏi cụ thể dựa trên nội dung thực tế của tài liệu?' : 'Specific question based on actual document content?'}",
        "options": [
          "A. ${language === 'vi' ? 'Đáp án dựa trên nội dung thực tế' : 'Answer based on actual content'}",
          "B. ${language === 'vi' ? 'Đáp án sai hợp lý' : 'Plausible wrong answer'}",
          "C. ${language === 'vi' ? 'Đáp án sai hợp lý' : 'Plausible wrong answer'}",
          "D. ${language === 'vi' ? 'Đáp án sai hợp lý' : 'Plausible wrong answer'}"
        ],
        "correctAnswer": 0,
        "difficulty": "easy",
        "category": "definition",
        "explanation": "${language === 'vi' ? 'Giải thích chi tiết tại sao đáp án này đúng và các đáp án khác sai' : 'Detailed explanation why this answer is correct and others are wrong'}"
      }
    ]
  }
}

⚠️ ${language === 'vi' ? 'QUAN TRỌNG: Chỉ trả về JSON hợp lệ, không có text khác, không có markdown, không có giải thích thêm' : 'IMPORTANT: Only return valid JSON, no other text, no markdown, no additional explanations'}.

${language === 'vi' ? 'QUY TẮC CUỐI CÙNG: Mỗi câu hỏi PHẢI sử dụng từ khóa khác nhau, không được lặp lại bất kỳ từ khóa nào đã sử dụng trong các câu hỏi trước đó' : 'FINAL RULE: Each question MUST use different keywords, no repetition of any keywords used in previous questions'}.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
             body: JSON.stringify({
         model: 'llama-3.1-8b-instant',
         messages: [{ role: 'user', content: prompt }],
         temperature: 0.7,
         max_tokens: 4000,
         top_p: 1,
         stream: false
       })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '';

         // Try to parse JSON response
     try {
       // Clean the response to extract JSON
       let cleanResponse = aiResponse.trim();
       
       // Remove markdown code blocks if present
       if (cleanResponse.startsWith('```json')) {
         cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/```\n?/, '');
       } else if (cleanResponse.startsWith('```')) {
         cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/```\n?/, '');
       }
       
       // Try to find JSON object in the response
       const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
       if (jsonMatch) {
         cleanResponse = jsonMatch[0];
       }
       
       const quizData = JSON.parse(cleanResponse);
       
       // Validate quiz structure
       if (!quizData.quiz || !quizData.quiz.questions || !Array.isArray(quizData.quiz.questions)) {
         throw new Error('Invalid quiz structure');
       }
       
       return NextResponse.json({
         response: `${language === 'vi' ? 'Mình đã tạo quiz cho bạn! 🎯' : 'I\'ve created a quiz for you! 🎯'}\n\n**${quizData.quiz.title}**\n\n${language === 'vi' ? 'Hãy trả lời các câu hỏi sau:' : 'Please answer the following questions:'}`,
         quiz: quizData.quiz,
         success: true
       });
          } catch (parseError) {
       console.log('AI Response that failed to parse:', aiResponse);
       console.log('Parse error:', parseError);
       
       // Fallback quiz với cài đặt người dùng - Cải thiện để tránh lặp lại
      const questionCount = settings.questionCount;
      const questions = [];
      
      // Tạo câu hỏi thực tế dựa trên nội dung tài liệu
      const content = lectureData.content || '';
      const summary = lectureData.summary || '';
      
      // Tạo danh sách từ khóa đa dạng từ nội dung
      const contentWords = content.split(' ').filter((word: string) => word.length > 3);
      const keyWords = contentWords.slice(0, Math.min(50, contentWords.length));
      const uniqueWords = Array.from(new Set(keyWords)); // Loại bỏ từ trùng lặp
      
      // Tạo danh sách câu hỏi mẫu đa dạng
      const questionTemplates = [
        // Definition questions
        {
          vi: (word: string, filename: string) => `Theo nội dung, "${word}" trong ${filename} có nghĩa là gì?`,
          en: (word: string, filename: string) => `According to the content, what does "${word}" mean in ${filename}?`
        },
        {
          vi: (word: string, filename: string) => `Khái niệm "${word}" được định nghĩa như thế nào trong ${filename}?`,
          en: (word: string, filename: string) => `How is the concept "${word}" defined in ${filename}?`
        },
        // Analysis questions
        {
          vi: (word: string, filename: string) => `Tại sao "${word}" quan trọng trong ${filename}?`,
          en: (word: string, filename: string) => `Why is "${word}" important in ${filename}?`
        },
        {
          vi: (word: string, filename: string) => `Dựa trên nội dung, "${word}" có vai trò gì trong ${filename}?`,
          en: (word: string, filename: string) => `Based on the content, what role does "${word}" play in ${filename}?`
        },
        // Application questions
        {
          vi: (word: string, filename: string) => `Làm thế nào để áp dụng "${word}" trong thực tế?`,
          en: (word: string, filename: string) => `How can "${word}" be applied in practice?`
        },
        {
          vi: (word: string, filename: string) => `Ví dụ nào minh họa cho "${word}" trong ${filename}?`,
          en: (word: string, filename: string) => `What example illustrates "${word}" in ${filename}?`
        },
        // Synthesis questions
        {
          vi: (word: string, filename: string) => `Làm thế nào "${word}" liên quan đến chủ đề chính của ${filename}?`,
          en: (word: string, filename: string) => `How does "${word}" relate to the main topic of ${filename}?`
        },
        {
          vi: (word: string, filename: string) => `Tổng hợp lại, "${word}" đóng góp gì cho ${filename}?`,
          en: (word: string, filename: string) => `In summary, what does "${word}" contribute to ${filename}?`
        }
      ];
      
      // Tạo câu hỏi dựa trên settings và nội dung thực tế - Cải thiện để tránh lặp lại
      const usedWords = new Set<string>(); // Theo dõi từ khóa đã sử dụng
      const usedTemplates = new Set<number>(); // Theo dõi template đã sử dụng
      
      for (let i = 1; i <= Math.min(questionCount, 20); i++) {
        const difficulty = settings.difficulty === 'mixed' ? 
          (i <= Math.floor(questionCount * 0.4) ? 'easy' : 
           i <= Math.floor(questionCount * 0.7) ? 'intermediate' : 'hard') : 
          settings.difficulty;
        
        const category = settings.questionTypes[i % settings.questionTypes.length] || 'definition';
        
        // Chọn từ khóa chưa sử dụng
        let selectedWord = '';
        for (let j = 0; j < uniqueWords.length; j++) {
          const word = uniqueWords[j] as string;
          if (!usedWords.has(word) && word.length > 2) {
            selectedWord = word;
            usedWords.add(word);
            break;
          }
        }
        
        // Nếu không có từ khóa mới, tạo từ khóa đa dạng
        if (!selectedWord) {
          const fallbackWords = [
            language === 'vi' ? 'nội dung' : 'content',
            language === 'vi' ? 'chủ đề' : 'topic',
            language === 'vi' ? 'khái niệm' : 'concept',
            language === 'vi' ? 'ý tưởng' : 'idea',
            language === 'vi' ? 'thông tin' : 'information',
            language === 'vi' ? 'dữ liệu' : 'data',
            language === 'vi' ? 'kiến thức' : 'knowledge',
            language === 'vi' ? 'vấn đề' : 'issue'
          ];
          selectedWord = fallbackWords[i % fallbackWords.length];
        }
        
        // Chọn template chưa sử dụng
        const categoryTemplates = questionTemplates.filter((_, index) => {
          if (category === 'definition') return index < 2;
          if (category === 'analysis') return index >= 2 && index < 4;
          if (category === 'application') return index >= 4 && index < 6;
          if (category === 'synthesis') return index >= 6;
          return true;
        });
        
        let templateIndex = 0;
        for (let j = 0; j < categoryTemplates.length; j++) {
          const globalIndex = questionTemplates.indexOf(categoryTemplates[j]);
          if (!usedTemplates.has(globalIndex)) {
            templateIndex = j;
            usedTemplates.add(globalIndex);
            break;
          }
        }
        
        const template = categoryTemplates[templateIndex] || questionTemplates[0];
        
        // Tạo câu hỏi với cấu trúc đa dạng
        const questionText = language === 'vi' ? 
          template.vi(selectedWord, filename) :
          template.en(selectedWord, filename);
        
        // Tạo đáp án đa dạng dựa trên từ khóa và loại câu hỏi
        let correctOption = '';
        let wrongOptions = [];
        
                 if (category === 'definition') {
           if (difficulty === 'hard') {
             correctOption = language === 'vi' ? 
               `Định nghĩa chính xác và chi tiết về "${selectedWord}" trong bối cảnh phức tạp` :
               `Accurate and detailed definition of "${selectedWord}" in complex context`;
             wrongOptions = [
               language === 'vi' ? `Định nghĩa cơ bản về "${selectedWord}"` : `Basic definition of "${selectedWord}"`,
               language === 'vi' ? `Khái niệm tương tự nhưng khác "${selectedWord}"` : `Similar but different concept to "${selectedWord}"`,
               language === 'vi' ? `Ứng dụng thực tế của "${selectedWord}"` : `Practical application of "${selectedWord}"`
             ];
           } else {
             correctOption = language === 'vi' ? 
               `Định nghĩa chính xác về "${selectedWord}"` :
               `Accurate definition of "${selectedWord}"`;
             wrongOptions = [
               language === 'vi' ? `Khái niệm liên quan đến "${selectedWord}"` : `Concept related to "${selectedWord}"`,
               language === 'vi' ? `Ví dụ về "${selectedWord}"` : `Example of "${selectedWord}"`,
               language === 'vi' ? `Ứng dụng của "${selectedWord}"` : `Application of "${selectedWord}"`
             ];
           }
         } else if (category === 'analysis') {
           if (difficulty === 'hard') {
             correctOption = language === 'vi' ? 
               `Phân tích sâu và đa chiều về "${selectedWord}" với nhiều góc nhìn` :
               `Deep and multi-dimensional analysis of "${selectedWord}" with multiple perspectives`;
             wrongOptions = [
               language === 'vi' ? `Phân tích cơ bản về "${selectedWord}"` : `Basic analysis of "${selectedWord}"`,
               language === 'vi' ? `So sánh đơn giản với "${selectedWord}"` : `Simple comparison with "${selectedWord}"`,
               language === 'vi' ? `Mô tả tổng quan về "${selectedWord}"` : `General description of "${selectedWord}"`
             ];
           } else {
             correctOption = language === 'vi' ? 
               `Phân tích sâu về "${selectedWord}"` :
               `Deep analysis of "${selectedWord}"`;
             wrongOptions = [
               language === 'vi' ? `Mô tả cơ bản về "${selectedWord}"` : `Basic description of "${selectedWord}"`,
               language === 'vi' ? `So sánh với "${selectedWord}"` : `Comparison with "${selectedWord}"`,
               language === 'vi' ? `Đánh giá về "${selectedWord}"` : `Evaluation of "${selectedWord}"`
             ];
           }
         } else if (category === 'application') {
           if (difficulty === 'hard') {
             correctOption = language === 'vi' ? 
               `Cách áp dụng "${selectedWord}" trong tình huống phức tạp và thực tế` :
               `How to apply "${selectedWord}" in complex and real-world situations`;
             wrongOptions = [
               language === 'vi' ? `Cách áp dụng cơ bản "${selectedWord}"` : `Basic application of "${selectedWord}"`,
               language === 'vi' ? `Định nghĩa của "${selectedWord}"` : `Definition of "${selectedWord}"`,
               language === 'vi' ? `Ví dụ đơn giản về "${selectedWord}"` : `Simple example of "${selectedWord}"`
             ];
           } else {
             correctOption = language === 'vi' ? 
               `Cách áp dụng "${selectedWord}"` :
               `How to apply "${selectedWord}"`;
             wrongOptions = [
               language === 'vi' ? `Định nghĩa của "${selectedWord}"` : `Definition of "${selectedWord}"`,
               language === 'vi' ? `Ví dụ về "${selectedWord}"` : `Example of "${selectedWord}"`,
               language === 'vi' ? `Phân tích "${selectedWord}"` : `Analysis of "${selectedWord}"`
             ];
           }
         } else {
           if (difficulty === 'hard') {
             correctOption = language === 'vi' ? 
               `Tổng hợp và đánh giá toàn diện về "${selectedWord}" với nhiều khía cạnh` :
               `Comprehensive synthesis and evaluation of "${selectedWord}" with multiple aspects`;
             wrongOptions = [
               language === 'vi' ? `Tổng hợp cơ bản về "${selectedWord}"` : `Basic synthesis of "${selectedWord}"`,
               language === 'vi' ? `Định nghĩa của "${selectedWord}"` : `Definition of "${selectedWord}"`,
               language === 'vi' ? `Phân tích đơn giản "${selectedWord}"` : `Simple analysis of "${selectedWord}"`
             ];
           } else {
             correctOption = language === 'vi' ? 
               `Tổng hợp về "${selectedWord}"` :
               `Synthesis about "${selectedWord}"`;
             wrongOptions = [
               language === 'vi' ? `Định nghĩa của "${selectedWord}"` : `Definition of "${selectedWord}"`,
               language === 'vi' ? `Phân tích "${selectedWord}"` : `Analysis of "${selectedWord}"`,
               language === 'vi' ? `Ứng dụng "${selectedWord}"` : `Application of "${selectedWord}"`
             ];
           }
         }
        
        // Xáo trộn đáp án
        const allOptions = [correctOption, ...wrongOptions];
        const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);
        const correctAnswer = shuffledOptions.indexOf(correctOption);
        
        const options = shuffledOptions.map((option, index) => 
          `${String.fromCharCode(65 + index)}. ${option}`
        );
        
        const explanation = language === 'vi' ? 
          `Đáp án đúng là "${correctOption}" vì nó phù hợp với loại câu hỏi ${category} về "${selectedWord}" dựa trên nội dung tài liệu.` :
          `The correct answer is "${correctOption}" because it fits the ${category} question type about "${selectedWord}" based on the document content.`;
        
        questions.push({
          id: `q${i}`,
          question: questionText,
          options: options,
          correctAnswer: correctAnswer,
          difficulty: difficulty,
          category: category,
          explanation: explanation
        });
      }
      
      const fallbackQuiz = {
        title: language === 'vi' ? `Quiz về ${filename}` : `Quiz about ${filename}`,
        questions: questions
      };

      return NextResponse.json({
        response: `${language === 'vi' ? 'Mình đã tạo quiz cho bạn! 🎯' : 'I\'ve created a quiz for you! 🎯'}\n\n**${fallbackQuiz.title}**\n\n${language === 'vi' ? 'Hãy trả lời các câu hỏi sau:' : 'Please answer the following questions:'}`,
        quiz: fallbackQuiz,
        success: true
      });
    }

  } catch (error) {
    console.error('Quiz creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create quiz' },
      { status: 500 }
    );
  }
}

// Handle quiz submission and grading
async function handleQuizSubmission(body: any, lectureData: any, language: string) {
  try {
    const { quiz, answers } = body;
    
    if (!quiz || !answers) {
      return NextResponse.json({ error: 'Missing quiz or answers' }, { status: 400 });
    }

    let correctCount = 0;
    const results = [];

    for (const question of quiz.questions) {
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correctAnswer;
      
      if (isCorrect) {
        correctCount++;
      }

      results.push({
        questionId: question.id,
        question: question.question,
        userAnswer: userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect: isCorrect,
        explanation: question.explanation
      });
    }

    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const performance = score >= 80 ? 
      (language === 'vi' ? 'Xuất sắc! 🎉' : 'Excellent! 🎉') : 
      score >= 60 ? 
      (language === 'vi' ? 'Tốt! 👍' : 'Good! 👍') : 
      score >= 40 ? 
      (language === 'vi' ? 'Trung bình 😊' : 'Average 😊') : 
      (language === 'vi' ? 'Cần cải thiện 💪' : 'Needs improvement 💪');

    const response = `${language === 'vi' ? 'Kết quả quiz của bạn:' : 'Your quiz results:'}\n\n**${performance}**\n\n${language === 'vi' ? 'Điểm số' : 'Score'}: ${correctCount}/${quiz.questions.length} (${score}%)\n\n${language === 'vi' ? 'Chi tiết từng câu:' : 'Details for each question:'}\n\n`;

    return NextResponse.json({
      response: response,
      results: results,
      score: score,
      correctCount: correctCount,
      totalQuestions: quiz.questions.length,
      success: true
    });

  } catch (error) {
    console.error('Quiz submission error:', error);
    return NextResponse.json(
      { error: 'Failed to grade quiz' },
      { status: 500 }
    );
  }
}

// Handle individual answer check
async function handleAnswerCheck(body: any, lectureData: any, language: string) {
  try {
    const { question, userAnswer, correctAnswer, explanation } = body;
    
    const isCorrect = userAnswer === correctAnswer;
    
    const response = isCorrect ? 
      `${language === 'vi' ? '✅ Đúng rồi! Chúc mừng bạn!' : '✅ Correct! Congratulations!'}` :
      `${language === 'vi' ? '❌ Chưa đúng. Đáp án đúng là:' : '❌ Incorrect. The correct answer is:'} ${String.fromCharCode(65 + correctAnswer)}`;
    
    const fullResponse = `${response}\n\n${language === 'vi' ? 'Giải thích' : 'Explanation'}: ${explanation}`;

    return NextResponse.json({
      response: fullResponse,
      isCorrect: isCorrect,
      success: true
    });

  } catch (error) {
    console.error('Answer check error:', error);
    return NextResponse.json(
      { error: 'Failed to check answer' },
      { status: 500 }
    );
  }
}
