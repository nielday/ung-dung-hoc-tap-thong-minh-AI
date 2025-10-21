import { prisma } from './prisma'

// User operations
export const userService = {
  async create(userData: {
    username: string
    email: string
    password: string
    name: string
    avatar?: string
  }) {
    return await prisma.user.create({
      data: userData
    })
  },

  async findByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email }
    })
  },

  async findByEmailOrUsername(identifier: string) {
    return await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier }
        ]
      }
    })
  },

  async findById(id: string) {
    return await prisma.user.findUnique({
      where: { id }
    })
  },

  async update(id: string, data: any) {
    return await prisma.user.update({
      where: { id },
      data
    })
  },

  async findByRole(role: string, forceRefresh = false) {
    if (forceRefresh) {
      console.log('🔄 Force refresh requested for findByRole')
    }
    
    const result = await prisma.user.findMany({
      where: { role },
      orderBy: { createdAt: 'desc' }
    })
    
    console.log(`📊 Found ${result.length} users with role: ${role}`)
    return result
  },

  async getStudentsByTeacher(teacherId: string) {
    return await prisma.teacherStudent.findMany({
      where: { teacherId },
      include: {
        student: true
      },
      orderBy: { createdAt: 'desc' }
    })
  },

  async addStudentToTeacher(teacherId: string, studentId: string) {
    // Check if relationship already exists
    const existing = await prisma.teacherStudent.findFirst({
      where: {
        teacherId,
        studentId
      }
    })
    
    if (existing) {
      throw new Error('Student is already enrolled in this teacher\'s class')
    }
    
    return await prisma.teacherStudent.create({
      data: {
        teacherId,
        studentId
      }
    })
  },

  async removeStudentFromTeacher(teacherId: string, studentId: string) {
    return await prisma.teacherStudent.deleteMany({
      where: {
        teacherId,
        studentId
      }
    })
  }
}

// Lecture operations
export const lectureService = {
  async create(lectureData: {
    userId: string
    teacherId: string
    filename: string
    originalName: string
    fileType: string
    fileSize: bigint
    content: string
    summaryData?: any
    isPublic?: boolean
    permissions?: string[]
  }) {
    return await prisma.lecture.create({
      data: {
        ...lectureData,
        permissions: lectureData.permissions || []
      }
    })
  },

  async findByUser(userId: string) {
    return await prisma.lecture.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
  },

  async findById(id: string) {
    return await prisma.lecture.findUnique({
      where: { id },
      include: {
        user: true,
        studyProgress: true,
        flashcards: true
      }
    })
  },

  async update(id: string, data: any) {
    return await prisma.lecture.update({
      where: { id },
      data
    })
  },

  async delete(id: string) {
    return await prisma.lecture.delete({
      where: { id }
    })
  },

  async findByTeacher(teacherId: string) {
    return await prisma.lecture.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' }
    })
  },

  async findAccessibleByStudent(studentId: string) {
    // Get all lectures first, then filter in JavaScript for SQLite compatibility
    const allLectures = await prisma.lecture.findMany({
      include: {
        teacher: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Filter lectures that are accessible by student
    return allLectures.filter(lecture => 
      lecture.isPublic || 
      (lecture.permissions && Array.isArray(lecture.permissions) && lecture.permissions.includes(studentId))
    )
  },

  async updatePermissions(lectureId: string, permissions: string[]) {
    return await prisma.lecture.update({
      where: { id: lectureId },
      data: { permissions }
    })
  },

  async updatePublicStatus(lectureId: string, isPublic: boolean) {
    return await prisma.lecture.update({
      where: { id: lectureId },
      data: { isPublic }
    })
  }
}

// Study Progress operations
export const studyProgressService = {
  async upsert(userId: string, lectureId: string, progressData: any) {
    return await prisma.studyProgress.upsert({
      where: {
        userId_lectureId: {
          userId,
          lectureId
        }
      },
      update: {
        quizProgress: progressData.quizProgress || {},
        reviewProgress: progressData.reviewProgress || {},
        practiceProgress: progressData.practiceProgress || {},
        sessionData: progressData.sessionData || {},
        lastUpdated: new Date()
      },
      create: {
        userId,
        lectureId,
        quizProgress: progressData.quizProgress || {},
        reviewProgress: progressData.reviewProgress || {},
        practiceProgress: progressData.practiceProgress || {},
        sessionData: progressData.sessionData || {}
      }
    })
  },

  async findByUser(userId: string) {
    return await prisma.studyProgress.findMany({
      where: { userId },
      include: {
        lecture: true
      },
      orderBy: { lastUpdated: 'desc' }
    })
  }
}


// Flashcard operations
export const flashcardService = {
  async create(flashcardData: {
    userId: string
    lectureId: string
    frontContent: string
    backContent: string
    difficulty?: string
    category?: string
  }) {
    return await prisma.flashcard.create({
      data: flashcardData
    })
  },

  async findByLecture(lectureId: string) {
    return await prisma.flashcard.findMany({
      where: { lectureId },
      orderBy: { createdAt: 'asc' }
    })
  },

  async updateMastery(id: string, masteryLevel: number) {
    return await prisma.flashcard.update({
      where: { id },
      data: { masteryLevel }
    })
  },

  async delete(id: string) {
    return await prisma.flashcard.delete({
      where: { id }
    })
  }
}
