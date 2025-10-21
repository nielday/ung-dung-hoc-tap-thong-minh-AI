import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/lib/database'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, username, email, password, name } = body
    
    if (action === 'login') {
      // Handle login
      if (!email || !password) {
        return NextResponse.json(
          { error: 'Email and password required' },
          { status: 400 }
        )
      }
      
      // Find user by email or username
      const user = await userService.findByEmailOrUsername(email)
      if (!user) {
        return NextResponse.json(
          { error: 'Tài khoản không tồn tại' },
          { status: 404 }
        )
      }
      
      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Mật khẩu không đúng' },
          { status: 401 }
        )
      }
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user
      
      return NextResponse.json({
        success: true,
        user: userWithoutPassword
      })
    } else {
      // Handle register
      if (!username || !email || !password || !name) {
        return NextResponse.json(
          { error: 'All fields required' },
          { status: 400 }
        )
      }
      
      // Check if user already exists
      const existingUser = await userService.findByEmail(email)
      if (existingUser) {
        return NextResponse.json(
          { error: 'Email đã được sử dụng' },
          { status: 400 }
        )
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10)
      
      // Create user
      const user = await userService.create({
        username,
        email,
        password: hashedPassword,
        name,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
      })
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user
      
      return NextResponse.json({
        success: true,
        user: userWithoutPassword
      })
    }
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    const password = searchParams.get('password')
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }
    
    // Find user by email or username
    const user = await userService.findByEmailOrUsername(email)
    if (!user) {
      return NextResponse.json(
        { error: 'Tài khoản không tồn tại' },
        { status: 404 }
      )
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Mật khẩu không đúng' },
        { status: 401 }
      )
    }
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user
    
    return NextResponse.json({
      success: true,
      user: userWithoutPassword
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
