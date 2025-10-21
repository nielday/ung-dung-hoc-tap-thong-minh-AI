import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const { lectureId, summaryData } = await req.json()
    
    if (!lectureId || !summaryData) {
      return NextResponse.json(
        { error: 'Missing lectureId or summaryData' },
        { status: 400 }
      )
    }
    
    // Update lecture với summary data
    const lecture = await prisma.lecture.update({
      where: { id: lectureId },
      data: { summaryData: summaryData }
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
    console.error('Update summary error:', error)
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
    
    console.log('🔍 GET /api/summary - lectureId:', lectureId)
    
    if (!lectureId) {
      console.log('❌ No lecture ID provided')
      return NextResponse.json(
        { error: 'Lecture ID required' },
        { status: 400 }
      )
    }
    
    console.log('📡 Finding lecture in database...')
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId }
    })
    
    if (!lecture) {
      console.log('❌ Lecture not found:', lectureId)
      return NextResponse.json(
        { error: 'Lecture not found' },
        { status: 404 }
      )
    }
    
    console.log('✅ Lecture found:', lecture.id)
    console.log('📦 summaryData:', lecture.summaryData)
    
    // Convert BigInt to string for JSON serialization
    const serializedLecture = {
      ...lecture,
      fileSize: lecture.fileSize.toString()
    }
    
    return NextResponse.json({
      success: true,
      lecture: serializedLecture,
      summaryData: lecture.summaryData
    })
  } catch (error) {
    console.error('💥 Get summary error:', error)
    return NextResponse.json(
      { error: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
