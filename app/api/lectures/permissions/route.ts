import { NextRequest, NextResponse } from 'next/server'
import { lectureService } from '@/lib/database'

// Update lecture permissions
export async function PUT(req: NextRequest) {
  try {
    const { lectureId, permissions, isPublic } = await req.json()
    
    console.log('Update permissions request:', { lectureId, permissions, isPublic })
    
    if (!lectureId) {
      return NextResponse.json(
        { error: 'Lecture ID required' },
        { status: 400 }
      )
    }
    
    let result
    
    if (permissions !== undefined) {
      console.log('Updating permissions for lecture:', lectureId, 'with:', permissions)
      result = await lectureService.updatePermissions(lectureId, permissions)
      console.log('Permissions update result:', result)
    }
    
    if (isPublic !== undefined) {
      console.log('Updating public status for lecture:', lectureId, 'to:', isPublic)
      result = await lectureService.updatePublicStatus(lectureId, isPublic)
      console.log('Public status update result:', result)
    }
    
    // Get the updated lecture to return complete information
    const updatedLecture = await lectureService.findById(lectureId)
    console.log('📚 Updated lecture from DB:', updatedLecture)
    
    return NextResponse.json({
      success: true,
      lecture: updatedLecture ? {
        ...updatedLecture,
        fileSize: updatedLecture.fileSize?.toString()
      } : null,
      permissions: permissions,
      isPublic: isPublic,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('Update lecture permissions error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
