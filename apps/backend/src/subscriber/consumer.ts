import { getRedisClient, type RedisClientType } from "packages/redis/src";
import { CONFIG } from "@contest/types";

let lastUpdatedId = "$";
let redis: RedisClientType | null = null;

(async () => {
    redis = await getRedisClient();
    console.log("redis connected from consumer")
})

export async function waitForOrderConfirmation(orderId: string, timeOutMs: number = 5000): Promise<any> {
    const start = Date.now();

    while (true) {
        const messages = await redis!.xRead(
            { key: CONFIG.CONSUMER_KEY, id: lastUpdatedId },
            { BLOCK: 1000, COUNT: 10 }
        );
        console.log("messages in consumer", messages);
        if (messages) {
            
            for (const stream of messages) {
                for (const message of stream.messages) {
                    lastUpdatedId = message.id;

                    const raw = message.message["data"];
                    if (!raw) continue;

                    const update = JSON.parse(raw);
                    if (update.orderId === orderId) {
                        return update;
                    }
                }
            }
        }
        if (Date.now() -start > timeOutMs) {
            throw new Error("timeOut waiting for Response")
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }
}