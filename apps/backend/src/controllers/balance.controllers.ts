import { depositToUserBalance } from "@contest/engine/state/memory";
import { Request, Response } from "express";
import { getRedisClient, type RedisClientType } from "packages/redis/src";

let redis: RedisClientType | null = null;

(async () => {
    redis = await getRedisClient();
})();

export const getBalance = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log("reqquest from postman")
        const { userId } = req.query;

        if (!userId) {
            res.status(400).json({ error: "missing userId query parameter"});
        }

        const key = `balance:${userId}`
        const balanceData = await redis?.hGetAll(key);

        if (!balanceData || Object.keys(balanceData).length === 0) {
            res.status(404).json({
                success: false,
                error: "No balances found for this user",
            });
            return
        }

        res.status(200).json({
            success: true,
            data: {
                userId, 
                balances: {
                    USDC: {
                        asset: balanceData.asset,
                        available: parseFloat(balanceData.available),
                        locked: parseFloat(balanceData.locked),
                        total: parseFloat(balanceData.total),
                        updated_at: Number(balanceData.updated_at)
                    }
                }
            }
        })
    } catch (error) {
        console.error("error getting userbalance:", error);
        res.status(500).json({error: "internal server error"});
    }
};

export const depositBalance = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log("request from postman for deposit")
        const { userId, amount } = req.body;

        if (!userId || !amount) {
            res.status(400).json({ error: "missing required fields,"})
            return;
        }

        if (amount <= 0) {
            res.status(400).json({ error: "Amount must be greater than 0"});
            return;
        }

        const result = await depositToUserBalance(userId, parseFloat(amount));

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.balance,
                message: "Deposit Successfull"
            })
        } else {
            res.status(400).json({
                success:false,
                error: result.error
            });
        }
    } catch (error) {
        console.error("error depositing balance", error);
        res.status(500).json({ error: "internal server error"})
    }
};

// export const getAssetBalance = async (req: Request, res: Response): Promise<void> => {
//     try {
//         const { asset } = req.params;
//         const { userId } = req.query;

//         if (!asset || !userId) {
//             res.status(400).json({ error: "missing fields."});
//             return;
//         };

//         const balance = getAssetBalance(userId as string, asset);

//         res.status(200).json{
//             success: true,
//             data: balance
//         };
//     } catch (error) {
//         console.error("Error getting asset balance:", error);
//         res.status(500).json({ error: "Internal server error"});
//     }
// }