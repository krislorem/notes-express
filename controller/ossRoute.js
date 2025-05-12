import express from 'express';
import dayjs from 'dayjs';
import multer from 'multer';
import ossClient from '../config/oss.js';
import { jwtAuth } from '../middleware/auth.js';
import { Result } from '../utils/result.js';
const upload = multer({ storage: multer.memoryStorage() })
const router = express.Router()
  .post('/upload', jwtAuth, upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const ext = file.originalname.split('.').pop();
      const filename = `${process.env.OSS_DIR}/${new Date().toISOString().slice(0, 10)}/${Date.now()}.${ext}`;

      const result = await ossClient.put(filename, file.buffer, {
        headers: { 'Content-Type': file.mimetype }
      });

      res.json(Result.success('上传成功', { url: result.url }));
      console.log(`文件上传成功: ${result.url}`, dayjs().format('YYYY-MM-DD HH:mm:ss'));
    } catch (err) {
      console.error('上传失败:', err, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      res.status(500).json(Result.error('上传失败'));
    }
  });
  export default router
