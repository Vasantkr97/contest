import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";
import nodemailer from "nodemailer";


const secret = process.env.JWT_SECRETKEY || "secret";
const PORT = process.env.PORT || 3000;

const sendToMail = async (email: string, token: string) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log("Email credentials not configured, skipping email send");
        return;
    }

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    (async () => {
        const info = await transporter.sendMail({
          from: '"Maddison Foo Koch" <maddison53@ethereal.email>',
          to: email,
          subject: "Hello ✔",
          text: "Hello world?", // plain‑text body
          html: `<a href="http://localhost:${PORT}/api/v1/auth/verify/${token}">Verify your account</a>`, // HTML body
        });
      
        console.log("Message sent:", info.messageId);
          console.log("📬 Preview URL:", nodemailer.getTestMessageUrl(info));
      
      })();
}

export const signin =async (req: Request, res: Response) => {

    try {
        const { email } = req.body;

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            return res.status(400).json({
                error: "valid email is required"
            });
        }

        const token = jwt.sign({ email }, secret)

        await sendToMail(email, token)

        res.json({
            msg: "Verification email sent succesfully, Please check your inbox.",
            emailSent: true
        })
    } catch (error) {
        console.error('Login error', error);
    }
};


export const verify = (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(401).json({
                msg: "Unauthorized - token required"
            })
        }

        const decoded = jwt.verify(token, secret) as any;

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "strict",
            maxAge: 3600000
        });

        res.status(200).json({
            msg: "User verified succesfully",
            user: { email: decoded.email },
            dashboardUrl: "https://github.com/Vasantkr97"
        })
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) 
            return res.status(401).json({
                message: "Token expired - PLease request a new verification link"
            })
    }
};


export const getProfile = (req: Request, res: Response) => {
    const user = (req as any).user;

    res.json({
        message: "Profile retrived Succesfully",
        user: { email: user.email }
    })
};

export const logout = (req: Request, res: Response) => {
    res.clearCookie('token');
    res.json({ msg: "logged out successfully"})
};


