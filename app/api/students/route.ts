import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/lib/database'

// Get all students (for teacher to add to class)
export async function GET(req: NextRequest) {
  try {
    const students = await userService.findByRole('student')
    
    // Remove password from response for security
    const studentsWithoutPassword = students.map(student => {
      const { password, ...rest } = student
      return rest
    })
    
    return NextResponse.json({
      success: true,
      students: studentsWithoutPassword
    })
  } catch (error) {
    console.error('Get all students error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
