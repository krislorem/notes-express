import { createPool } from "mysql2/promise";
import dayjs from 'dayjs';
const pool = createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
pool.getConnection()
  .then((connection) => {
    console.log('数据库连接成功', connection.config.database, dayjs().format('YYYY-MM-DD HH:mm:ss'));
    connection.release();
  })
  .catch((err) => {
    console.error('数据库连接失败:', err, dayjs().format('YYYY-MM-DD HH:mm:ss'));
  });
export default pool;
