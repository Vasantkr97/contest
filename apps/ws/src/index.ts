import { WebSocket } from "ws";
import { getRedisClient } from "@contest/redis-client";

const ws = new WebSocket('wss://ws.backpack.exchange');


ws.onopen = () => {

}