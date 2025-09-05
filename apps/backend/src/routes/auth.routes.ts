import express from "express";
import { getProfile, logout, signin, verify } from "../controllers/auth.controller";
import { middlewareAuth } from "../lib/auth";

const router = express.Router();

router.use("/signin", signin);

router.get("/verify/:token", verify);

router.use(middlewareAuth);

router.post("/logout", logout);

router.get("/getUser", getProfile);

export default router;