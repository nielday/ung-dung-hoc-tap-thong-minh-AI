import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/lib/database'

// Get all students with no cache (for debugging)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const force = searchParams.get('force')
    const timestamp = searchParams.get('t')
    
    console.log('🔍 Fresh students API called at:', new Date().toISOString())
    console.log('🔧 Force refresh:', !!force)
    console.log('⏰ Timestamp:', timestamp)
    
    // Force database connection refresh if needed
    if (force) {
      console.log('🔄 Force refresh requested - bypassing any potential caching')
    }
    
    const students = await userService.findByRole('student', !!force)
    
    console.log('📊 Raw students from DB:', students.length)
    console.log('👥 Students details:', students.map(s => ({ 
      id: s.id,
      username: s.username, 
      email: s.email, 
      role: s.role,
      createdAt: s.createdAt 
    })))
    
    // Remove password from response for security
    const studentsWithoutPassword = students.map(student => {
      const { password, ...rest } = student
      return rest
    })
    
    const responseData = {
      success: true,
      students: studentsWithoutPassword,
      timestamp: new Date().toISOString(),
      count: studentsWithoutPassword.length,
      forceRefresh: !!force,
      apiVersion: '2.0'
    }
    
    console.log('✅ Returning response:', responseData)
    
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${Date.now()}-${Math.random()}"`
      }
    })
  } catch (error) {
    console.error('❌ Fresh students API error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    )
  }
}
