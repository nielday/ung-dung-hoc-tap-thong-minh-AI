import { NextRequest, NextResponse } from 'next/server'
import { Groq } from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { text, numQuestions = 10, difficulty = 'mixed' } = await req.json()
    
    if (!text) {
      return NextResponse.json(
        { error: 'Text content is required' },
        { status: 400 }
      )
    }

    const locale = req.headers.get('Accept-Language') || req.headers.get('X-Locale') || 'vi'
    const isVietnamese = locale === 'vi'

    const systemPrompt = isVietnamese 
      ? `Bạn là một giáo viên chuyên nghiệp. Hãy tạo ${numQuestions} câu hỏi trắc nghiệm từ nội dung tài liệu sau. Mỗi câu hỏi phải có:
- Câu hỏi rõ ràng và cụ thể
- 4 lựa chọn A, B, C, D
- Chỉ có 1 đáp án đúng
- Giải thích chi tiết tại sao đáp án đó đúng
- Phân loại độ khó: easy, medium, hard
- Phân loại chủ đề phù hợp

Trả về JSON format:
{
  "questions": [
    {
      "id": "1",
      "question": "Câu hỏi...",
      "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3", "D. Lựa chọn 4"],
      "correctAnswer": 0,
      "explanation": "Giải thích...",
      "difficulty": "easy",
      "category": "Chủ đề"
    }
  ]
}`
      : `You are a professional teacher. Create ${numQuestions} multiple choice questions from the following content. Each question must have:
- Clear and specific question
- 4 options A, B, C, D
- Only 1 correct answer
- Detailed explanation why that answer is correct
- Difficulty classification: easy, medium, hard
- Appropriate topic classification

Return JSON format:
{
  "questions": [
    {
      "id": "1",
      "question": "Question...",
      "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
      "correctAnswer": 0,
      "explanation": "Explanation...",
      "difficulty": "easy",
      "category": "Topic"
    }
  ]
}`

    const userPrompt = isVietnamese
      ? `Tạo ${numQuestions} câu hỏi trắc nghiệm từ nội dung sau:\n\n${text}`
      : `Create ${numQuestions} multiple choice questions from the following content:\n\n${text}`

    console.log('Generating quiz with locale:', locale)
    console.log('System prompt:', systemPrompt.substring(0, 100) + '...')

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No content generated')
    }

    console.log('Raw AI response:', content.substring(0, 200) + '...')

    // Try to parse JSON response
    let questions
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      throw new Error('Invalid AI response format')
    }

    // Validate questions structure
    if (!questions.questions || !Array.isArray(questions.questions)) {
      throw new Error('Invalid questions structure')
    }

    // Ensure each question has required fields
    const validatedQuestions = questions.questions.map((q: any, index: number) => ({
      id: q.id || (index + 1).toString(),
      question: q.question || '',
      options: q.options || [],
      correctAnswer: q.correctAnswer || 0,
      explanation: q.explanation || '',
      difficulty: q.difficulty || 'medium',
      category: q.category || (isVietnamese ? 'Tổng quan' : 'Overview')
    }))

    console.log('Generated questions:', validatedQuestions.length)
    console.log('First question:', validatedQuestions[0]?.question?.substring(0, 50))

    return NextResponse.json({
      success: true,
      questions: validatedQuestions,
      totalQuestions: validatedQuestions.length
    })

  } catch (error) {
    console.error('Error generating quiz:', error)
    return NextResponse.json(
      { error: 'Failed to generate quiz questions' },
      { status: 500 }
    )
  }
}