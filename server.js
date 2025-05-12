import express from "express"
import dayjs from "dayjs"
import 'dotenv/config'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import client from './config/redis.js'
import { expressjwt } from "express-jwt"
import { Result } from './utils/result.js'
import ossRoute from './controller/ossRoute.js'
import userRoute from './controller/userRoute.js'
import bookRoute from './controller/bookRoute.js'
express()
  .use(cors({
    origin: ['http://localhost', 'http://localhost:5173', process.env.CLIENT_URL],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    preflightContinue: true,
    maxAge: 86400,
    optionsSuccessStatus: 204
  }))
  .use(expressjwt({
    secret: process.env.JWT_SECRET,
    algorithms: ['HS256'],
    credentialsRequired: true,
    isRevoked: async (_req, token) => {
      const exists = await client.exists(`bl_${token.token}`);
      return !!exists;
    }
  })
  .unless({
    path: [
      /^\/api\/user\/login($|\/)/,
      /^\/api\/user\/sendcode($|\/)/,
      /^\/api\/user\/register($|\/)/,
      /^\/api\/user\/name($|\/)/,
      /^\/api\/user\/list($|\/)/
    ]
  })
)
  .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .use('/api/oss/', ossRoute)
  .use('/api/user/', userRoute)
  .use('/api/book/', bookRoute)
  .use(rateLimit(
    {
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: Result.error('请求过于频繁，请稍后再试'),
    }
  ))
  .listen(process.env.SERVER_PORT, () => { console.log(`server ready on ${process.env.SERVER_PORT}`, dayjs().format('YYYY-MM-DD HH:mm:ss')) })
