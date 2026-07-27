/**
 * Google Tasks integration — pure utility functions.
 * All OAuth flow is handled by the Hono backend (/api/google/*).
 * This module provides pure functions for bucketing + sorting tasks.
 */
import type { GoogleTask, GoogleTaskBucket } from './types'

function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function getTaskBucket(task: GoogleTask): GoogleTaskBucket {
  if (!task.due) return 'noDue'
  const dueDay = startOfDayUTC(new Date(task.due))
  const todayDay = startOfDayUTC(new Date())
  const weekEnd = new Date(todayDay.getTime() + 7 * 24 * 60 * 60 * 1000)

  if (dueDay < todayDay) return 'overdue'
  if (dueDay.getTime() === todayDay.getTime()) return 'today'
  if (dueDay < weekEnd) return 'thisWeek'
  return 'later'
}

export const BUCKET_ORDER: GoogleTaskBucket[] = ['overdue', 'today', 'thisWeek', 'later', 'noDue']

export const BUCKET_LABEL: Record<GoogleTaskBucket, string> = {
  overdue: '⚠ Overdue',
  today: 'Today',
  thisWeek: 'This Week',
  later: 'Later',
  noDue: 'No Due Date',
}

export function groupTasksByBucket(tasks: GoogleTask[]): Map<GoogleTaskBucket, GoogleTask[]> {
  const groups = new Map<GoogleTaskBucket, GoogleTask[]>()
  for (const bucket of BUCKET_ORDER) {
    groups.set(bucket, [])
  }
  for (const task of tasks) {
    const bucket = getTaskBucket(task)
    groups.get(bucket)!.push(task)
  }
  return groups
}

export function sortTasksByDue(tasks: GoogleTask[]): GoogleTask[] {
  return [...tasks].sort((a, b) => {
    if (!a.due && !b.due) return 0
    if (!a.due) return 1
    if (!b.due) return -1
    return new Date(a.due).getTime() - new Date(b.due).getTime()
  })
}

export function filterDueSoon(tasks: GoogleTask[]): GoogleTask[] {
  return tasks.filter(t => {
    const b = getTaskBucket(t)
    return b === 'overdue' || b === 'today' || b === 'thisWeek'
  })
}

export function formatDueDate(due: string | undefined): string {
  if (!due) return ''
  const dueDay = startOfDayUTC(new Date(due))
  const todayDay = startOfDayUTC(new Date())

  if (dueDay < todayDay) {
    const days = Math.round((todayDay.getTime() - dueDay.getTime()) / (1000 * 60 * 60 * 24))
    return days === 1 ? '1 day overdue' : `${days} days overdue`
  }
  if (dueDay.getTime() === todayDay.getTime()) return 'Today'

  return new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
