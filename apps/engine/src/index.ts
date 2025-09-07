import { getRedisClient, type RedisClientType } from "@contest/redis-client";
import { CONFIG } from "@contest/types";
import { closeOrderEngine, placeOrder, updatePriceData } from "./state/memory";
import type { BackpackTickerData } from "@contest/types";
import { parse } from "path";
let redis: RedisClientType ;

const initializeRedis = async () => {
    redis = await getRedisClient();
    console.log("connected to redis Stream queue");
    console.log("Producer using stream key:", CONFIG.STREAM_KEY);
};
initializeRedis();

let lastId = "$" //"$" this means only new messages when we start the engine again "0" means all from start

export const getRedisStreams = async (): Promise<void> => {

    while (true) {
        try {
            const messages = await redis?.xRead(
                {
                    key: CONFIG.STREAM_KEY,
                    id: lastId
                },
                {
                    BLOCK: 2000,
                    COUNT: 10
                }
            );

            if (messages) {
                for (const stream of messages) {
                    for (const message of stream.messages) {
                        lastId = message.id

                        const raw = message.message["data"];
                        if (!raw) continue;

                      
                        await processMessage(message);

                    }
                }
            } else {
                console.log("no new messages");
            }
        } catch (error) {
            console.log("Error reading from redis stream:", error);
            await new Promise((r) => setTimeout(r, 1000));
        }
    };
};
getRedisStreams();

async function processMessage(message: any): Promise<void> {
    try {
        const raw = message.message["data"];
        if (!raw) return;

        const parseMessage = JSON.parse(raw);

        const messageType = parseMessage.type;
        
        switch (messageType) {
            case "price_update":
                await updatePriceData(parseMessage.data);
                break;
            
            case "order_request":
                await placeOrder(parseMessage.data, parseMessage.OrderId);
                break;
            case "close_request":
                await closeOrderEngine(parseMessage.data, parseMessage.OrderId);
                break;
            default: 
                console.warn(`Unknown message type: ${messageType}`)
        }
    } catch(err) {
        console.log("error assigning messages:")
    }
}

