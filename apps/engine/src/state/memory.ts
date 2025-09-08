
import { getRedisClient, type RedisClientType } from "@contest/redis-client";
import type { Order, UserBalance, PriceData, BackpackTickerData, OrderRequest, OrderConfirmation } from "@contest/types";
import { CONFIG } from "@contest/types";


let redis: RedisClientType | null = null;

export const state = {
    orders: new Map<string, Order>(),
    userBalances: new Map<string, UserBalance>(),
    prices: new Map<string, PriceData>(),
    userOrders: new Map<string, Set<string>>(),
    lastProcessedId: "$",
};

const SNAPSHOT_KEY = "engine:snapshot:latest";
const SNAPSHOT_BACKUP_KEY = "engine:snapshot:backup";
const SNAPsHOT_TTL = 300; 

const initializeRedis = async () => {
    redis = await getRedisClient();
    console.log("Connected to redis stream queue from memory.ts")
};
initializeRedis();

let lastId = "0";

const getCurrentPrice = (symbol: string): number => {
    const priceData = state.prices.get(symbol);
    return priceData ? priceData.price : 0
}


export const updatePriceData = (tickerData: BackpackTickerData): void => {
    const td: any = tickerData as any;
    const symbol = td.s ?? td.symbol;
    const bidPrice = parseFloat(td.b ?? td.bid_price);
    const askPrice = parseFloat(td.a ?? td.ask_price);
    const midPrice = (bidPrice + askPrice) / 2;
    const bidVolume = parseFloat(td.B ?? td.bid_quantity);
    const askVolume = parseFloat(td.A ?? td.ask_quantity);
    const totalVolume = bidVolume + askVolume;

    const priceData: PriceData = {
        symbol,
        price: midPrice,
        volume: totalVolume,
        timestamp: td.T ?? parseFloat(td.timestamp)
    };

    state.prices.set(symbol, priceData);
};

export const placeOrder = async (orderRequest: OrderRequest, OrderId: string): Promise<OrderConfirmation | null> => {
    const { userId, symbol, side, amount, leverage } = orderRequest;

    const currentPrice = getCurrentPrice(symbol);

    if (currentPrice === 0) {
        console.log(`No price data available for ${symbol}`);
        if (OrderId && redis) {
            const earlyUserBalance = state.userBalances.get(userId);
            const earlyUsdcBalance = earlyUserBalance?.balances['USDC'];
            const failureConfirmation: OrderConfirmation ={
                OrderId: OrderId,
                userId,
                symbol,
                side,
                amount,
                price: 0,
                status: "CANCELLED",
                timestamp: Date.now(),
                requiredMargin: 0,
                availableBalance: earlyUsdcBalance?.available ?? 0,
            };

            await redis.xAdd(CONFIG.CONSUMER_KEY, "*", {
                data: JSON.stringify(failureConfirmation)
            });
        }
        return null
    }

    const orderValue = amount*currentPrice;
    const requiredMargin = orderValue/leverage;

    const userBalance = state.userBalances.get(userId);
    const usdcBalance = userBalance?.balances['USDC'];

    if (!usdcBalance || usdcBalance.available < requiredMargin) {
        console.log(`Insufficient margin: required $${requiredMargin.toFixed(20)}, Available $${usdcBalance?.available.toFixed(2) || 0}`)
        if (OrderId && redis) {
            const failureConfirmation: OrderConfirmation ={
                OrderId: OrderId,
                userId,
                symbol,
                side,
                amount,
                price: 0,
                status: "CANCELLED",
                timestamp: Date.now(),
                requiredMargin: 0,
                availableBalance: usdcBalance?.available ?? 0,
            };

            await redis.xAdd(CONFIG.CONSUMER_KEY, "*", {
                data: JSON.stringify(failureConfirmation)
            });
        }
        return null
    };

    
    const order: Order = {
        OrderId,
        userId,
        symbol,
        side,
        amount,
        price: currentPrice,
        leverage,
        status: 'SUCCESSFULL',
        timestamp: Date.now(),
        updatedAt: Date.now(),
    }

    // Persist order
    state.orders.set(OrderId, order);
    if (!state.userOrders.has(userId)) state.userOrders.set(userId, new Set());
    state.userOrders.get(userId)!.add(OrderId);

    const userOrdersIds = state.userOrders.get(userId)!;
    const userOrders = [...userOrdersIds].map(id => state.orders.get(id))
    console.log(`📦 Orders for user ${userId}:`, JSON.stringify(userOrders, null, 2));

    // Deduct required margin
    usdcBalance.available -= requiredMargin;
    usdcBalance.locked = (usdcBalance.locked || 0) + requiredMargin;
    usdcBalance.updated_at = Date.now();

    await persistUserBalance(userId);

    const confirmation: OrderConfirmation = {
        OrderId,
        userId,
        symbol,
        side,
        amount,
        price: currentPrice,
        status: 'SUCCESSFULL',
        timestamp: order.timestamp,
        requiredMargin,
        availableBalance: usdcBalance.available
    };

    if (redis) {
        try {
            await redis.xAdd(CONFIG.CONSUMER_KEY, "*", {
                data: JSON.stringify(confirmation)
            });

            console.log(`Order confirmation sent for Order ID: ${OrderId}`)
        } catch (error) {
            console.error("Failed to send order confirmation to Redis:", error);
        }
    }

    return confirmation;
};

