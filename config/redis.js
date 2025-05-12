import redis from 'redis'
import dayjs from 'dayjs';
const client = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASS,
  pingInterval: 30000,
});
client.on('error', (err) => console.error('Redis 连接错误:', err, dayjs().format('YYYY-MM-DD HH:mm:ss')));
client.on('connect', () => console.log('Redis 已连接', dayjs().format('YYYY-MM-DD HH:mm:ss')));
client.connect();
export default client
