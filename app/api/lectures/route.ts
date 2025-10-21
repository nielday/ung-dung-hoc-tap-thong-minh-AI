import { NextRequest, NextResponse } from 'next/server'
import { lectureService } from '@/lib/database'

export async function POST(req: NextRequest) {
  try {
    const { userId, teacherId, filename, originalName, fileType, fileSize, content, summaryData, isPublic, permissions } = await req.json()
    
    if (!userId || !filename || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const lecture = await lectureService.create({
      userId,
      teacherId: teacherId || userId, // Default to userId if teacherId not provided
      filename,
      originalName: originalName || filename,
      fileType: fileType || 'text/plain',
      fileSize: BigInt(fileSize || content.length),
      content,
      summaryData,
      isPublic: isPublic || false,
      permissions: permissions || []
    })
    
    // Convert BigInt to string for JSON serialization
    const serializedLecture = {
      ...lecture,
      fileSize: lecture.fileSize.toString()
    }
    
    return NextResponse.json({
      success: true,
      lecture: serializedLecture
    })
  } catch (error) {
    console.error('Create lecture error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const teacherId = searchParams.get('teacherId')
    const studentId = searchParams.get('studentId')
    const lectureId = searchParams.get('lectureId')
    const force = searchParams.get('force')
    const timestamp = searchParams.get('t')
    
    console.log('📚 Lectures API called at:', new Date().toISOString())
    console.log('🔧 Force refresh:', !!force)
    console.log('⏰ Timestamp:', timestamp)
    console.log('👤 Teacher ID:', teacherId)
    console.log('🎓 Student ID:', studentId)
    
    if (lectureId) {
      // Get specific lecture
      const lecture = await lectureService.findById(lectureId)
      if (!lecture) {
        return NextResponse.json(
          { error: 'Lecture not found' },
          { status: 404 }
        )
      }
      // Convert BigInt to string for JSON serialization
      const serializedLecture = {
        ...lecture,
        fileSize: lecture.fileSize.toString()
      }
      
      return NextResponse.json({
        success: true,
        lecture: serializedLecture
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        }
      })
    }
    
    if (teacherId) {
      // Get all lectures created by teacher
      const lectures = await lectureService.findByTeacher(teacherId)
      
      console.log('📊 Raw lectures from DB:', lectures.length)
      console.log('📚 Lectures details:', lectures.map(l => ({ 
        id: l.id,
        originalName: l.originalName, 
        isPublic: l.isPublic,
        createdAt: l.createdAt 
      })))
      
      // Convert BigInt to string for JSON serialization
      const serializedLectures = lectures.map(lecture => ({
        ...lecture,
        fileSize: lecture.fileSize.toString()
      }))
      
      return NextResponse.json({
        success: true,
        lectures: serializedLectures,
        timestamp: new Date().toISOString(),
        count: serializedLectures.length,
        forceRefresh: !!force,
        apiVersion: '2.0'
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        }
      })
    }
    
    if (studentId) {
      // Get all lectures accessible by student
      const lectures = await lectureService.findAccessibleByStudent(studentId)
      
      // Convert BigInt to string for JSON serialization
      const serializedLectures = lectures.map(lecture => ({
        ...lecture,
        fileSize: lecture.fileSize.toString()
      }))
      
      return NextResponse.json({
        success: true,
        lectures: serializedLectures
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        }
      })
    }
    
    if (userId) {
      // Get all lectures for user (legacy support)
      const lectures = await lectureService.findByUser(userId)
      
      // Convert BigInt to string for JSON serialization
      const serializedLectures = lectures.map(lecture => ({
        ...lecture,
        fileSize: lecture.fileSize.toString()
      }))
      
      return NextResponse.json({
        success: true,
        lectures: serializedLectures
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        }
      })
    }
    
    return NextResponse.json(
      { error: 'User ID, Teacher ID, Student ID or Lecture ID required' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Get lecture error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { lectureId, summaryData } = await req.json()
    
    if (!lectureId) {
      return NextResponse.json(
        { error: 'Lecture ID required' },
        { status: 400 }
      )
    }
    
    const updatedLecture = await lectureService.update(lectureId, {
      summaryData: summaryData
    })
    
    return NextResponse.json({
      success: true,
      lecture: updatedLecture ? {
        ...updatedLecture,
        fileSize: updatedLecture.fileSize?.toString()
      } : null
    })
  } catch (error) {
    console.error('Update lecture error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lectureId = searchParams.get('lectureId')
    
    if (!lectureId) {
      return NextResponse.json(
        { error: 'Lecture ID required' },
        { status: 400 }
      )
    }
    
    const deletedLecture = await lectureService.delete(lectureId)
    
    return NextResponse.json({
      success: true,
      message: 'Lecture deleted successfully',
      lecture: deletedLecture ? {
        ...deletedLecture,
        fileSize: deletedLecture.fileSize?.toString()
      } : null
    })
  } catch (error) {
    console.error('Delete lecture error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}