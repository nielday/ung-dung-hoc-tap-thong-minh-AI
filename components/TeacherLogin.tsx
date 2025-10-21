'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'

interface TeacherLoginProps {
  onLoginSuccess: () => void
  onBackToStudent: () => void
}

export default function TeacherLogin({ onLoginSuccess, onBackToStudent }: TeacherLoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { updateUser } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'login',
          email,
          password,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Check if user is a teacher
        if (data.user.role === 'teacher') {
          // Set user in AuthContext and localStorage
          localStorage.setItem('user', JSON.stringify(data.user))
          updateUser(data.user)
          onLoginSuccess()
        } else {
          setError('Chỉ tài khoản giáo viên mới được phép đăng nhập')
        }
      } else {
        setError(data.error || 'Đăng nhập thất bại')
      }
    } catch (error) {
      setError('Lỗi kết nối, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">👨‍🏫</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Đăng nhập Giáo viên
          </h1>
          <p className="text-gray-600">
            Tài khoản do nhà trường cấp
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email nhà trường
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="teacher@school.edu"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onBackToStudent}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Quay lại đăng nhập sinh viên
          </button>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-medium text-blue-800 mb-3 text-center">📞 Liên hệ để được cấp tài khoản giảng viên</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <span className="font-medium">👤 Phong The Storm</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <span>📱</span>
              <span className="font-mono">0813516686</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <span>📧</span>
              <span className="font-mono">phonghd.2005.io@gmail.com</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
