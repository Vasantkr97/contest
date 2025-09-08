import express from "express";
import { depositBalance, getBalance } from "../controllers/balance.controllers";

const router = express.Router();

router.get('/', getBalance);

router.post('/deposit', depositBalance);

// router.get('/:asset', getAssetBalance);

export default router;