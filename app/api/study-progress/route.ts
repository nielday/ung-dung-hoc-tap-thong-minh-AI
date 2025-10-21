import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to handle database errors
const handleDatabaseError = (error: any, operation: string) => {
  console.error(`Database error in ${operation}:`, error);
  return NextResponse.json(
    { success: false, message: `Database error: ${error.message}` },
    { status: 500 }
  );
};

// GET - Lấy tiến độ học tập của user cho một bài giảng
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const lectureId = searchParams.get('lectureId');

    if (!userId || !lectureId) {
      return NextResponse.json(
        { success: false, message: 'Missing userId or lectureId' },
        { status: 400 }
      );
    }

    console.log(`📊 Fetching study progress for user ${userId}, lecture ${lectureId}`);

    // Sử dụng Prisma ORM thay vì raw queries
    let studyProgress = await prisma.studyProgress.findFirst({
      where: {
        userId: userId,
        lectureId: lectureId
      }
    });

    // Nếu chưa có, tạo mới
    if (!studyProgress) {
      console.log('📝 Creating new study progress record');
      studyProgress = await prisma.studyProgress.create({
        data: {
          userId: userId,
          lectureId: lectureId,
          searchTabProgress: 0,
          chatTabProgress: 0,
          quizTabProgress: 0,
          flashcardTabProgress: 0,
          totalProgress: 0
        }
      });
    }

    // Lấy activities
    const activities = await prisma.studyActivity.findMany({
      where: {
        userId: userId,
        lectureId: lectureId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    const response = {
      success: true,
      studyProgress: {
        id: studyProgress.id,
        searchTabProgress: studyProgress.searchTabProgress || 0,
        chatTabProgress: studyProgress.chatTabProgress || 0,
        quizTabProgress: studyProgress.quizTabProgress || 0,
        flashcardTabProgress: studyProgress.flashcardTabProgress || 0,
        totalProgress: studyProgress.totalProgress || 0,
        lastUpdated: studyProgress.lastUpdated,
        activities: activities
      }
    };

    console.log('✅ Study progress fetched successfully:', response.studyProgress);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error fetching study progress:', error);
    return handleDatabaseError(error, 'GET study progress');
  }
}

// POST - Cập nhật tiến độ học tập
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      lectureId,
      activityType, // 'scroll', 'tab_visit', 'time_spent', 'interaction'
      tabName,      // 'search', 'chat', 'quiz', 'flashcard'
      progressValue, // 0-100
      duration,     // seconds
      metadata      // JSON data
    } = body;

    if (!userId || !lectureId || !activityType) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`📝 Updating study progress for user ${userId}, lecture ${lectureId}, activity: ${activityType}, tab: ${tabName}`);

    // Tìm hoặc tạo study progress record
    let studyProgress = await prisma.studyProgress.findFirst({
      where: {
        userId: userId,
        lectureId: lectureId
      }
    });

    if (!studyProgress) {
      console.log('📝 Creating new study progress record');
      studyProgress = await prisma.studyProgress.create({
        data: {
          userId: userId,
          lectureId: lectureId,
          searchTabProgress: 0,
          chatTabProgress: 0,
          quizTabProgress: 0,
          flashcardTabProgress: 0,
          totalProgress: 0
        }
      });
    }

    // Tạo activity record
    await prisma.studyActivity.create({
      data: {
        userId: userId,
        lectureId: lectureId,
        studyProgressId: studyProgress.id,
        activityType: activityType,
        tabName: tabName,
        progressValue: progressValue || 0,
        duration: duration,
        metadata: metadata || {}
      }
    });

    // Tính toán tiến độ mới cho tab
    const newTabProgress = calculateTabProgress(studyProgress, tabName, activityType, progressValue, duration);
    
    // Cập nhật tiến độ tab
    const updateData: any = {};
    if (tabName === 'search') {
      updateData.searchTabProgress = newTabProgress;
    } else if (tabName === 'chat') {
      updateData.chatTabProgress = newTabProgress;
    } else if (tabName === 'quiz') {
      updateData.quizTabProgress = newTabProgress;
    } else if (tabName === 'flashcard') {
      updateData.flashcardTabProgress = newTabProgress;
    }

    // Cập nhật record
    const updatedProgress = await prisma.studyProgress.update({
      where: { id: studyProgress.id },
      data: updateData
    });

    // Tính tổng tiến độ (trung bình của 4 tab)
    const totalProgress = (
      (updatedProgress.searchTabProgress || 0) +
      (updatedProgress.chatTabProgress || 0) +
      (updatedProgress.quizTabProgress || 0) +
      (updatedProgress.flashcardTabProgress || 0)
    ) / 4;

    // Cập nhật tổng tiến độ
    const finalProgress = await prisma.studyProgress.update({
      where: { id: studyProgress.id },
      data: {
        totalProgress: Math.round(totalProgress * 100) / 100,
        lastUpdated: new Date()
      }
    });

    const response = {
      success: true,
      studyProgress: {
        id: finalProgress.id,
        searchTabProgress: finalProgress.searchTabProgress || 0,
        chatTabProgress: finalProgress.chatTabProgress || 0,
        quizTabProgress: finalProgress.quizTabProgress || 0,
        flashcardTabProgress: finalProgress.flashcardTabProgress || 0,
        totalProgress: finalProgress.totalProgress || 0,
        lastUpdated: finalProgress.lastUpdated
      }
    };

    console.log('✅ Study progress updated successfully:', response.studyProgress);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error updating study progress:', error);
    return handleDatabaseError(error, 'POST study progress');
  }
}

