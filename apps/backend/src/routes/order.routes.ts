import express from "express";
import { closeOrder, getActiveOrders, openOrder } from "../controllers/order.controllers";

const router = express.Router();

router.post('/open', openOrder);

router.post('/close', closeOrder);

router.get('/active', getActiveOrders);

export default router;