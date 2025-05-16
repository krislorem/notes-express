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
      if (!isMatch) return res.status(401).json(Result.error('密码错误'));
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
        console.log(`登录成功,用户ID：${user.user_id}, token: ${token}, `, dayjs().format('YYYY-MM-DD HH:mm:ss'));
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
  .post('/logout', jwtAuth, async (req, res) => {
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
  .post('/info', jwtAuth, async (req, res) => {
    const { user_id } = req.body;
    const sql = 'SELECT user_id,user_name,nick_name,email,avatar,info FROM user WHERE user_id =? and deleted=0';
    const [rows] = await pool.execute(sql, [user_id]);
    if (rows.length === 0) {
      return res.status(401).json(Result.error('用户不存在'));
    } else {
      const user = rows[0];
      console.log(`获取用户信息成功，用户ID：${user.user_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取用户信息成功', user));
    }
  })
  .post('/update', jwtAuth, async (req, res) => {
    const { user_id, user_name, nick_name, info, avatar } = req.body;
    const sql = 'UPDATE user SET user_name =?, nick_name =?, info =?, avatar =? WHERE user_id =?';
    const [result] = await pool.execute(sql, [user_name, nick_name, info, avatar, user_id]);
    if (result.affectedRows > 0) {
      console.log(`更新用户信息成功，用户ID：${user_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('更新用户信息成功'));
    } else {
      res.json(Result.error('更新用户信息失败'));
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
  .post('/unfollow', jwtAuth, async (req, res) => {
    const { user_id, follower_id } = req.body;
    const sql = 'UPDATE follow SET deleted=1 WHERE user_id =? AND follower_id =?';
    const [result] = await pool.execute(sql, [user_id, follower_id]);
    if (result.affectedRows > 0) {
      console.log(`取消关注成功，用户ID：${user_id}, 关注者ID：${follower_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('取消关注成功'));
    } else {
      res.json(Result.error('取消关注失败'));
    }
  })
  .post('/follow/isFollowed', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'SELECT * FROM follow WHERE user_id =? AND follower_id =?';
    const [rows] = await pool.execute(sql, [object_id, user_id]);
    if (rows.length > 0) {
      res.json(Result.success('已关注', true));
    } else {
      res.json(Result.success('未关注', false));
    }
  })
  .post('/follower/isFollower', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'SELECT * FROM follow WHERE user_id =? AND follower_id =?';
    const [rows] = await pool.execute(sql, [user_id, object_id]);
    if (rows.length > 0) {
      res.json(Result.success('是粉丝', true));
    } else {
      res.json(Result.success('不是粉丝', false));
    }
  })
  .post('/followed', jwtAuth, async (req, res) => {
    const { user_id, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = 'SELECT user_id,user_name,nick_name,avatar,info, COUNT(*) OVER() AS total FROM user WHERE user_id IN (SELECT user_id FROM follow WHERE follower_id =? and deleted=0) LIMIT?,?';
    const [rows] = await pool.execute(sql, [user_id, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取关注列表成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取关注列表成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('关注列表为空'));
    }
  })
  .post('/follower', jwtAuth, async (req, res) => {
    const { user_id, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = 'SELECT user_id,user_name,nick_name,avatar,info, COUNT(*) OVER() AS total FROM user WHERE user_id IN (SELECT follower_id FROM follow WHERE user_id =? and deleted=0) LIMIT?,?';
    const [rows] = await pool.execute(sql, [user_id, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取粉丝列表成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取粉丝列表成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('粉丝列表为空'));
    }
  })
  .post('/favoriteNotebooks', jwtAuth, async (req, res) => {
    const { user_id, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = `SELECT book.*, user.user_name, user.avatar, COUNT(*) OVER() AS total FROM book INNER JOIN user ON book.user_id = user.user_id INNER JOIN mark ON book.book_id = mark.object_id WHERE mark.user_id =? AND mark.deleted=0 AND mark.type=0 AND book.deleted=0 AND book.is_public=1 ORDER BY mark.create_time DESC LIMIT ?, ?`;
    const [rows] = await pool.execute(sql, [user_id, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取收藏笔记本列表成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取收藏笔记本列表成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('收藏笔记本列表为空'));
    }
  })
  .post('/favoriteNotes', jwtAuth, async (req, res) => {
    const { user_id, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = 'SELECT note.*, user.user_name, user.avatar, COUNT(*) OVER() AS total FROM note INNER JOIN user ON note.user_id = user.user_id INNER JOIN mark ON note.note_id = mark.object_id WHERE mark.user_id =? AND mark.deleted=0 AND mark.type=1 AND note.deleted=0 ORDER BY mark.create_time DESC LIMIT?,?';
    const [rows] = await pool.execute(sql, [user_id, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取收藏笔记列表成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取收藏笔记列表成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('收藏笔记列表为空'));
    }
  })
  .post('/heat', jwtAuth, async (req, res) => {
    try {
      const { user_id } = req.body;
      const sql = `
        SELECT 
          date,
          SUM(count) AS count,
          CASE
            WHEN SUM(count) = 0 THEN 0
            WHEN SUM(count) BETWEEN 1 AND 2 THEN 1
            WHEN SUM(count) BETWEEN 3 AND 5 THEN 2
            WHEN SUM(count) BETWEEN 6 AND 9 THEN 3
            WHEN SUM(count) BETWEEN 10 AND 14 THEN 4
            ELSE 5
          END AS level
        FROM (
          (SELECT DATE_FORMAT(create_time, '%Y-%m-%d') AS date, COUNT(*) AS count FROM book WHERE user_id=? AND deleted=0 GROUP BY date)
          UNION ALL
          (SELECT DATE_FORMAT(create_time, '%Y-%m-%d') AS date, COUNT(*) AS count FROM note WHERE user_id=? AND deleted=0 GROUP BY date)
          UNION ALL
          (SELECT DATE_FORMAT(create_time, '%Y-%m-%d') AS date, COUNT(*) AS count FROM comment WHERE user_id=? AND deleted=0 GROUP BY date)
          UNION ALL
          (SELECT DATE_FORMAT(create_time, '%Y-%m-%d') AS date, COUNT(*) AS count FROM reply WHERE user_id=? AND deleted=0 GROUP BY date)
        ) AS combined
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
        GROUP BY date
        ORDER BY date`;

      const [rows] = await pool.execute(sql, [user_id, user_id, user_id, user_id]);

      console.log(`获取热力数据成功，用户ID：${user_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取成功', { heat_data: rows }));
    } catch (err) {
      console.error('热力数据查询失败:', err, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.status(500).json(Result.error('查询失败'));
    }
  })
  .post('/replyuser', jwtAuth, async (req, res) => {
    try {
      const { reply_id } = req.body;

      const sql = `
        SELECT 
          u.user_id,
          u.user_name 
        FROM reply r
        INNER JOIN user u ON r.user_id = u.user_id
        WHERE r.object_id = ?
        AND r.type = 1
        AND r.deleted = 0
        `;

      const [rows] = await pool.execute(sql, [reply_id]);

      if (rows.length > 0) {
        console.log(`获取关联用户成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
        res.json(Result.success('查询成功', rows));
      } else {
        res.json(Result.error('未找到关联用户'));
      }
    } catch (err) {
      console.error('查询失败:', err, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.status(500).json(Result.error('查询失败'));
    }
  })
  .post('/notebookNum', jwtAuth, async (req, res) => {
    const { user_id } = req.body;
    const sql = 'SELECT COUNT(*) AS total FROM book WHERE user_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [user_id]);
    if (rows.length > 0) {
      console.log(`获取笔记本数量成功，用户ID：${user_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取成功', { notebookNum: rows[0].total }));
    } else {
      res.json(Result.error('获取失败'));
    }
  })
  .post('/noteNum', jwtAuth, async (req, res) => {
    const { user_id } = req.body;
    const sql = 'SELECT COUNT(*) AS total FROM note WHERE user_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [user_id]);
    if (rows.length > 0) {
      console.log(`获取笔记数量成功，用户ID：${user_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取成功', { noteNum: rows[0].total }));
    } else {
      res.json(Result.error('获取失败'));
    }
  })
  .post('/likeNum', jwtAuth, async (req, res) => {
    const { user_id } = req.body;
    const sql = `SELECT COUNT(*) AS total FROM (
      SELECT l.like_id 
      FROM \`like\` l
      JOIN book b ON l.object_id = b.book_id AND l.type = 0
      WHERE b.user_id = ? AND l.deleted = 0
      UNION ALL
      SELECT l.like_id 
      FROM \`like\` l
      JOIN note n ON l.object_id = n.note_id AND l.type = 1
      WHERE n.user_id = ? AND l.deleted = 0
    ) AS combined`;
    const [rows] = await pool.execute(sql, [user_id, user_id]);
    if (rows.length > 0) {
      console.log(`获取点赞数量成功，用户ID：${user_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取成功', { likeNum: rows[0].total }));
    } else {
      res.json(Result.error('获取失败'));
    }
  })

export default router;
