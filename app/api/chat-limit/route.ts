import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Using raw queries to avoid Prisma Client issues
const getChatLimit = async (userId: string) => {
  try {
    const result = await prisma.$queryRaw`
      SELECT * FROM chat_limits WHERE user_id = ${userId}
    ` as any[];
    
    if (result && result.length > 0) {
      const row = result[0];
      return {
        userId: row.user_id,
        dailyLimit: parseInt(row.daily_limit),
        usedCount: parseInt(row.used_count),
        lastResetDate: new Date(row.last_reset_date)
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting chat limit:', error);
    return null;
  }
};

const createChatLimit = async (userId: string) => {
  try {
    // Generate UUID manually for PostgreSQL
    const id = `cl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await prisma.$executeRaw`
      INSERT INTO chat_limits (id, user_id, daily_limit, used_count, last_reset_date, created_at, updated_at)
      VALUES (${id}, ${userId}, 3, 0, NOW(), NOW(), NOW())
    `;
    
    console.log('✅ Created chat limit for user:', userId, 'with ID:', id);
    
    return { 
      userId, 
      dailyLimit: 3, 
      usedCount: 0, 
      lastResetDate: new Date() 
    };
  } catch (error) {
    console.error('Error creating chat limit:', error);
    return { 
      userId, 
      dailyLimit: 3, 
      usedCount: 0, 
      lastResetDate: new Date() 
    };
  }
};

const updateChatLimit = async (userId: string, data: any) => {
  try {
    await prisma.$executeRaw`
      UPDATE chat_limits 
      SET used_count = ${data.usedCount}, 
          last_reset_date = ${data.lastResetDate}, 
          updated_at = NOW()
      WHERE user_id = ${userId}
    `;
    return { 
      userId, 
      dailyLimit: data.dailyLimit || 3,
      usedCount: data.usedCount, 
      lastResetDate: data.lastResetDate 
    };
  } catch (error) {
    console.error('Error updating chat limit:', error);
    return { 
      userId, 
      dailyLimit: data.dailyLimit || 3,
      usedCount: data.usedCount, 
      lastResetDate: data.lastResetDate 
    };
  }
};

const upsertChatLimit = async (userId: string, data: any) => {
  try {
    // Generate UUID manually for PostgreSQL
    const id = `cl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await prisma.$executeRaw`
      INSERT INTO chat_limits (id, user_id, daily_limit, used_count, last_reset_date, created_at, updated_at)
      VALUES (${id}, ${userId}, ${data.dailyLimit || 3}, ${data.usedCount || 0}, NOW(), NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        daily_limit = ${data.dailyLimit || 3},
        used_count = ${data.usedCount || 0},
        last_reset_date = NOW(),
        updated_at = NOW()
    `;
    
    console.log('✅ Upserted chat limit for user:', userId, 'with data:', data);
    
    return { 
      userId, 
      dailyLimit: data.dailyLimit || 3,
      usedCount: data.usedCount || 0, 
      lastResetDate: new Date() 
    };
  } catch (error) {
    console.error('Error upserting chat limit:', error);
    return { 
      userId, 
      dailyLimit: data.dailyLimit || 3,
      usedCount: data.usedCount || 0, 
      lastResetDate: new Date() 
    };
  }
};

// GET: Kiểm tra giới hạn chat của user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Tìm hoặc tạo chat limit record cho user
    let chatLimit = await getChatLimit(userId);
    console.log('🔍 Initial chatLimit for userId:', userId, chatLimit);

    // Nếu chưa có record, tạo mới
    if (!chatLimit) {
      console.log('📝 Creating new chat limit for userId:', userId);
      chatLimit = await createChatLimit(userId);
      console.log('✅ Created chatLimit:', chatLimit);
    }

    // Kiểm tra xem có cần reset daily count không
    const today = new Date();
    const lastReset = new Date(chatLimit.lastResetDate);
    console.log('📅 Today:', today.toDateString(), 'Last reset:', lastReset.toDateString());
    
    // Nếu ngày khác nhau, reset usedCount về 0
    if (today.toDateString() !== lastReset.toDateString()) {
      console.log('🔄 Resetting daily count for userId:', userId);
      chatLimit = await updateChatLimit(userId, {
        usedCount: 0,
        lastResetDate: today
      });
      console.log('✅ Reset chatLimit:', chatLimit);
    } else {
      console.log('✅ No reset needed, using existing data');
    }

    const result = {
      dailyLimit: chatLimit.dailyLimit,
      usedCount: chatLimit.usedCount,
      remainingCount: chatLimit.dailyLimit - chatLimit.usedCount,
      canChat: chatLimit.usedCount < chatLimit.dailyLimit,
      lastResetDate: chatLimit.lastResetDate
    };
    
    console.log('📊 Final result for userId:', userId, result);

    return NextResponse.json({
      success: true,
      chatLimit: result
    });

  } catch (error) {
    console.error('Error checking chat limit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Sử dụng một lần chat AI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Kiểm tra giới hạn hiện tại
    let chatLimit = await getChatLimit(userId);

    if (!chatLimit) {
      chatLimit = await createChatLimit(userId);
    }

    // Kiểm tra xem có cần reset daily count không
    const today = new Date();
    const lastReset = new Date(chatLimit.lastResetDate);
    
    if (today.toDateString() !== lastReset.toDateString()) {
      chatLimit = await updateChatLimit(userId, {
        usedCount: 0,
        lastResetDate: today
      });
    }

    // Kiểm tra xem còn lượt chat không
    if (chatLimit.usedCount >= chatLimit.dailyLimit) {
      return NextResponse.json({
        success: false,
        error: 'Daily chat limit exceeded',
        chatLimit: {
          dailyLimit: chatLimit.dailyLimit,
          usedCount: chatLimit.usedCount,
          remainingCount: 0,
          canChat: false,
          lastResetDate: chatLimit.lastResetDate
        }
      });
    }

    // Tăng usedCount lên 1
    const updatedChatLimit = await updateChatLimit(userId, {
      usedCount: chatLimit.usedCount + 1
    });

    return NextResponse.json({
      success: true,
      chatLimit: {
        dailyLimit: updatedChatLimit.dailyLimit,
        usedCount: updatedChatLimit.usedCount,
        remainingCount: updatedChatLimit.dailyLimit - updatedChatLimit.usedCount,
        canChat: updatedChatLimit.usedCount < updatedChatLimit.dailyLimit,
        lastResetDate: updatedChatLimit.lastResetDate
      }
    });

  } catch (error) {
    console.error('Error updating chat limit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Cập nhật giới hạn chat (chỉ dành cho admin/teacher)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, dailyLimit } = body;

    if (!userId || !dailyLimit) {
      return NextResponse.json(
        { error: 'User ID and daily limit are required' },
        { status: 400 }
      );
    }

    const updatedChatLimit = await upsertChatLimit(userId, {
      dailyLimit: parseInt(dailyLimit),
      usedCount: 0, // Reset khi thay đổi giới hạn
      lastResetDate: new Date()
    });

    return NextResponse.json({
      success: true,
      chatLimit: {
        dailyLimit: updatedChatLimit.dailyLimit,
        usedCount: updatedChatLimit.usedCount,
        remainingCount: updatedChatLimit.dailyLimit - updatedChatLimit.usedCount,
        canChat: updatedChatLimit.usedCount < updatedChatLimit.dailyLimit,
        lastResetDate: updatedChatLimit.lastResetDate
      }
    });

  } catch (error) {
    console.error('Error updating chat limit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
