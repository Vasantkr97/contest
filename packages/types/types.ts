export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'successfull' | 'cancelled';

export interface BackpackTickerData {
    symbol: string;
    event_type: string;
    bid_price: string,
    ask_price: string,
    bid_quantity: string;
    ask_quantity: string;
    update_id: string;
    event_time: string;
    timestamp: string;
};

export interface ClientConfig {
    readonly WS_URL: string;
    readonly STREAM_KEY: string;
    readonly CONSUMER_KEY: string;
    readonly SUBSCRIPTIONS: string[];
}


export const CONFIG: ClientConfig = {
    WS_URL: 'wss://ws.backpack.exchange',
    STREAM_KEY: "backpack_stream",
    CONSUMER_KEY: "consumer_key",
    SUBSCRIPTIONS: [
        "bookTicker.BTC_USDC_PERP",
        "bookTicker.ETH_USDC_PERP", 
        "bookTicker.SOL_USDC_PERP"
    ]
};


export interface PriceData {
    symbol: string;
    price: number;
    timestamp: number;
    volume: number;
};


export interface Order {
    OrderId: string;
    userId: string;
    symbol: string;
    side: OrderSide;
    amount: number;
    price: number;
    leverage: number;
    status: OrderStatus;
    timestamp: number;
    updatedAt: number

};

export interface Balance {
    id: string;
    userId: string;
    asset: string;
    available: number;
    locked: number;
    total: number
    updated_at: number;
};

export interface UserBalance {
    userId: string;
    balances: Record<string, Balance>;
}

export interface PriceData {
    symbol: string;
    price: number;
    volume: number;
    timestamp: number;
};

export interface OrderRequest {
    userId: string;
    symbol: string;
    side: OrderSide;
    amount: number;
    leverage: number;
};

export interface CloseOrderRequest {
    userId: string;
    OrderId: string;
};

export interface DepositRequest {
    userId: string;
    asset: string;
    amount: number;
};

export interface OrderConfirmation {
    OrderId: string;
    userId: string;
    symbol: string;
    side: OrderSide;
    amount: number;
    price: number;
    status: OrderStatus;
    timestamp: number;
    requiredMargin: number;
    availableBalance: number;
}

export interface PriceDataMessage {
    type: "price_update";
    data: BackpackTickerData;
    timestamp: number;
};

export interface OrderMessage {
    type: "order_request";
    data: OrderRequest;
    timestamp: number;
    OrderId: string;
};

export interface closeMessage {
    type: "close_request";
    data: CloseOrderRequest;
    timestamp: number;
    OrderId : string;
};