import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
    if (!client) {
        client = createClient({
            url: process.env.REDIS_URL 
        })
    };

    client.on("error", (error) => {
        console.log("Redis Client connected");
    });

    client.on("connect", () => {
        console.log("Redis Client Connected");
    });

    client.on("disconnect", () => {
        console.log("Redis Client Disconnected");
    })


    if (!client.isOpen) {
        await client.connect();
    };

    return client;
};

