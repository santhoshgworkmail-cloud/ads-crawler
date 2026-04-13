import dotenv from "dotenv";
import IORedis from "ioredis";

dotenv.config();

const redis = new IORedis(process.env.REDIS_URL);

await redis.set("test", "hello");
const value = await redis.get("test");

console.log("Redis test value:", value);

process.exit(0);
