declare module 'expo-task-manager' {
  type TaskManagerTaskBody = {
    error?: unknown
    data?: unknown
  }

  export function defineTask(
    taskName: string,
    taskExecutor: (body: TaskManagerTaskBody) => void,
  ): void
}
