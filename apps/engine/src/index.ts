import { getRedisClient, type RedisClientType } from "@contest/redis-client";
import { CONFIG } from "@contest/types";
import { closeOrderEngine, placeOrder, updatePriceData, state } from "./state/memory";

let redis: RedisClientType ;
let engineStartTime: number = Date.now();
const STALE_ORDER_THRESHOLD = 5000;


const initializeRedis = async () => {
    redis = await getRedisClient();
    console.log("connected to redis Stream queue");
    console.log("Producer using stream key:", CONFIG.STREAM_KEY);
};

const initializeEngine = async () => {
    await initializeRedis();
    engineStartTime = Date.now();

    const restored = await restoreFromSnapshot();

    if (restored) {
        console.log("Engine state restored from snapshot");

        if (state.lastProcessedId) {
            lastId = state.lastProcessedId;
            console.log(`Resuming from checkPoint: ${lastId}`);
        }
    } else {
        console.log("starting with fresh engine state");
    }
}

initializeEngine();

let lastId = "$" //"$" this means only new messages when we start the engine again "0" means all from start

export { state };

export const startOrderConsumer = async (): Promise<void> => {
    console.log("starting order consumer...");

    // creating periodic snapshot (every any seconds)
    const snapshotInterval = setInterval(async () => {
        try {
            await createSnapshot();
        } catch (error) {
            console.log("periodic snapshot failed:", error);
        }
    }, 30000);

    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;


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
                        //offset for snapshot to track the event
                        state.lastProcessedId = lastId;
                        const raw = message.message["data"];
                        if (!raw) continue;
                        //checking if message should be skipped (too old to take)
                        const shouldSkip = shouldSkipMessage(message);
                        if (shouldSkip) {
                            console.log(`Skipping stale message: ${message.id}`);
                            continue;
                        }
                        

                        await processMessage(message);
                    }
                }
            } else {
                // console.log("no new messages");
            }
        } catch (error) {
            consecutiveErrors++;
            console.log(`Error reading from redis stream (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error);
            
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                console.error(`Too many consecutive errors (${MAX_CONSECUTIVE_ERRORS}), creating snapshot and exiting...`);
                await createSnapshot();
                break;
            } 
            //Exponential backoff 2, 4, 8 , 10 ...
            const delay = Math.min(1000*Math.pow(2, consecutiveErrors-1), 10000);
            await new Promise((r) => setTimeout(r, delay));
        }
    };
};


const shouldSkipMessage = (message: any): boolean => {
    try {
        const raw = message.message["data"];
        if (!raw) return true;

        const parseMessage = JSON.parse(raw);
        const messageType = parseMessage.type;

        if (messageType === "price_update") {
            return false;
        }

        if (messageType === "order_request" || messageType === "close_request") {
            return isMessageTooOld(message.id, engineStartTime, STALE_ORDER_THRESHOLD)
        }
        return false;
    } catch (error) {
        console.log("Error checking message age:",error);
        return true
    }
}

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
};

//graceFull shutdown
process.on('SIGINT', async () => {
    console.log("received SIGINT, creating final snapshot...");
    try {
        await createSnapshot();
        process.exit(0)
    } catch (error) {
        process.exit(1)
    }
});

process.on('SIGTERM', async () => {
    try {
        await createSnapshot();
        process.exit(0);
    } catch (error) {
        process.exit(1)
    }
})

startOrderConsumer();



