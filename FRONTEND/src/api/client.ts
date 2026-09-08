import axios from 'axios'
import { db } from '../db/db'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/',
  withCredentials: true,
})

api.interceptors.request.use(async (config) => {
  let token = localStorage.getItem('token')
  if (!token) {
    const active = await db.meta.get('activeOperator')
    const session = active ? await db.sessions.get(active.value) : undefined
    token = session?.token ?? null
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status ?? 0
    const detail = err.response?.data?.detail
    const message = typeof detail === 'string'
      ? detail
      : err.message || `Request failed on ${err.config?.url ?? ''}`
    return Promise.reject(new ApiError(status, message))
  }
)

export default api
export { api }
