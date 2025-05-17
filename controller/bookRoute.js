import express from "express";
import pool from "../config/db.js";
import dayjs from 'dayjs';
import { Result } from '../utils/result.js';
import { jwtAuth } from '../middleware/auth.js';
const router = express.Router()
  .post('/all', async (req, res) => {
    const { pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = `SELECT book.*, user.user_name, user.avatar, 
      (SELECT COUNT(*) FROM \`like\` WHERE type=0 AND object_id=book.book_id AND deleted=0) AS like_count,
      (SELECT COUNT(*) FROM mark WHERE type=0 AND object_id=book.book_id AND deleted=0) AS mark_count,
      (SELECT COUNT(*) FROM comment WHERE type=0 AND object_id=book.book_id AND deleted=0) AS comment_count,
      COUNT(*) OVER() AS total 
      FROM book 
      INNER JOIN user ON book.user_id = user.user_id 
      WHERE book.deleted = 0 AND book.is_public = 1 
      ORDER BY book.create_time DESC 
      LIMIT ?, ?`;
    const [rows] = await pool.execute(sql, [offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取所有书籍成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取所有书籍成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('书籍列表为空'));
    }
  })
  .post('/all/notes', async (req, res) => {
    const { pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = `SELECT note.*, user.user_name, user.avatar, book.book_name, 
    (SELECT COUNT(*) FROM \`like\` WHERE type=1 AND object_id=note.note_id AND deleted=0) AS like_count,
    (SELECT COUNT(*) FROM mark WHERE type=1 AND object_id=note.note_id AND deleted=0) AS mark_count,
    (SELECT COUNT(*) FROM comment WHERE type=1 AND object_id=note.note_id AND deleted=0) AS comment_count,
    COUNT(*) OVER() AS total FROM note JOIN user ON note.user_id = user.user_id JOIN book ON note.book_id = book.book_id WHERE note.deleted = 0 AND book.is_public = 1 ORDER BY note.create_time DESC LIMIT?,?`;
    const [rows] = await pool.execute(sql, [offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取公开笔记成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取公开笔记成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('公开笔记列表为空'));
    }
  })
  .post('/search', async (req, res) => {
    const { keyword, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = `SELECT book.*, user.user_name, user.avatar,
    (SELECT COUNT(*) FROM \`like\` WHERE type=0 AND object_id=book.book_id AND deleted=0) AS like_count,
    (SELECT COUNT(*) FROM mark WHERE type=0 AND object_id=book.book_id AND deleted=0) AS mark_count,
    (SELECT COUNT(*) FROM comment WHERE type=0 AND object_id=book.book_id AND deleted=0) AS comment_count,
    COUNT(*) OVER() AS total FROM book INNER JOIN user ON book.user_id = user.user_id WHERE book.deleted = 0 AND book.is_public = 1 AND (book.book_name LIKE?) ORDER BY book.create_time DESC LIMIT?,?`;
    const [rows] = await pool.execute(sql, [`%${keyword}%`, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`搜索书籍成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('搜索书籍成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('未找到相关书籍'));
    }
  })
  .post('/note/search', async (req, res) => {
    const { keyword, book_name, tags, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    // 动态构建WHERE条件
    const whereClauses = ['note.deleted = 0', 'book.is_public = 1'];
    const params = [];

    // 关键词搜索条件
    // 处理关键词条件
    const trimmedKeyword = keyword?.trim();
    if (trimmedKeyword) {
      whereClauses.push('(note.note_name LIKE ? OR note.content LIKE ?)');
      params.push(`%${trimmedKeyword}%`, `%${trimmedKeyword}%`);
    }

    // 书籍名称条件
    // 处理书籍名称条件
    const trimmedBookName = book_name?.trim();
    if (trimmedBookName) {
      whereClauses.push('book.book_name LIKE ?');
      params.push(`%${trimmedBookName}%`);
    }

    // 标签条件
    // 处理标签条件
    if (tags?.length > 0) {
      const validTags = tags.filter(t => t?.trim()).map(t => t.trim());
      if (validTags.length > 0) {
        whereClauses.push('JSON_CONTAINS(note.tags, ?)');
        params.push(JSON.stringify(validTags));
      }
    }

    // 组合WHERE条件
    const where = `WHERE ${whereClauses.join(' AND ')}`;

    const sql = `SELECT note.* , user.user_name, user.avatar, book.book_name,
    (SELECT COUNT(*) FROM \`like\` WHERE type=1 AND object_id=note.note_id AND deleted=0) AS like_count,
    (SELECT COUNT(*) FROM mark WHERE type=1 AND object_id=note.note_id AND deleted=0) AS mark_count,
    (SELECT COUNT(*) FROM comment WHERE type=1 AND object_id=note.note_id AND deleted=0) AS comment_count,
    COUNT(*) OVER() AS total 
    FROM note 
    JOIN user ON note.user_id = user.user_id 
    JOIN book ON note.book_id = book.book_id 
    ${where}
    ORDER BY note.create_time DESC 
    LIMIT ?, ?`;

    const [rows] = await pool.execute(sql, [...params, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`搜索笔记成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('搜索笔记成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('未找到相关笔记'));
    }
  })
  .post('/user', async (req, res) => {
    const { user_id, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = `SELECT book.*, user.user_name, user.avatar, 
    (SELECT COUNT(*) FROM \`like\` WHERE type=0 AND object_id=book.book_id AND deleted=0) AS like_count,
    (SELECT COUNT(*) FROM mark WHERE type=0 AND object_id=book.book_id AND deleted=0) AS mark_count,
    (SELECT COUNT(*) FROM comment WHERE type=0 AND object_id=book.book_id AND deleted=0) AS comment_count,
    COUNT(*) OVER() AS total FROM book INNER JOIN user ON book.user_id = user.user_id WHERE book.deleted = 0 AND book.user_id =? ORDER BY book.create_time DESC LIMIT?,?`;
    const [rows] = await pool.execute(sql, [user_id, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取用户书籍成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取用户书籍成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('书籍列表为空'));
    }
  })
  .post('/my', jwtAuth, async (req, res) => {
    const { user_id, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = `SELECT book.*, 
    (SELECT COUNT(*) FROM \`like\` WHERE type=0 AND object_id=book.book_id AND deleted=0) AS like_count,
    (SELECT COUNT(*) FROM mark WHERE type=0 AND object_id=book.book_id AND deleted=0) AS mark_count,
    (SELECT COUNT(*) FROM comment WHERE type=0 AND object_id=book.book_id AND deleted=0) AS comment_count,
    COUNT(*) OVER() AS total FROM book WHERE book.deleted = 0 AND book.user_id =? ORDER BY book.create_time DESC LIMIT?,?`;
    const [rows] = await pool.execute(sql, [user_id, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取我的书籍成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取我的书籍成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('书籍列表为空'));
    }
  })
  .post('/my/book', jwtAuth, async (req, res) => {
    const { book_id } = req.body;
    const sql = `SELECT book.*, user.user_name, user.avatar,
    (SELECT COUNT(*) FROM \`like\` WHERE type=0 AND object_id=book.book_id AND deleted=0) AS like_count,
    (SELECT COUNT(*) FROM mark WHERE type=0 AND object_id=book.book_id AND deleted=0) AS mark_count,
    (SELECT COUNT(*) FROM comment WHERE type=0 AND object_id=book.book_id AND deleted=0) AS comment_count
    FROM book 
    INNER JOIN user ON book.user_id = user.user_id 
    WHERE book.deleted = 0 AND book.book_id =?`;
    const [rows] = await pool.execute(sql, [book_id]);
    if (rows.length > 0) {
      console.log(`获取我的书籍成功`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取我的书籍成功', rows[0]));
    } else {
      res.json(Result.error('没有该书籍'));
    }
  })
  .post('/my/notes', jwtAuth, async (req, res) => {
    const { book_id, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = `SELECT note.*, user.user_name, user.avatar, book.book_name,
    (SELECT COUNT(*) FROM \`like\` WHERE type=1 AND object_id=note.note_id AND deleted=0) AS like_count,
    (SELECT COUNT(*) FROM mark WHERE type=1 AND object_id=note.note_id AND deleted=0) AS mark_count,
    (SELECT COUNT(*) FROM comment WHERE type=1 AND object_id=note.note_id AND deleted=0) AS comment_count,
    COUNT(*) OVER() AS total FROM note INNER JOIN user ON note.user_id = user.user_id INNER JOIN book ON note.book_id = book.book_id WHERE note.deleted = 0 AND note.book_id =? ORDER BY note.create_time DESC LIMIT ?, ?`;
    const [rows] = await pool.execute(sql, [book_id, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取我的笔记成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取我的笔记成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('笔记列表为空'));
    }
  })
  .post('/my/note', jwtAuth, async (req, res) => {
    const { note_id } = req.body;
    const sql = `SELECT note.*, user.user_name, user.avatar, book.book_name 
    FROM note INNER JOIN user ON note.user_id = user.user_id INNER JOIN book ON note.book_id = book.book_id WHERE note.deleted = 0 AND note.note_id =?`;
    const [rows] = await pool.execute(sql, [note_id]);
    if (rows.length > 0) {
      console.log(`获取我的笔记成功`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取我的笔记成功', rows[0]));
    } else {
      res.json(Result.error('没有该笔记'));
    }
  })
  .post('/comment', jwtAuth, async (req, res) => {
    const { book_id, user_id, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = `SELECT comment.*, user.user_name, user.avatar,
    (SELECT COUNT(*) FROM \`like\` WHERE type=2 AND object_id=comment.comment_id AND deleted=0) AS like_count,
    IFNULL((SELECT 1 FROM \`like\` WHERE type=2 AND object_id=comment.comment_id AND user_id = ? AND deleted=0 LIMIT 1), 0) AS is_liked,
    COUNT(*) OVER() AS total FROM comment INNER JOIN user ON comment.user_id = user.user_id WHERE comment.deleted = 0 AND comment.type = 0 AND comment.object_id =? ORDER BY comment.create_time DESC LIMIT?,?`;
    const [rows] = await pool.execute(sql, [user_id, book_id, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取评论成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取评论成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('评论列表为空'));
    }
  })
  .post('/note/comment', jwtAuth, async (req, res) => {
    const { note_id, user_id, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = `SELECT comment.*, user.user_name, user.avatar,
    IFNULL((SELECT 1 FROM \`like\` WHERE type=2 AND object_id=comment.comment_id AND user_id = ? AND deleted=0 LIMIT 1), 0) AS is_liked,
    COUNT(*) OVER() AS total FROM comment INNER JOIN user ON comment.user_id = user.user_id WHERE comment.deleted = 0 AND comment.type = 1 AND comment.object_id =? ORDER BY comment.create_time DESC LIMIT?,?`;
    const [rows] = await pool.execute(sql, [user_id, note_id, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取笔记评论成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取笔记评论成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('评论列表为空'));
    }
  })
  .post('/comment/reply', jwtAuth, async (req, res) => {
    const { comment_id, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = 'SELECT reply.*, user.user_name, user.avatar FROM reply INNER JOIN user ON reply.user_id = user.user_id WHERE reply.deleted = 0 AND reply.comment_id =? ORDER BY reply.create_time DESC LIMIT?,?';
    const [rows] = await pool.execute(sql, [comment_id, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取回复成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取回复成功', rows));
    } else {
      res.json(Result.error('回复列表为空'));
    }
  })
  .post('/like', async (req, res) => {
    const { book_id } = req.body;
    const sql = 'SELECT COUNT(*) AS like_count FROM `like` WHERE type=0 AND object_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [book_id]);
    if (rows.length > 0) {
      console.log(`获取点赞数成功，共${rows[0].like_count}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取点赞数成功', rows[0].like_count));
    } else {
      res.json(Result.error('0 个点赞'));
    }
  })
  .post('/mark', async (req, res) => {
    const { book_id } = req.body;
    const sql = 'SELECT COUNT(*) AS mark_count FROM mark WHERE type=0 AND object_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [book_id]);
    if (rows.length > 0) {
      console.log(`获取收藏数成功，共${rows[0].mark_count}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取收藏数成功', rows[0].mark_count));
    } else {
      res.json(Result.error('0 个收藏'));
    }
  })
  .post('/note/count', async (req, res) => {
    const { book_id } = req.body;
    const sql = 'SELECT COUNT(*) AS note_count FROM note WHERE book_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [book_id]);
    if (rows.length > 0) {
      console.log(`获取笔记数成功，共${rows[0].note_count}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取笔记数成功', rows[0].note_count));
    } else {
      res.json(Result.error('0 个笔记'));
    }
  })
  .post('/comment/count', async (req, res) => {
    const { book_id } = req.body;
    const sql = 'SELECT COUNT(*) AS comment_count FROM comment WHERE type=0 AND object_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [book_id]);
    if (rows.length > 0) {
      console.log(`获取评论数成功，共${rows[0].comment_count}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取评论数成功', rows[0].comment_count));
    } else {
      res.json(Result.error('0 个评论'));
    }
  })
  .post('/note/like', async (req, res) => {
    const { note_id } = req.body;
    const sql = 'SELECT COUNT(*) AS like_count FROM `like` WHERE type=1 AND object_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [note_id]);
    if (rows.length > 0) {
      console.log(`获取点赞数成功，共${rows[0].like_count}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取点赞数成功', rows[0].like_count));
    } else {
      res.json(Result.error('0 个点赞'));
    }
  })
  .post('/note/mark', async (req, res) => {
    const { note_id } = req.body;
    const sql = 'SELECT COUNT(*) AS mark_count FROM mark WHERE type=1 AND object_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [note_id]);
    if (rows.length > 0) {
      console.log(`获取收藏数成功，共${rows[0].mark_count}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取收藏数成功', rows[0].mark_count));
    } else {
      res.json(Result.error('0 个收藏'));
    }
  })
  .post('/note/comment/count', async (req, res) => {
    const { note_id } = req.body;
    const sql = 'SELECT COUNT(*) AS comment_count FROM comment WHERE type=1 AND object_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [note_id]);
    if (rows.length > 0) {
      console.log(`获取评论数成功，共${rows[0].comment_count}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取评论数成功', rows[0].comment_count));
    } else {
      res.json(Result.error('0 个评论'));
    }
  })
  .post('/comment/like', async (req, res) => {
    const { comment_id } = req.body;
    const sql = 'SELECT COUNT(*) AS like_count FROM `like` WHERE type=2 AND object_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [comment_id]);
    if (rows.length > 0) {
      console.log(`获取点赞数成功，共${rows[0].like_count}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取点赞数成功', rows[0].like_count));
    } else {
      res.json(Result.error('0 个点赞'));
    }
  })
  .post('/comment/reply/count', async (req, res) => {
    const { comment_id } = req.body;
    const sql = 'SELECT COUNT(*) AS reply_count FROM reply WHERE type=0 AND comment_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [comment_id]);
    if (rows.length > 0) {
      console.log(`获取回复数成功，共${rows[0].reply_count}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取回复数成功', rows[0].reply_count));
    } else {
      res.json(Result.error('0 个回复'));
    }
  })
  .post('/reply/like', async (req, res) => {
    const { reply_id } = req.body;
    const sql = 'SELECT COUNT(*) AS like_count FROM `like` WHERE type=3 AND object_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [reply_id]);
    if (rows.length > 0) {
      console.log(`获取点赞数成功，共${rows[0].like_count}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取点赞数成功', rows[0].like_count));
    } else {
      res.json(Result.error('0 个点赞'));
    }
  })
  .post('/create', jwtAuth, async (req, res) => {
    const { book_name, user_id, is_public, cover } = req.body;
    const sql = 'INSERT INTO book (book_name, user_id, is_public, cover) VALUES (?,?,?,?)';
    const [result] = await pool.execute(sql, [book_name, user_id, is_public, cover]);
    if (result.affectedRows > 0) {
      console.log(`创建书籍成功，书籍ID：${result.insertId}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('创建书籍成功', result.insertId));
    } else {
      res.json(Result.error('创建书籍失败'));
    }
  })
  .post('/update', jwtAuth, async (req, res) => {
    const { book_id, book_name, is_public, cover } = req.body;
    const sql = 'UPDATE book SET book_name =?, is_public =?, cover =? WHERE book_id =? AND deleted=0';
    const [result] = await pool.execute(sql, [book_name, is_public, cover, book_id]);
    if (result.affectedRows > 0) {
      console.log(`更新书籍成功，书籍ID：${book_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('更新书籍成功'));
    } else {
      res.json(Result.error('更新书籍失败'));
    }
  })
  .post('/delete', jwtAuth, async (req, res) => {
    const { book_id } = req.body;
    const sql = 'UPDATE book SET deleted=1 WHERE book_id =?';
    const [result] = await pool.execute(sql, [book_id]);
    if (result.affectedRows > 0) {
      console.log(`删除书籍成功，书籍ID：${book_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('删除书籍成功'));
    } else {
      res.json(Result.error('删除书籍失败'));
    }
  })
  .post('/note/create', jwtAuth, async (req, res) => {
    const { note_name, user_id, book_id, tags, content } = req.body;
    const sql = 'INSERT INTO note (note_name, user_id, book_id, tags, content) VALUES (?,?,?,?,?)';
    const [result] = await pool.execute(sql, [note_name, user_id, book_id, tags, content]);
    if (result.affectedRows > 0) {
      console.log(`创建笔记成功，笔记ID：${result.insertId}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('创建笔记成功', result.insertId));
    } else {
      res.json(Result.error('创建笔记失败'));
    }
  })
  .post('/note/update', jwtAuth, async (req, res) => {
    const { note_id, note_name, tags, content } = req.body;
    const sql = 'UPDATE note SET note_name =?, tags =?, content =? WHERE note_id =? AND deleted=0';
    const [result] = await pool.execute(sql, [note_name, tags, content, note_id]);
    if (result.affectedRows > 0) {
      console.log(`更新笔记成功，笔记ID：${note_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('更新笔记成功'));
    } else {
      res.json(Result.error('更新笔记失败'));
    }
  })
  .post('/note/delete', jwtAuth, async (req, res) => {
    const { note_id } = req.body;
    const sql = 'UPDATE note SET deleted=1 WHERE note_id =?';
    const [result] = await pool.execute(sql, [note_id]);
    if (result.affectedRows > 0) {
      console.log(`删除笔记成功，笔记ID：${note_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('删除笔记成功'));
    } else {
      res.json(Result.error('删除笔记失败'));
    }
  })
  .post('/my/deleted', jwtAuth, async (req, res) => {
    const { user_id, pageNum = 1, pageSize = 10 } = req.body;
    if (!user_id) return res.status(400).json(Result.error('缺少用户ID'));
    const validPageNum = Number(pageNum) || 1;
    const validPageSize = Number(pageSize) || 10;
    const offset = (validPageNum - 1) * validPageSize;
    const sql = `SELECT book.*, COUNT(*) OVER() AS total FROM book WHERE book.deleted = 1 AND book.user_id =? ORDER BY book.create_time DESC LIMIT ?, ?`;
    const [rows] = await pool.execute(sql, [user_id, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取我的已删除书籍成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取我的已删除书籍成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('书籍列表为空'));
    }
  })
  .post('/note/my/deleted', jwtAuth, async (req, res) => {
    const { user_id, pageNum, pageSize } = req.body;
    const offset = (pageNum - 1) * pageSize;
    const sql = 'SELECT note.*, COUNT(*) OVER() AS total FROM note WHERE note.deleted = 1 AND note.user_id =? ORDER BY note.create_time DESC LIMIT?,?';
    const [rows] = await pool.execute(sql, [user_id, offset.toString(), pageSize.toString()]);
    if (rows.length > 0) {
      console.log(`获取我的已删除笔记成功，共${rows.length}条记录`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('获取我的已删除笔记成功', { data: rows, total: rows[0]?.total || 0 }));
    } else {
      res.json(Result.error('笔记列表为空'));
    }
  })
  .post('/note/my/deleted/recover', jwtAuth, async (req, res) => {
    const { note_id } = req.body;
    const sql = 'UPDATE note SET deleted=0 WHERE note_id =?';
    const [result] = await pool.execute(sql, [note_id]);
    if (result.affectedRows > 0) {
      console.log(`恢复笔记成功，笔记ID：${note_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('恢复笔记成功'));
    } else {
      res.json(Result.error('恢复笔记失败'));
    }
  })
  .post('/my/deleted/recover', jwtAuth, async (req, res) => {
    const { book_id } = req.body;
    const sql = 'UPDATE book SET deleted=0 WHERE book_id =?';
    const [result] = await pool.execute(sql, [book_id]);
    if (result.affectedRows > 0) {
      console.log(`恢复书籍成功，书籍ID：${book_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('恢复书籍成功'));
    } else {
      res.json(Result.error('恢复书籍失败'));
    }
  })
  .post('/comment/create/book', jwtAuth, async (req, res) => {
    const { content, object_id, user_id } = req.body;
    const sql = 'INSERT INTO comment (content, user_id, object_id, type) VALUES (?,?,?,0)';
    const [result] = await pool.execute(sql, [content, user_id, object_id]);
    if (result.affectedRows > 0) {
      console.log(`创建评论成功，评论ID：${result.insertId}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('创建成功'));
    } else {
      res.json(Result.error('创建失败'));
    }
  })
  .post('/comment/create/note', jwtAuth, async (req, res) => {
    const { content, object_id, user_id } = req.body;
    const sql = 'INSERT INTO comment (content, user_id, object_id, type) VALUES (?,?,?,1)';
    const [result] = await pool.execute(sql, [content, user_id, object_id]);
    if (result.affectedRows > 0) {
      console.log(`创建评论成功，评论ID：${result.insertId}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('创建成功'));
    } else {
      res.json(Result.error('创建失败'));
    }
  })
  .post('/reply/create/comment', jwtAuth, async (req, res) => {
    const { content, object_id, user_id } = req.body;
    const sql = 'INSERT INTO reply (type, content, user_id, object_id, comment_id) VALUES (0,?,?,?,?)';
    const [result] = await pool.execute(sql, [content, user_id, object_id, object_id]);
    if (result.affectedRows > 0) {
      console.log(`创建回复成功，回复ID：${result.insertId}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('创建成功'));
    } else {
      res.json(Result.error('创建失败'));
    }
  })
  .post('/reply/create/reply', jwtAuth, async (req, res) => {
    const { content, object_id, user_id, comment_id } = req.body;
    const sql = 'INSERT INTO reply (type, content, user_id, object_id) VALUES (1,?,?,?,?)';
    const [result] = await pool.execute(sql, [content, user_id, object_id, comment_id]);
    if (result.affectedRows > 0) {
      console.log(`创建回复成功，回复ID：${result.insertId}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('创建成功'));
    } else {
      res.json(Result.error('创建失败'));
    }
  })
  .post('/comment/isMyComment', jwtAuth, async (req, res) => {
    const { user_id, comment_id } = req.body;
    const sql = 'SELECT * FROM comment WHERE user_id =? AND comment_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [user_id, comment_id]);
    if (rows.length > 0) {
      res.json(Result.success('是我的评论', true));
    } else {
      res.json(Result.success('不是我的评论', false));
    }
  })
  .post('/comment/isMyReply', jwtAuth, async (req, res) => {
    const { user_id, comment_id } = req.body;
    const sql = 'SELECT * FROM reply WHERE user_id =? AND comment_id =? AND deleted=0';
    const [rows] = await pool.execute(sql, [user_id, comment_id]);
    if (rows.length > 0) {
      res.json(Result.success('是我的回复', true));
    } else {
      res.json(Result.success('不是我的回复', false));
    }
  })
  .post('/comment/delete', jwtAuth, async (req, res) => {
    const { comment_id } = req.body;
    const sql = 'UPDATE comment SET deleted=1 WHERE comment_id =?';
    const [result] = await pool.execute(sql, [comment_id]);
    if (result.affectedRows > 0) {
      console.log(`删除评论成功，评论ID：${comment_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('删除评论成功'));
    } else {
      res.json(Result.error('删除评论失败'));
    }
  })
  .post('/reply/delete', jwtAuth, async (req, res) => {
    const { reply_id } = req.body;
    const sql = 'UPDATE comment SET deleted=1 WHERE reply_id =?';
    const [result] = await pool.execute(sql, [reply_id]);
    if (result.affectedRows > 0) {
      console.log(`删除回复成功，回复ID：${reply_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('删除回复成功'));
    } else {
      res.json(Result.error('删除回复失败'));
    }
  })
  .post('/like/book/isLiked', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'SELECT * FROM `like` WHERE user_id =? AND object_id =? AND type=0 AND deleted=0';
    const [rows] = await pool.execute(sql, [user_id, object_id]);
    if (rows.length > 0) {
      res.json(Result.success('已点赞', true));
    } else {
      res.json(Result.success('未点赞', false));
    }
  })
  .post('/like/note/isLiked', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'SELECT * FROM `like` WHERE user_id =? AND object_id =? AND type=1 AND deleted=0';
    const [rows] = await pool.execute(sql, [user_id, object_id]);
    if (rows.length > 0) {
      res.json(Result.success('已点赞', true));
    } else {
      res.json(Result.success('未点赞', false));
    }
  })
  .post('/like/comment/isLiked', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'SELECT * FROM `like` WHERE user_id =? AND object_id =? AND type=2 AND deleted=0';
    const [rows] = await pool.execute(sql, [user_id, object_id]);
    if (rows.length > 0) {
      res.json(Result.success('已点赞', true));
    } else {
      res.json(Result.success('未点赞', false));
    }
  })
  .post('/like/reply/isLiked', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'SELECT * FROM `like` WHERE user_id =? AND object_id =? AND type=3 AND deleted=0';
    const [rows] = await pool.execute(sql, [user_id, object_id]);
    if (rows.length > 0) {
      res.json(Result.success('已点赞', true));
    } else {
      res.json(Result.success('未点赞', false));
    }
  })
  .post('/mark/book/isMarked', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'SELECT * FROM mark WHERE user_id =? AND object_id =? AND type=0 AND deleted=0';
    const [rows] = await pool.execute(sql, [user_id, object_id]);
    if (rows.length > 0) {
      res.json(Result.success('已收藏', true));
    } else {
      res.json(Result.success('未收藏', false));
    }
  })
  .post('/mark/note/isMarked', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'SELECT * FROM mark WHERE user_id =? AND object_id =? AND type=1 AND deleted=0';
    const [rows] = await pool.execute(sql, [user_id, object_id]);
    if (rows.length > 0) {
      res.json(Result.success('已收藏', true));
    } else {
      res.json(Result.success('未收藏', false));
    }
  })
  .post('/like/book', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const existsSql = 'SELECT * FROM `like` WHERE user_id =? AND object_id =? AND type=0 AND deleted=0';
    const [existsRows] = await pool.execute(existsSql, [user_id, object_id]);
    if (existsRows.length > 0) {
      return res.json(Result.error('您已经点过赞了'));
    }
    const sql = 'INSERT INTO `like` (user_id, object_id, type) VALUES (?,?,0)';
    const [result] = await pool.execute(sql, [user_id, object_id]);
    if (result.affectedRows > 0) {
      console.log(`点赞成功，用户ID：${user_id}, 书籍ID：${object_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('点赞成功'));
    } else {
      res.json(Result.error('点赞失败'));
    }
  })
  .post('/like/book/unlike', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'UPDATE `like` SET deleted=1 WHERE user_id =? AND object_id =? AND type=0';
    const [result] = await pool.execute(sql, [user_id, object_id]);
    if (result.affectedRows > 0) {
      console.log(`取消点赞成功，用户ID：${user_id}, 书籍ID：${object_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('取消点赞成功'));
    } else {
      res.json(Result.error('取消点赞失败'));
    }
  })
  .post('/like/note', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const existsSql = 'SELECT * FROM `like` WHERE user_id =? AND object_id =? AND type=1 AND deleted=0';
    const [existsRows] = await pool.execute(existsSql, [user_id, object_id]);
    if (existsRows.length > 0) {
      return res.json(Result.error('您已经点过赞了'));
    }
    const sql = 'INSERT INTO `like` (user_id, object_id, type) VALUES (?,?,1)';
    const [result] = await pool.execute(sql, [user_id, object_id]);
    if (result.affectedRows > 0) {
      console.log(`点赞成功，用户ID：${user_id}, 笔记ID：${object_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('点赞成功'));
    } else {
      res.json(Result.error('点赞失败'));
    }
  })
  .post('/like/note/unlike', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'UPDATE `like` SET deleted=1 WHERE user_id =? AND object_id =? AND type=1';
    const [result] = await pool.execute(sql, [user_id, object_id]);
    if (result.affectedRows > 0) {
      console.log(`取消点赞成功，用户ID：${user_id}, 笔记ID：${object_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('取消点赞成功'));
    } else {
      res.json(Result.error('取消点赞失败'));
    }
  })
  .post('/like/comment', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const existsSql = 'SELECT * FROM `like` WHERE user_id =? AND object_id =? AND type=2 AND deleted=0';
    const [existsRows] = await pool.execute(existsSql, [user_id, object_id]);
    if (existsRows.length > 0) {
      return res.json(Result.error('您已经点过赞了'));
    } else {
      const sql = 'INSERT INTO `like` (user_id, object_id, type) VALUES (?,?,2)';
      const [result] = await pool.execute(sql, [user_id, object_id]);
      if (result.affectedRows > 0) {
        console.log(`点赞成功，用户ID：${user_id}, 评论ID：${object_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
        res.json(Result.success('点赞成功'));
      } else {
        res.json(Result.error('点赞失败'));
      }
    }
  })
  .post('/like/comment/unlike', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'UPDATE `like` SET deleted=1 WHERE user_id =? AND object_id =? AND type=2';
    const [result] = await pool.execute(sql, [user_id, object_id]);
    if (result.affectedRows > 0) {
      console.log(`取消点赞成功，用户ID：${user_id}, 评论ID：${object_id}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.json(Result.success('取消点赞成功'));
    } else {
      res.json(Result.error('取消点赞失败'));
    }
  })
  .post('/like/reply', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'INSERT INTO `like` (user_id, object_id, type) VALUES (?,?,3)';
    const [result] = await pool.execute(sql, [user_id, object_id]);
    if (result.affectedRows > 0) {
      res.json(Result.success('点赞成功'));
    } else {
      res.json(Result.error('点赞失败'));
    }
  })
  .post('/like/reply/unlike', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'UPDATE `like` SET deleted=1 WHERE user_id =? AND object_id =? AND type=3';
    const [result] = await pool.execute(sql, [user_id, object_id]);
    if (result.affectedRows > 0) {
      res.json(Result.success('取消点赞成功'));
    } else {
      res.json(Result.error('取消点赞失败'));
    }
  })
  .post('/mark/book', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const existsSql = 'SELECT * FROM mark WHERE user_id =? AND object_id =? AND type=0 AND deleted=0';
    const [existsRows] = await pool.execute(existsSql, [user_id, object_id]);
    if (existsRows.length > 0) {
      return res.json(Result.error('您已经收藏过了'));
    }
    const sql = 'INSERT INTO mark (user_id, object_id, type) VALUES (?,?,0)';
    const [result] = await pool.execute(sql, [user_id, object_id]);
    if (result.affectedRows > 0) {
      res.json(Result.success('收藏成功'));
    } else {
      res.json(Result.error('收藏失败'));
    }
  })
  .post('/mark/book/unmark', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'UPDATE mark SET deleted=1 WHERE user_id =? AND object_id =? AND type=0';
    const [result] = await pool.execute(sql, [user_id, object_id]);
    if (result.affectedRows > 0) {
      res.json(Result.success('取消收藏成功'));
    } else {
      res.json(Result.error('取消收藏失败'));
    }
  })
  .post('/mark/note', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const existsSql = 'SELECT * FROM mark WHERE user_id =? AND object_id =? AND type=1 AND deleted=0';
    const [existsRows] = await pool.execute(existsSql, [user_id, object_id]);
    if (existsRows.length > 0) {
      return res.json(Result.error('您已经收藏过了'));
    }
    const sql = 'INSERT INTO mark (user_id, object_id, type) VALUES (?,?,1)';
    const [result] = await pool.execute(sql, [user_id, object_id]);
    if (result.affectedRows > 0) {
      res.json(Result.success('收藏成功'));
    } else {
      res.json(Result.error('收藏失败'));
    }
  })
  .post('/mark/note/unmark', jwtAuth, async (req, res) => {
    const { user_id, object_id } = req.body;
    const sql = 'UPDATE mark SET deleted=1 WHERE user_id =? AND object_id =? AND type=1';
    const [result] = await pool.execute(sql, [user_id, object_id]);
    if (result.affectedRows > 0) {
      res.json(Result.success('取消收藏成功'));
    } else {
      res.json(Result.error('取消收藏失败'));
    }
  });

export default router;