export const closeOrderEngine = async ( data: {userId: string, OrderId: string}, closeRequestId: string): Promise<void> => {
    const { userId, OrderId } = data;

    const order = state.orders.get(OrderId);
    if (!order) {
        console.log(`Order ${OrderId} not found for user ${userId}`)
        if (!redis) {
            await redis!.xAdd(CONFIG.CONSUMER_KEY, "*", {
                data: JSON.stringify({
                    OrderId: closeRequestId,
                    userId,
                    symbol: null,
                    side: null,
                    amount: 0,
                    price: 0,
                    status: "not_found",
                    timestamp: Date.now(),
                    requiredMargin: 0,
                    availableBalance: state.userBalances.get(userId)?.balances["USDC"]?.available ?? 0,
                })
            })
        }
    }

    if (!order) return;
    
    const closePrice = getCurrentPrice(order.symbol);
    // if (closePrice === 0) {
    //     console.log(`No price data available for ${order.symbol}, cannot close order`)
    //     return;
    // };
    const requiredMargin = (order.amount*order.price)/(order.leverage || 1);

    const direction = order.side === "BUY" ? 1 : -1;
    const pnl = (closePrice - order.price)*order.amount*direction;

    const userBalance = state.userBalances.get(userId);
    const usdcBalance = userBalance?.balances["USDC"];

    if (usdcBalance) {
        usdcBalance.locked = Math.max(0, usdcBalance.locked-requiredMargin);

        usdcBalance.available += requiredMargin + pnl;
        usdcBalance.total = usdcBalance.available + usdcBalance.locked;
        usdcBalance.updated_at = Date.now();
    };

    order.status = "CLOSED"
    order.updatedAt = Date.now();
    state.orders.set(OrderId, order);

    const userOrdersIds = state.userOrders.get(userId)!;
    const userOrders = [...userOrdersIds].map(id => state.orders.get(id))
    console.log(`📦 Orders for user ${userId}:`, JSON.stringify(userOrders, null, 2));
    await persistUserBalance(userId);

    const confirmation = {
        OrderId: closeRequestId,
        userId,
        symbol: order.symbol,
        side: order.side,
        amount: order.amount,
        entryPrice: order.price,
        closePrice,
        pnl,
        status: "closed",
        timestamp: Date.now(),
        releasedMargin: requiredMargin,
        availableBalance: usdcBalance?.available ?? 0,
    };

    if (redis) {
        await redis.xAdd(CONFIG.CONSUMER_KEY, "*", {
            data: JSON.stringify(confirmation),
        })
    };

    console.log(
        `✅ Order ${OrderId} marked CLOSED for user ${userId}. Entry: ${order.price}, Close: ${closePrice}, PnL: ${pnl.toFixed(
            6
        )}`
    );

};

export const persistUserBalance = async (userId: string): Promise<void> => {
    const balance = state.userBalances.get(userId);
    console.log("Print balance:",balance)
    if (!balance) return;

    const key = `balance:${userId}`;
    const usdc = balance.balances["USDC"];

    await redis?.hSet(key, {
        asset: usdc.asset,
        available: usdc.available.toString(),
        locked: usdc.locked.toString(),
        total: usdc.total.toString(),
        updated_at: usdc.updated_at.toString(),
    })

};

export const depositToUserBalance = async (userId: string, amount: number): Promise<{ success: boolean, balance?: UserBalance, error?: string}> =>{
    //initializing if user not exists
    if (!state.userBalances.has(userId)) {
        const userBalance: UserBalance = {
            userId,
            balances: {
                "USDC": {
                    id: `balance_${userId}_USDC`,
                    userId,
                    asset: "USDC",
                    available: 0,
                    locked: 0,
                    total: 0,
                    updated_at: Date.now()
                }
            }
        };
        state.userBalances.set(userId, userBalance);
    }

    const userBalance = state.userBalances.get(userId)!;
    const usdcBalance = userBalance.balances["USDC"];

    usdcBalance.available += amount;
    usdcBalance.total += amount;
    usdcBalance.updated_at = Date.now();

    await persistUserBalance(userId);

    return { success: true, balance: userBalance, error: "" }
};




//snapshoting 
export const createSnapshot = async (): Promise<void> => {
    if (!redis) {
        console.error("Redis not initialized for snapshot");
        return;
    };
    try {
        const currentSnapshot = await redis.get({})
    }
}