import { NextRequest, NextResponse } from 'next/server'
import { userService, lectureService } from '@/lib/database'

// Get all students for a teacher
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const teacherId = searchParams.get('teacherId')
    
    if (!teacherId) {
      return NextResponse.json(
        { error: 'Teacher ID required' },
        { status: 400 }
      )
    }
    
    const students = await userService.getStudentsByTeacher(teacherId)
    
    return NextResponse.json({
      success: true,
      students
    })
  } catch (error) {
    console.error('Get students error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

// Add student to teacher
export async function POST(req: NextRequest) {
  try {
    const { teacherId, studentId } = await req.json()
    
    if (!teacherId || !studentId) {
      return NextResponse.json(
        { error: 'Teacher ID and Student ID required' },
        { status: 400 }
      )
    }
    
    const result = await userService.addStudentToTeacher(teacherId, studentId)
    
    return NextResponse.json({
      success: true,
      result
    })
  } catch (error) {
    console.error('Add student error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

// Remove student from teacher
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const teacherId = searchParams.get('teacherId')
    const studentId = searchParams.get('studentId')
    
    if (!teacherId || !studentId) {
      return NextResponse.json(
        { error: 'Teacher ID and Student ID required' },
        { status: 400 }
      )
    }
    
    await userService.removeStudentFromTeacher(teacherId, studentId)
    
    return NextResponse.json({
      success: true,
      message: 'Student removed from teacher'
    })
  } catch (error) {
    console.error('Remove student error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
