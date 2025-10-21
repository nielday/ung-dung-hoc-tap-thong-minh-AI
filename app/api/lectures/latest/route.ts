import { NextRequest, NextResponse } from 'next/server'
import { lectureService } from '@/lib/database'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const role = searchParams.get('role') // 'teacher' or 'student'
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      )
    }
    
    let lectures
    let latestLecture
    
    if (role === 'teacher') {
      // Get latest lecture created by teacher
      lectures = await lectureService.findByTeacher(userId)
    } else {
      // Get latest lecture accessible by student
      lectures = await lectureService.findAccessibleByStudent(userId)
    }
    
    latestLecture = lectures[0] // Most recent lecture
    
    if (!latestLecture) {
      return NextResponse.json(
        { error: 'No lectures found' },
        { status: 404 }
      )
    }
    
    // Convert BigInt to string for JSON serialization
    const serializedLecture = {
      ...latestLecture,
      fileSize: latestLecture.fileSize.toString()
    }
    
    return NextResponse.json({
      success: true,
      lecture: serializedLecture
    })
  } catch (error) {
    console.error('Get latest lecture error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    return NextResponse.json(
      { error: 'Server error', details: errorMessage },
      { status: 500 }
    )
  }
}
