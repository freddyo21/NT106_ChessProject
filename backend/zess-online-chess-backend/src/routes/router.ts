import { Router } from "express";
import { authRouter } from "./auth.router";

const router: Router = Router();

router.get("/ping", (req, res) => {
    res.send({
        message: "Pong! Backend is alive!",
        timestamp: new Date().toISOString()
    });
});

router.use("/auth", authRouter);

export { router };