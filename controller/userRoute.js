import express from 'express';
import bcrypt from 'bcryptjs';
import mail from '../config/mail.js';
import pool from '../config/db.js';
import client from '../config/redis.js';
import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import { Result } from '../utils/result.js';
import { jwtAuth } from '../middleware/auth.js';

const router = express.Router()
  .post('/login', async (req, res) => {
    const { user_name, password } = req.body;
    const sql = 'SELECT * FROM user WHERE user_name = ?';
    const [rows] = await pool.execute(sql, [user_name]);
    if (rows.length === 0) {
      return res.status(401).json(Result.error('用户名不存在'));
    } else {
      const user = rows[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        const token = jwt.sign({ user_id: user.user_id, user_name: user.user_name }, process.env.JWT_SECRET, { expiresIn: '12h' });
        const login_user = {
          user_id: user.user_id,
          user_name: user.user_name,
          nick_name: user.nick_name,
          avatar: user.avatar,
          email: user.email,
          info: user.info
        }
        console.log(`登录成功,用户ID：${user.user_id}, token: ${token}, `,dayjs().format('YYYY-MM-DD HH:mm:ss') );
        res.json(Result.success('登录成功', { login_user, token }));
      }
    }
  })
  .post('/sendcode', async (req, res) => {
    try {
      const email = req.body.email;
      const exists = await client.exists(`code:${email}`);
      if (exists) return res.status(429).json(Result.error('验证码已发送，请稍后再试'));
      await mail(email);
      res.json(Result.success('发送成功', { email }));
    } catch (error) {
      console.error('邮件发送失败:', error, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.status(500).json({ code: 1, message: "邮件发送失败", data: {} });
    }
  })
  .post('/register', async (req, res) => {
    const { user_name, email, code, password } = req.body;
    const exists = await client.exists(`code:${email}`);
    if (!exists) return res.status(400).json(Result.error('验证码已过期'));
    const storedCode = await client.get(`code:${email}`);
    if (code !== storedCode) return res.status(400).json(Result.error('验证码错误'));
    const sql = 'SELECT * FROM user WHERE user_name =? AND email =?';
    const [rows] = await pool.execute(sql, [user_name, email]);
    if (rows.length > 0) {
      return res.status(400).json(Result.error('用户名或邮箱已注册'));
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const sql = 'INSERT INTO user (user_name, email, password) VALUES (?, ?, ?)';
      const [result] = await pool.execute(sql, [user_name, email, hashedPassword]);
      if (result.affectedRows > 0) {
        console.log(`注册成功，用户ID：${result.insertId}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
        res.json(Result.success('注册成功', { user_id: result.insertId }));
      }
    }
  })
  .post('/logout',jwtAuth, async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const remainingTime = Math.max(decoded.exp - Math.floor(Date.now() / 1000), 0);
      await client.setEx(`bl_${token}`, remainingTime, 'revoked');
      console.log('已登出 token:', token, '用户ID:', decoded.user_id, '用户名:', decoded.user_name, '过期时间:', decoded.exp, '剩余时间:', decoded.exp - Math.floor(Date.now() / 1000), '秒', dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('登出成功'));
    } catch (err) {
      console.error('令牌验证失败:', err);
      res.status(401).json(Result.error('无效令牌'));
    }
  })
  .post('/list', async (req, res) => {
    const { pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = 'SELECT user_id,user_name,nick_name,avatar,info FROM user where deleted=0 LIMIT ?,?';
    const [rows] = await pool.execute(sql, [offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取用户列表成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取用户列表成功', rows));
    } else {
      res.json(Result.error('用户列表为空'));
    }
  })
  .post('/name', async (req, res) => {
    const { user_name } = req.body;
    const sql = 'SELECT user_id,user_name,nick_name,avatar,info FROM user WHERE user_name =? and deleted=0';
    const [rows] = await pool.execute(sql, [user_name]);
    if (rows.length === 0) {
      return res.status(401).json(Result.error('用户名不存在'));
    } else {
      const user = rows[0];
      console.log(`查询成功,用户ID：${user.user_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('查询成功', user));
    }
  })
  .post('/follow', jwtAuth, async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const inBlacklist = await client.exists(`bl_${token}`);
    if (inBlacklist) return res.status(401).json(Result.error('登录已过期'));
    
    const { user_id, follower_id } = req.body;
    const sql = 'SELECT * FROM follow WHERE user_id =? AND follower_id =?';
    const [rows] = await pool.execute(sql, [user_id, follower_id]);
    if (rows.length > 0) {
      return res.json(Result.error('已关注'));
    } else {
      const sql = 'INSERT INTO follow (user_id, follower_id) VALUES (?,?)';
      const [result] = await pool.execute(sql, [user_id, follower_id]);
      if (result.affectedRows > 0) {
        console.log(`关注成功，用户ID：${user_id}, 关注者ID：${follower_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
        res.json(Result.success('关注成功'));
      } else {
        res.json(Result.error('关注失败'));
      }
    }
  })
export default router;