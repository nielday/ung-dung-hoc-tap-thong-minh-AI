import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { 
      title, 
      description, 
      questions, 
      lectureId, 
      difficulty,
      teacherId 
    } = await req.json()
    
    if (!title || !questions || !lectureId) {
      return NextResponse.json(
        { error: 'Missing required fields: title, questions, lectureId' },
        { status: 400 }
      )
    }

    // Validate questions structure
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'Questions must be a non-empty array' },
        { status: 400 }
      )
    }

    // Validate each question
    for (const question of questions) {
      if (!question.question || !question.options || !Array.isArray(question.options)) {
        return NextResponse.json(
          { error: 'Each question must have question text and options array' },
          { status: 400 }
        )
      }
    }

    // Create quiz in database
    const quiz = await prisma.quiz.create({
      data: {
        title,
        description: description || '',
        questions: questions,
        difficulty: difficulty || 'mixed',
        lectureId,
        teacherId: teacherId || '', // Will be set from auth context
        isActive: true
      },
      include: {
        lecture: {
          select: {
            originalName: true,
            filename: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questions: quiz.questions,
        difficulty: quiz.difficulty,
        lectureId: quiz.lectureId,
        teacherId: quiz.teacherId,
        isActive: quiz.isActive,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
        lecture: quiz.lecture
      }
    })
  } catch (error) {
    console.error('Create quiz error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lectureId = searchParams.get('lectureId')
    const teacherId = searchParams.get('teacherId')
    
    let whereClause: any = { isActive: true }
    
    if (lectureId) {
      whereClause.lectureId = lectureId
    }
    
    if (teacherId) {
      whereClause.teacherId = teacherId
    }

    const quizzes = await prisma.quiz.findMany({
      where: whereClause,
      include: {
        lecture: {
          select: {
            originalName: true,
            filename: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      quizzes
    })
  } catch (error) {
    console.error('Get quizzes error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const quizId = searchParams.get('quizId')
    
    if (!quizId) {
      return NextResponse.json(
        { error: 'quizId is required' },
        { status: 400 }
      )
    }

    // Soft delete by setting isActive to false
    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: { isActive: false }
    })

    return NextResponse.json({
      success: true,
      message: 'Quiz deleted successfully'
    })
  } catch (error) {
    console.error('Delete quiz error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
