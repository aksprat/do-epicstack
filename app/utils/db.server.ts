import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient

declare global {
  var __db__: PrismaClient
}

// This is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
// In production, we'll have a single connection to the DB.
if (process.env.NODE_ENV === 'production') {
  prisma = getClient()
} else {
  if (!global.__db__) {
    global.__db__ = getClient()
  }
  prisma = global.__db__
}

function getClient() {
  const { DATABASE_URL } = process.env
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  
  const databaseUrl = new URL(DATABASE_URL)

  const isLocalSQLite = databaseUrl.protocol === 'file:'

  const PRIMARY_REGION = process.env.PRIMARY_REGION
  const FLY_REGION = process.env.FLY_REGION

  const isReadReplicaRegion = !isLocalSQLite && PRIMARY_REGION && FLY_REGION && PRIMARY_REGION !== FLY_REGION

  if (!isLocalSQLite && isReadReplicaRegion) {
    // 5433 is the read-replica port
    databaseUrl.port = '5433'
    // ensure readonly
    if (!databaseUrl.searchParams.has('sslmode')) {
      databaseUrl.searchParams.set('sslmode', 'require')
    }
  } else if (!isLocalSQLite) {
    // make sure we have a connection limit
    databaseUrl.searchParams.set('connection_limit', '1')
  }

  const client = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl.toString(),
      },
    },
  })
  // connect eagerly
  client.$connect()

  return client
}

export { prisma }