// Hàm tính toán tiến độ cho từng tab
function calculateTabProgress(
  studyProgress: any,
  tabName: string | null,
  activityType: string,
  progressValue: number,
  duration: number | null
): number {
  if (!tabName) return 0;

  // Lấy tiến độ hiện tại của tab
  let currentProgress = 0;
  if (tabName === 'search') {
    currentProgress = studyProgress.searchTabProgress || 0;
  } else if (tabName === 'chat') {
    currentProgress = studyProgress.chatTabProgress || 0;
  } else if (tabName === 'quiz') {
    currentProgress = studyProgress.quizTabProgress || 0;
  } else if (tabName === 'flashcard') {
    currentProgress = studyProgress.flashcardTabProgress || 0;
  }

  // Logic tính tiến độ dựa trên loại hoạt động
  let newProgress = currentProgress;

  switch (activityType) {
    case 'tab_visit':
      // Truy cập tab: +10% (chỉ cộng nếu chưa có)
      if (currentProgress < 10) {
        newProgress = Math.max(newProgress, 10);
      }
      break;

    case 'scroll':
      // Scroll: cộng % scroll nhưng không vượt quá 60%
      if (progressValue > 80) {
        newProgress = Math.max(newProgress, 60);
      } else {
        newProgress = Math.max(newProgress, (progressValue * 0.6));
      }
      break;

    case 'time_spent':
      // Thời gian đọc: cộng % dựa trên thời gian
      if (duration && duration > 30) {
        newProgress = Math.max(newProgress, 30);
      } else if (duration && duration > 10) {
        newProgress = Math.max(newProgress, 20);
      }
      break;

    case 'interaction':
      // Tương tác: cộng % dựa trên loại tương tác
      if (progressValue > 0) {
        newProgress = Math.max(newProgress, Math.min(progressValue, 100));
      } else {
        // Nếu không có progressValue, cộng 15% cho mỗi lần tương tác
        newProgress = Math.max(newProgress, Math.min(currentProgress + 15, 100));
      }
      break;
  }

  console.log(`📊 Progress calculation: ${tabName} ${activityType} ${currentProgress}% -> ${newProgress}%`);
  return Math.min(newProgress, 100); // Không vượt quá 100%
}