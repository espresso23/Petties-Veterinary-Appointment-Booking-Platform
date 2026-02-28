export const logger = {
  info: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
       
      console.info('[app]', ...args)
    }
  },
}

