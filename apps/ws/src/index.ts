import { WebSocket } from "ws";
import { getRedisClient, type RedisClientType } from "@contest/redis-client";
import { BackpackTickerData, CONFIG } from "@contest/types";


let ws: WebSocket | null = null;
let redis: RedisClientType | null = null;

const initializeRedis = async (): Promise<void> => {
    redis = await getRedisClient();
    console.log("Redis connected");
};
initializeRedis();

interface PriceDataMessage {
    type: "price_update";
    data: BackpackTickerData;
    timestamp: number;
}

const createWebSocket = async (): Promise<void> => {
    ws = new WebSocket(CONFIG.WS_URL);

    ws.onopen = async (): Promise<void> => {
        console.log("Websocket Connected");

        ws!.send(JSON.stringify({
            method: "SUBSCRIBE",
            params: CONFIG.SUBSCRIPTIONS
        }))
        console.log("Subscribed to tickers");
    };


    ws.onmessage = async (event): Promise<void> => {
        try {
            const { data } = JSON.parse(event.data.toString());
            const message: PriceDataMessage = {
                type: "price_update",
                data: data,
                timestamp: Date.now()
            }

            if (redis) {
                const messageId = await redis.xAdd(CONFIG.STREAM_KEY, "*", {
                    data: JSON.stringify(message)
                })
            }

        } catch (error: unknown) {
            console.error("Error while queueing data to redis", error);
        }
    };

    ws.onclose = async (event: { code: number }): Promise<void> => {
        console.log(`WebSocket closed: ${event.code}`)
    };

    ws.onerror = (event) => {
        console.log("Websocket error:", event)
    }
};

createWebSocket();