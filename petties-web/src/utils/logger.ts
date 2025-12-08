export const logger = {
  info: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[app]', ...args)
    }
  },
}

