import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

function generateQrToken(): string {
  return randomBytes(32).toString('base64url')
}

async function main() {
  console.log('Seeding database...')

  // Admin
  const passwordHash = await bcrypt.hash(
    process.env.ADMIN_INITIAL_PASSWORD ?? 'admin1234',
    12
  )

  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@haehan.com' },
    update: {},
    create: {
      name: '시스템 관리자',
      email: 'admin@haehan.com',
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  })
  console.log('Admin created:', admin.email)

  // Sample Site
  const existingSite = await prisma.site.findFirst({ where: { name: '해한 1호 현장' } })
  const site = existingSite ?? await prisma.site.create({
    data: {
      name: '해한 1호 현장',
      address: '서울특별시 강남구 테헤란로 123',
      latitude: 37.5065,
      longitude: 127.0536,
      allowedRadius: 200,
      qrToken: generateQrToken(),
    },
  })
  console.log('Site:', site.name, '| QR URL: /qr/' + site.qrToken)

  // Sample Worker
  const worker = await prisma.worker.upsert({
    where: { phone: '01012345678' },
    update: {},
    create: {
      name: '홍길동',
      phone: '01012345678',
      company: '해한건설',
      jobTitle: '형틀목공',
    },
  })
  console.log('Worker created:', worker.name)

  console.log('\nSeeding complete!')
  console.log('Admin login: admin@haehan.com / admin1234 (or ADMIN_INITIAL_PASSWORD)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
