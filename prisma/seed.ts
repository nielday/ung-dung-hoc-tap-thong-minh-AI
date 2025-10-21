import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create sample teacher account
  const teacherPassword = await bcrypt.hash('teacher123', 10)
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@school.edu' },
    update: {},
    create: {
      username: 'teacher001',
      email: 'teacher@school.edu',
      password: teacherPassword,
      name: 'Nguyễn Văn Giáo',
      role: 'teacher',
      avatar: 'https://ui-avatars.com/api/?name=Teacher&background=4f46e5&color=fff'
    }
  })

  console.log('✅ Seeding completed!')
  console.log('👨‍🏫 Teacher:', teacher.email, '(password: teacher123)')
  console.log('📝 Note: No students created. Teachers can add students manually through the dashboard.')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
