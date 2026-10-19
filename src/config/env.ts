import { parsePublicEnv } from './public-env'

export const publicEnv = parsePublicEnv(import.meta.env)
