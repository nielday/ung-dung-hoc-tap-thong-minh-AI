import { NextRequest, NextResponse } from 'next/server'
import { flashcardService } from '@/lib/database'

export async function POST(req: NextRequest) {
  try {
    const { userId, lectureId, front, back, category, difficulty, tags } = await req.json()
    
    if (!userId || !lectureId || !front || !back) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const flashcard = await flashcardService.create({
      userId,
      lectureId,
      frontContent: front,
      backContent: back,
      category: category || 'general',
      difficulty: difficulty || 'medium'
    })
    
    return NextResponse.json({
      success: true,
      flashcard
    })
  } catch (error) {
    console.error('Create flashcard error:', error)
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
    const userId = searchParams.get('userId')
    
    if (!lectureId || !userId) {
      return NextResponse.json(
        { error: 'Lecture ID and User ID required' },
        { status: 400 }
      )
    }
    
    const flashcards = await flashcardService.findByLecture(lectureId)
    
    return NextResponse.json({
      success: true,
      flashcards
    })
  } catch (error) {
    console.error('Get flashcards error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const flashcardId = searchParams.get('flashcardId')
    
    if (!flashcardId) {
      return NextResponse.json(
        { error: 'Flashcard ID required' },
        { status: 400 }
      )
    }
    
    await flashcardService.delete(flashcardId)
    
    return NextResponse.json({
      success: true,
      message: 'Flashcard deleted'
    })
  } catch (error) {
    console.error('Delete flashcard error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
