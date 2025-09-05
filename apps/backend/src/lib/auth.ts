import type { Request, Response, NextFunction } from "express";
import jwt  from "jsonwebtoken"
import 'dotenv/config.js';

const secret = process.env.JWT_SECRETKEY || "VASANTH"

export const middlewareAuth = (req: Request, res: Response, next: NextFunction) => {
    let token = (req as any).cookies?.token;

    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({
            error: "Access denied - No token provided"
        });
    }

    try {
        const decoded = jwt.verify(token, secret) as any
        (req as any).user = { email: decoded.email };
        next();
    } catch (error) {
        return res.status(401).json({
            error: "Invalid token"
        })
    }
}