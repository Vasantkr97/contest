import { Request, Response } from "express";
import { getRedisClient, type RedisClientType } from "@contest/redis-client"
import { closeMessage, CONFIG, OrderMessage } from "packages/types/types";
import {  waitForOrderConfirmation } from "../subscriber/consumer";
import { randomUUID } from "crypto";

let redis: RedisClientType | null = null;

(async () => {
    redis = await getRedisClient();
    console.log("Redis connected for Orders");
})();

export const openOrder =async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, symbol, amount, leverage, side } = req.body;

        if (!userId || !symbol || !amount || !leverage || !side) {
            res.status(400).json({ error: "missing required fields"})
            return;
        };

        const OrderId = randomUUID();

        const orderMessage: OrderMessage =  {
            type: "order_request",
            data: {
                userId,
                symbol,
                amount: parseFloat(amount),
                leverage: parseFloat(leverage),
                side,
                
            },
            timestamp: Date.now(),
            OrderId
        };

        await redis!.xAdd(CONFIG.STREAM_KEY, "*", {
            data: JSON.stringify(orderMessage)
        })

        console.log(`Order request sent with ID: ${OrderId}`)

        try {
            const responseFromEngine = await waitForOrderConfirmation( OrderId, 5000);
            console.log("responses from engine",responseFromEngine)
            if (responseFromEngine) {
                res.json({
                    success: true,
                    engineResponse: responseFromEngine
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: "Order failed"
                })
            }
        } catch (err) {
            res.status(504).json({ error: "Timeout waiting for engine"});
        }
    } catch (error) {
        console.error("Error opening order:", error);
        res.status(500).json({ error: "Internal server error"});
    }
};


export const closeOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, OrderId } = req.body;

        if(!userId || !OrderId) {
            res.status(400).json({ error: "Missing userId or orderId"});
            return;
        }

        const closeOrderId = randomUUID();

        const closeOrderMessage: closeMessage = {
            type: "close_request",
            data: {
                userId,
                OrderId,
            },
            timestamp: Date.now(),
            OrderId: closeOrderId
        };

        await redis?.xAdd(CONFIG.STREAM_KEY, "*", {
            data: JSON.stringify(closeOrderMessage)
        });
        console.log(`Close order request sent with ID: ${closeOrderId} for order: ${OrderId}`);

        try {
            const responseFromEngine = await waitForOrderConfirmation(closeOrderId, 5000);
            console.log("Close order response from engine", responseFromEngine);

            if (responseFromEngine) {
                res.json({
                    success: true,
                    message: "order closed successfully",
                    engineRespone: responseFromEngine
                })
            } else {
                res.status(400).json({
                    success: false,
                    error: "Failed to close order"
                });
            }
        }catch (err) {
            res.status(504).json({ 
                success: false,
                error: "Timeout waiting for engine response"
            });
        }
    } catch (error) {
        console.error('Error closing Order:', error);
        res.status(500).json({ error: "Internal server error"})
    }
};

export const getActiveOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.query;

        if (!userId) {
            res.status(400).json({ error: "Missing userId query parameter"});
            return;
        };

        // Not implemented yet
        res.status(200).json({ success: true, data: [], count: 0 })
    } catch (error) {
        console.log("Error getting active orders:", error);
        res.status(500).json({ error: "Internal server error"})
    }
};

