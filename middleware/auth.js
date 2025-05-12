import { Result } from '../utils/result.js';
import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import client from '../config/redis.js';

export const jwtAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json(Result.error('缺少访问令牌'));

    // 检查黑名单
    const inBlacklist = await client.exists(`bl_${token}`);
    if (inBlacklist) return res.status(401).json(Result.error('登录已过期'));

    // 验证令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      user_id: decoded.user_id,
      user_name: decoded.user_name
    };

    next();
  } catch (err) {
    console.error('JWT验证失败:', err, dayjs().format('YYYY-MM-DD HH:mm:ss'));
    res.status(401).json(Result.error('无效令牌'));
  }
};