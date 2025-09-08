import express from "express"
import cookieParser from "cookie-parser"
import "dotenv/config";
import authRoutes from "./routes/auth.routes";
import ordersRoutes from "./routes/order.routes"
import balanceRoutes from "./routes/balance.routes"

const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser())

app.get('/', (req, res) => {
    res.send("hillo");
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/orders", ordersRoutes)
app.use("/api/v1/balance", balanceRoutes)

app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`)
});

export default app;